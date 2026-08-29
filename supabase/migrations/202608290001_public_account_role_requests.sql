-- Public account-type requests and trusted, role-aware administrative approval.
-- A requested role is application data only; profiles.role remains the
-- unprivileged umpire value until an administrator approves the request.

alter table public.profiles
  add column requested_role public.account_role;

alter table public.profiles
  add constraint profiles_requested_public_role_check
  check (requested_role is null or requested_role in ('umpire', 'league_viewer', 'administrator'));

update public.profiles
set requested_role = role
where status = 'pending' and requested_role is null;

create or replace function public.protect_requested_account_role()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if old.requested_role is distinct from new.requested_role
    and auth.role() <> 'service_role' and not public.is_administrator()
  then raise exception 'requested_role_is_server_managed'; end if;
  return new;
end;
$$;

create trigger profiles_protect_requested_account_role
before update of requested_role on public.profiles
for each row execute function public.protect_requested_account_role();

create function public.provision_public_pending_account(
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_birthdate date,
  p_requested_role text
)
returns public.profiles
language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare
  authenticated_user auth.users%rowtype;
  existing_profile public.profiles%rowtype;
  created_profile public.profiles%rowtype;
  requested public.account_role;
  eligible_organization_id uuid;
  eligible_organization_count integer;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if p_requested_role not in ('umpire', 'league_viewer', 'administrator') then
    raise exception 'valid_requested_account_type_required';
  end if;
  requested := p_requested_role::public.account_role;
  if requested = 'umpire' then
    if p_birthdate is null then raise exception 'date_of_birth_required'; end if;
    if p_birthdate > current_date then raise exception 'invalid_date_of_birth'; end if;
    if p_birthdate > (current_date - interval '13 years')::date then raise exception 'minimum_age_13_required'; end if;
  elsif p_birthdate is not null then
    raise exception 'date_of_birth_not_permitted_for_requested_role';
  end if;

  select * into authenticated_user from auth.users where id = auth.uid();
  if not found or authenticated_user.email is null then raise exception 'authenticated_user_not_found'; end if;
  if authenticated_user.email_confirmed_at is null then raise exception 'email_verification_required'; end if;
  select * into existing_profile from public.profiles where auth_user_id = auth.uid();
  if found then
    if existing_profile.status = 'pending' and coalesce(existing_profile.requested_role, existing_profile.role) = requested
      then return existing_profile; end if;
    raise exception 'authenticated_user_profile_conflict';
  end if;
  if btrim(coalesce(p_first_name, '')) = '' or btrim(coalesce(p_last_name, '')) = '' then
    raise exception 'first_and_last_name_required';
  end if;
  select count(*) into eligible_organization_count from public.organizations where active = true;
  if eligible_organization_count <> 1 then raise exception 'public_registration_organization_not_configured'; end if;
  select id into eligible_organization_id from public.organizations where active = true;

  insert into public.profiles (
    organization_id, auth_user_id, role, requested_role, status,
    first_name, last_name, email, phone, birthdate
  ) values (
    eligible_organization_id, auth.uid(), 'umpire', requested, 'pending',
    btrim(p_first_name), btrim(p_last_name), lower(btrim(authenticated_user.email)),
    btrim(coalesce(p_phone, '')), case when requested = 'umpire' then p_birthdate else null end
  ) returning * into created_profile;

  insert into public.activities (organization_id, actor_profile_id, type, action, subject, message, metadata)
  values (created_profile.organization_id, created_profile.id, 'account', 'account_registered',
    concat_ws(' ', created_profile.first_name, created_profile.last_name),
    'Authenticated public account request submitted for approval.',
    jsonb_build_object('registrationWorkflow', 'public-account-request', 'requestedRole', requested));
  perform public.notify_organization_administrators(created_profile.organization_id,
    'registration-submitted', 'Registration Awaiting Approval',
    concat(concat_ws(' ', created_profile.first_name, created_profile.last_name),
      ' requested a ', replace(requested::text, '_', ' '), ' account and is awaiting approval.'), 'accounts');
  return created_profile;
end;
$$;

revoke all on function public.provision_public_pending_account(text,text,text,date,text) from public, anon;
grant execute on function public.provision_public_pending_account(text,text,text,date,text) to authenticated;

create function public.approve_pending_account(
  p_target_profile_id uuid,
  p_all_divisions boolean default false,
  p_division_levels text[] default '{}'
)
returns public.profiles
language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare
  actor_id uuid := public.current_profile_id();
  actor_org uuid := public.current_organization_id();
  target public.profiles%rowtype;
  target_auth auth.users%rowtype;
  requested public.account_role;
  approved_at_value timestamptz := now();
