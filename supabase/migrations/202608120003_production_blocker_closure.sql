-- Phase 8.3: same-organization administrative account hydration and
-- canonical account-approval communication.

create or replace function public.list_manageable_accounts()
returns table (
  id uuid,
  auth_user_id uuid,
  organization_id uuid,
  role public.account_role,
  status public.account_status,
  first_name text,
  last_name text,
  email text,
  login_email text,
  contact_email text,
  phone text,
  communication_preferences jsonb,
  approved_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz,
  crew_member_id uuid,
  identity_status text
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  actor_org uuid := public.current_organization_id();
begin
  if not public.is_administrator() then
    raise exception 'administrator_required';
  end if;

  return query
  select
    p.id,
    p.auth_user_id,
    p.organization_id,
    p.role,
    p.status,
    p.first_name,
    p.last_name,
    lower(u.email),
    lower(u.email),
    c.email,
    p.phone,
    p.communication_preferences,
    p.approved_at,
    p.rejected_at,
    p.created_at,
    c.id,
    case
      when u.id is null then 'conflict'
      when lower(p.email) is distinct from lower(u.email) then 'conflict'
      when p.role = 'umpire' and c.id is null then 'unlinked'
      when p.role = 'umpire' and (c.organization_id <> actor_org or not c.active) then 'conflict'
      when p.role = 'umpire' then 'linked'
      else 'not_applicable'
    end
  from public.profiles p
  left join auth.users u on u.id = p.auth_user_id
  left join public.crew_members c
    on c.profile_id = p.id and c.organization_id = actor_org
  where p.organization_id = actor_org
  order by p.status, p.last_name, p.first_name, p.id;
end;
$$;

revoke all on function public.list_manageable_accounts() from public, anon;
grant execute on function public.list_manageable_accounts() to authenticated;

create or replace function public.approve_umpire_profile(
  p_target_profile_id uuid,
  p_target_crew_member_id uuid
)
returns public.profiles
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  administrator_profile_id uuid := public.current_profile_id();
  administrator_organization_id uuid := public.current_organization_id();
  target_profile public.profiles%rowtype;
  target_crew_member public.crew_members%rowtype;
  approval_time timestamptz := now();
begin
  if not public.is_administrator() then
    raise exception 'Only administrators may approve umpire profiles';
  end if;

  select * into target_profile from public.profiles
   where id = p_target_profile_id and organization_id = administrator_organization_id for update;
  if not found then raise exception 'Pending profile was not found in this organization'; end if;
  if target_profile.role <> 'umpire' or target_profile.status <> 'pending' then
    raise exception 'Only pending umpire profiles may be approved';
  end if;

  select * into target_crew_member from public.crew_members
   where id = p_target_crew_member_id and organization_id = administrator_organization_id for update;
  if not found then raise exception 'Crew member was not found in this organization'; end if;
  if target_crew_member.profile_id is not null and target_crew_member.profile_id <> target_profile.id then
    raise exception 'Crew member is already linked to another profile';
  end if;

  update public.profiles set status='approved', approved_at=approval_time, rejected_at=null
   where id=target_profile.id returning * into target_profile;
  update public.crew_members set profile_id=target_profile.id where id=target_crew_member.id;

  insert into public.notifications (
    organization_id,type,audience,recipient_profile_id,title,message,destination_page
  ) values (
    administrator_organization_id,'account-approved','account',target_profile.id,
    'Account Approved','Your account for The Slate has been approved.','profile'
  );

  perform public.enqueue_communication_event(
    p_organization_id => administrator_organization_id,
    p_type => 'account-approved',
    p_category => 'account',
    p_recipient_profile_id => target_profile.id,
    p_business_idempotency_key => concat('account-approved:', target_profile.id),
    p_actor_profile_id => administrator_profile_id,
    p_subject_entity_type => 'profile',
    p_subject_entity_id => target_profile.id,
    p_occurred_at => approval_time,
    p_metadata => jsonb_build_object(
      'firstName', target_profile.first_name,
      'actionPath', ''
    ),
    p_channels => array['in_app','email']::public.communication_channel[]
  );

  insert into public.activities (
    organization_id,actor_profile_id,type,action,subject,message,metadata
  ) values (
    administrator_organization_id,administrator_profile_id,'account','account_approved',
    concat_ws(' ',target_profile.first_name,target_profile.last_name),
    'Umpire account approved and linked to crew.',
    jsonb_build_object('profileId',target_profile.id,'crewMemberId',target_crew_member.id)
  );

  return target_profile;
end;
$$;

revoke all on function public.approve_umpire_profile(uuid, uuid) from public, anon;
grant execute on function public.approve_umpire_profile(uuid, uuid) to authenticated;
