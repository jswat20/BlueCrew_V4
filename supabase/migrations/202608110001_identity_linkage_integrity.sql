-- Milestone 7.5B: trusted crew/Profile/Auth identity diagnostics and safe linking.

create unique index if not exists crew_members_profile_id_unique
  on public.crew_members (profile_id) where profile_id is not null;

create or replace function public.validate_crew_profile_link()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  linked_profile public.profiles%rowtype;
begin
  if new.profile_id is null or (tg_op = 'UPDATE' and new.profile_id is not distinct from old.profile_id) then
    return new;
  end if;
  select * into linked_profile from public.profiles
   where id = new.profile_id and organization_id = new.organization_id;
  if not found then raise exception 'identity_cross_organization'; end if;
  if linked_profile.role <> 'umpire' then raise exception 'identity_role_incompatible'; end if;
  if linked_profile.status <> 'approved' then raise exception 'identity_status_incompatible'; end if;
  if not exists (select 1 from auth.users where id = linked_profile.auth_user_id) then
    raise exception 'identity_auth_user_missing';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_crew_profile_link on public.crew_members;
create trigger validate_crew_profile_link
before insert or update of profile_id, organization_id on public.crew_members
for each row execute function public.validate_crew_profile_link();

create or replace function public.list_crew_identity_diagnostics()
returns table (
  crew_member_id uuid, linked_profile_id uuid, linkage_status text,
  linked_role public.account_role, linked_status public.account_status,
  login_email text, contact_email text, conflict_code text
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare actor_org uuid := public.current_organization_id();
begin
  if not public.is_administrator() then raise exception 'administrator_required'; end if;
  return query
  select c.id, c.profile_id,
    case
      when c.profile_id is null then 'unlinked'
      when p.id is null then 'conflict'
      when u.id is null then 'conflict'
      when p.organization_id <> c.organization_id then 'conflict'
      when p.role <> 'umpire' then 'conflict'
      when p.status <> 'approved' or not c.active then 'conflict'
      when (select count(*) from public.crew_members x where x.profile_id = c.profile_id) <> 1 then 'conflict'
      when lower(p.email) is distinct from lower(u.email) then 'conflict'
      else 'linked'
    end,
    p.role, p.status,
    case when p.id is not null and u.id is not null and p.organization_id = actor_org then lower(u.email) end,
    c.email,
    case
      when c.profile_id is null then null
      when p.id is null or p.organization_id <> c.organization_id then 'cross_organization_or_missing_profile'
      when u.id is null then 'auth_user_missing'
      when p.role <> 'umpire' then 'role_incompatible'
      when p.status <> 'approved' or not c.active then 'status_incompatible'
      when (select count(*) from public.crew_members x where x.profile_id = c.profile_id) <> 1 then 'duplicate_profile_link'
      when lower(p.email) is distinct from lower(u.email) then 'login_email_conflict'
      else null
    end
  from public.crew_members c
  left join public.profiles p on p.id = c.profile_id
  left join auth.users u on u.id = p.auth_user_id
  where c.organization_id = actor_org
  order by c.last_name, c.first_name, c.id;
end;
$$;

create or replace function public.list_linkable_umpire_profiles()
returns table (profile_id uuid, first_name text, last_name text, login_email text)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare actor_org uuid := public.current_organization_id();
begin
  if not public.is_administrator() then raise exception 'administrator_required'; end if;
  return query select p.id, p.first_name, p.last_name, lower(u.email)
  from public.profiles p join auth.users u on u.id = p.auth_user_id
  where p.organization_id = actor_org and p.role = 'umpire' and p.status = 'approved'
  order by p.last_name, p.first_name, p.id;
end;
$$;

create or replace function public.manage_crew_login_identity(
  p_crew_member_id uuid, p_action text, p_target_profile_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  actor_id uuid := public.current_profile_id(); actor_org uuid := public.current_organization_id();
  crew public.crew_members%rowtype; target public.profiles%rowtype; previous_profile_id uuid;
begin
  if not public.is_administrator() then raise exception 'administrator_required'; end if;
  if p_action not in ('link','relink','unlink') then raise exception 'identity_action_invalid'; end if;
  select * into crew from public.crew_members where id=p_crew_member_id and organization_id=actor_org for update;
  if not found then raise exception 'crew_member_not_found'; end if;
  previous_profile_id := crew.profile_id;
  if p_action = 'unlink' then
    if crew.profile_id is null then raise exception 'identity_already_unlinked'; end if;
    update public.crew_members set profile_id=null where id=crew.id;
  else
    if p_target_profile_id is null then raise exception 'target_profile_required'; end if;
    select * into target from public.profiles where id=p_target_profile_id and organization_id=actor_org for update;
    if not found then raise exception 'identity_cross_organization'; end if;
    if target.role <> 'umpire' then raise exception 'identity_role_incompatible'; end if;
    if target.status <> 'approved' then raise exception 'identity_status_incompatible'; end if;
    if not exists (select 1 from auth.users where id=target.auth_user_id) then raise exception 'identity_auth_user_missing'; end if;
    if exists (select 1 from public.crew_members where profile_id=target.id and id<>crew.id) then raise exception 'identity_profile_already_linked'; end if;
    if p_action='link' and crew.profile_id is not null then raise exception 'identity_explicit_relink_required'; end if;
    if p_action='relink' and crew.profile_id is null then raise exception 'identity_link_required'; end if;
    update public.crew_members set profile_id=target.id where id=crew.id;
  end if;
  insert into public.activities(organization_id,actor_profile_id,type,action,subject,message,metadata)
  values(actor_org,actor_id,'account',concat('crew_identity_',p_action),concat_ws(' ',crew.first_name,crew.last_name),
    'Crew login identity linkage changed by an administrator.',
    jsonb_build_object('crewMemberId',crew.id,'previousProfileId',previous_profile_id,'targetProfileId',p_target_profile_id));
end;
$$;

revoke all on function public.list_crew_identity_diagnostics() from public;
revoke all on function public.list_linkable_umpire_profiles() from public;
revoke all on function public.manage_crew_login_identity(uuid,text,uuid) from public;
grant execute on function public.list_crew_identity_diagnostics() to authenticated;
grant execute on function public.list_linkable_umpire_profiles() to authenticated;
grant execute on function public.manage_crew_login_identity(uuid,text,uuid) to authenticated;