begin
  if not public.is_administrator() then raise exception 'administrator_required'; end if;
  select * into target from public.profiles
    where id = p_target_profile_id and organization_id = actor_org for update;
  if not found then raise exception 'pending_profile_not_found'; end if;
  if target.auth_user_id = auth.uid() then raise exception 'self_approval_not_permitted'; end if;
  select * into target_auth from auth.users where id = target.auth_user_id;
  if not found or target_auth.email is null or target_auth.email_confirmed_at is null then
    raise exception 'verified_auth_identity_required';
  end if;
  if lower(btrim(target.email)) <> lower(btrim(target_auth.email)) then
    raise exception 'verified_email_identity_conflict';
  end if;
  if target.status <> 'pending' then raise exception 'pending_account_required'; end if;
  requested := coalesce(target.requested_role, target.role);
  if requested not in ('umpire', 'league_viewer', 'administrator') then raise exception 'unsupported_requested_role'; end if;

  if requested = 'umpire' then
    return public.approve_pending_umpire(target.id);
  end if;
  if requested = 'league_viewer' and not p_all_divisions and cardinality(coalesce(p_division_levels, '{}')) = 0 then
    raise exception 'league_viewer_scope_required';
  end if;

  update public.profiles set role = requested, status = 'approved', approved_at = approved_at_value, rejected_at = null
    where id = target.id returning * into target;
  if requested = 'league_viewer' then
    insert into public.league_viewer_scopes (profile_id, organization_id, all_divisions, division_levels)
    values (target.id, actor_org, p_all_divisions, case when p_all_divisions then '{}' else p_division_levels end);
  end if;
  insert into public.notifications (organization_id,type,audience,recipient_profile_id,title,message,destination_page)
    values (actor_org,'account-approved','account',target.id,'Account Approved','Your account for The Slate has been approved.','profile');
  perform public.enqueue_communication_event(
    p_organization_id => actor_org, p_type => 'account-approved', p_category => 'account',
    p_recipient_profile_id => target.id,
    p_business_idempotency_key => concat('account-approved:', target.id),
    p_actor_profile_id => actor_id, p_subject_entity_type => 'profile', p_subject_entity_id => target.id,
    p_occurred_at => approved_at_value,
    p_metadata => jsonb_build_object('firstName', target.first_name, 'actionPath', ''),
    p_channels => array['in_app','email']::public.communication_channel[]);
  insert into public.activities (organization_id,actor_profile_id,type,action,subject,message,metadata)
    values (actor_org,actor_id,'account','account_approved',concat_ws(' ',target.first_name,target.last_name),
      concat(replace(requested::text, '_', ' '), ' account approved.'),
      jsonb_build_object('profileId',target.id,'approvedRole',requested));
  return target;
end;
$$;

revoke all on function public.approve_pending_account(uuid,boolean,text[]) from public, anon;
grant execute on function public.approve_pending_account(uuid,boolean,text[]) to authenticated;

create function public.reject_pending_account(p_target_profile_id uuid, p_reason text default null)
returns public.profiles language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  actor_id uuid := public.current_profile_id();
  actor_org uuid := public.current_organization_id();
  target public.profiles%rowtype;
  rejected_at_value timestamptz := now();
begin
  if not public.is_administrator() then raise exception 'account_rejection_unauthorized'; end if;
  select * into target from public.profiles
    where id = p_target_profile_id and organization_id = actor_org for update;
  if not found then raise exception 'account_rejection_not_found'; end if;
  if target.status <> 'pending' then raise exception 'account_rejection_not_pending'; end if;
  update public.profiles set status='rejected', rejected_at=rejected_at_value, approved_at=null
    where id=target.id returning * into target;
  insert into public.notifications (organization_id,type,audience,recipient_profile_id,title,message,destination_page)
    values (actor_org,'account-rejected','account',target.id,'Account Rejected','Your account for The Slate was not approved.','login');
  perform public.enqueue_communication_event(
    p_organization_id=>actor_org,p_type=>'account-rejected',p_category=>'account',
    p_recipient_profile_id=>target.id,
    p_business_idempotency_key=>concat('account-rejected:',target.id),
    p_actor_profile_id=>actor_id,p_subject_entity_type=>'profile',p_subject_entity_id=>target.id,
    p_occurred_at=>rejected_at_value,
    p_metadata=>jsonb_build_object('firstName',target.first_name,'actionPath',''),
    p_channels=>array['email']::public.communication_channel[]);
  insert into public.activities (organization_id,actor_profile_id,type,action,subject,message,metadata)
    values (actor_org,actor_id,'account','account_rejected',concat_ws(' ',target.first_name,target.last_name),
      'Pending account request rejected.',jsonb_build_object('profileId',target.id,'requestedRole',coalesce(target.requested_role,target.role),'reason',nullif(btrim(p_reason),'')));
  return target;
end;
$$;
revoke all on function public.reject_pending_account(uuid,text) from public, anon;
grant execute on function public.reject_pending_account(uuid,text) to authenticated;

drop function public.list_manageable_accounts();
create function public.list_manageable_accounts()
returns table (
  id uuid, auth_user_id uuid, organization_id uuid, role public.account_role,
  requested_role public.account_role, status public.account_status, first_name text, last_name text,
  email text, login_email text, contact_email text, phone text, birthdate date,
  personnel_id text, communication_preferences jsonb, approved_at timestamptz,
  rejected_at timestamptz, created_at timestamptz, crew_member_id uuid, identity_status text
)
language plpgsql security definer set search_path = pg_catalog, public, auth
as $$
declare actor_org uuid := public.current_organization_id();
begin
  if not public.is_administrator() then raise exception 'administrator_required'; end if;
  return query select p.id,p.auth_user_id,p.organization_id,p.role,p.requested_role,p.status,
    p.first_name,p.last_name,lower(u.email),lower(u.email),c.email,p.phone,p.birthdate,
    p.personnel_id,p.communication_preferences,p.approved_at,p.rejected_at,p.created_at,c.id,
    case when u.id is null then 'conflict'
      when lower(p.email) is distinct from lower(u.email) then 'conflict'
      when p.role = 'umpire' and p.status = 'approved' and c.id is null then 'unlinked'
      when p.role = 'umpire' and p.status = 'approved' and (c.organization_id <> actor_org or not c.active) then 'conflict'
      when p.role = 'umpire' and p.status = 'approved' then 'linked' else 'not_applicable' end
  from public.profiles p left join auth.users u on u.id=p.auth_user_id
  left join public.crew_members c on c.profile_id=p.id and c.organization_id=actor_org
  where p.organization_id=actor_org
  order by p.status,p.last_name,p.first_name,p.id;
end;
$$;
revoke all on function public.list_manageable_accounts() from public, anon;
grant execute on function public.list_manageable_accounts() to authenticated;
