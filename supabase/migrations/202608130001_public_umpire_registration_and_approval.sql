-- Pilot public umpire registration and transactional one-click approval.
-- Invitation infrastructure remains available but is no longer used by the
-- ordinary public umpire registration path.

create or replace function public.provision_public_pending_umpire(
  p_first_name text,
  p_last_name text,
  p_phone text default ''
)
returns public.profiles
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  authenticated_user auth.users%rowtype;
  existing_profile public.profiles%rowtype;
  created_profile public.profiles%rowtype;
  eligible_organization_id uuid;
  eligible_organization_count integer;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;

  select * into authenticated_user from auth.users where id = auth.uid();
  if not found or authenticated_user.email is null then raise exception 'authenticated_user_not_found'; end if;
  if authenticated_user.email_confirmed_at is null then raise exception 'email_verification_required'; end if;

  select * into existing_profile from public.profiles where auth_user_id = auth.uid();
  if found then
    if existing_profile.role = 'umpire' and existing_profile.status = 'pending' then return existing_profile; end if;
    raise exception 'authenticated_user_profile_conflict';
  end if;

  if btrim(coalesce(p_first_name, '')) = '' or btrim(coalesce(p_last_name, '')) = '' then
    raise exception 'first_and_last_name_required';
  end if;

  select count(*) into eligible_organization_count
  from public.organizations where active = true;
  if eligible_organization_count <> 1 then raise exception 'public_registration_organization_not_configured'; end if;
  select id into eligible_organization_id from public.organizations where active = true;

  insert into public.profiles (
    organization_id, auth_user_id, role, status, first_name, last_name, email, phone
  ) values (
    eligible_organization_id, auth.uid(), 'umpire', 'pending', btrim(p_first_name),
    btrim(p_last_name), lower(btrim(authenticated_user.email)), btrim(coalesce(p_phone, ''))
  ) returning * into created_profile;

  insert into public.activities (
    organization_id, actor_profile_id, type, action, subject, message, metadata
  ) values (
    created_profile.organization_id, created_profile.id, 'account', 'account_registered',
    concat_ws(' ', created_profile.first_name, created_profile.last_name),
    'Authenticated public umpire registration submitted for approval.',
    jsonb_build_object('registrationWorkflow', 'public-umpire')
  );

  perform public.notify_organization_administrators(
    created_profile.organization_id, 'registration-submitted', 'Registration Awaiting Approval',
    concat(concat_ws(' ', created_profile.first_name, created_profile.last_name), ' has registered and is awaiting approval.'),
    'accounts'
  );

  return created_profile;
end;
$$;

revoke all on function public.provision_public_pending_umpire(text, text, text) from public, anon;
grant execute on function public.provision_public_pending_umpire(text, text, text) to authenticated;

create or replace function public.approve_pending_umpire(p_target_profile_id uuid)
returns public.profiles
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  administrator_profile_id uuid := public.current_profile_id();
  administrator_organization_id uuid := public.current_organization_id();
  target_profile public.profiles%rowtype;
  target_auth_user auth.users%rowtype;
  target_crew_member public.crew_members%rowtype;
  matching_crew_count integer;
  normalized_verified_email text;
  approval_time timestamptz := now();
begin
  if not public.is_administrator() then raise exception 'administrator_required'; end if;

  select * into target_profile from public.profiles
  where id = p_target_profile_id and organization_id = administrator_organization_id for update;
  if not found then raise exception 'pending_profile_not_found'; end if;

  -- A committed retry is a successful no-op and cannot duplicate Crew or communication.
  if target_profile.role = 'umpire' and target_profile.status = 'approved'
    and exists (
      select 1 from public.crew_members
      where organization_id = administrator_organization_id and profile_id = target_profile.id
    ) then
    return target_profile;
  end if;

  if target_profile.role <> 'umpire' or target_profile.status <> 'pending' then
    raise exception 'pending_umpire_required';
  end if;

  select * into target_auth_user from auth.users where id = target_profile.auth_user_id;
  if not found or target_auth_user.email is null or target_auth_user.email_confirmed_at is null then
    raise exception 'verified_auth_identity_required';
  end if;
  normalized_verified_email := lower(btrim(target_auth_user.email));
  if normalized_verified_email = '' or lower(btrim(target_profile.email)) <> normalized_verified_email then
    raise exception 'verified_email_identity_conflict';
  end if;

  -- Serialize approval/matching by organization and verified email.
  perform pg_advisory_xact_lock(hashtextextended(administrator_organization_id::text || ':' || normalized_verified_email, 0));

  select count(*) into matching_crew_count from public.crew_members
  where organization_id = administrator_organization_id
    and btrim(email) <> '' and lower(btrim(email)) = normalized_verified_email;

  if matching_crew_count > 1 then raise exception 'crew_email_match_ambiguous'; end if;

  if matching_crew_count = 1 then
    select * into target_crew_member from public.crew_members
    where organization_id = administrator_organization_id
      and btrim(email) <> '' and lower(btrim(email)) = normalized_verified_email
    for update;
    if target_crew_member.profile_id is not null and target_crew_member.profile_id <> target_profile.id then
      raise exception 'crew_email_match_already_linked';
    end if;
    if not target_crew_member.active then raise exception 'crew_email_match_inactive'; end if;
  else
    insert into public.crew_members (
      organization_id, profile_id, first_name, last_name, email, phone, active
    ) values (
      administrator_organization_id, target_profile.id, target_profile.first_name,
      target_profile.last_name, normalized_verified_email, target_profile.phone, true
    ) returning * into target_crew_member;
  end if;

  update public.crew_members set profile_id = target_profile.id where id = target_crew_member.id;
  update public.profiles set status = 'approved', approved_at = approval_time, rejected_at = null
  where id = target_profile.id returning * into target_profile;

  insert into public.notifications (
    organization_id, type, audience, recipient_profile_id, title, message, destination_page
  ) values (
    administrator_organization_id, 'account-approved', 'account', target_profile.id,
    'Account Approved', 'Your account for The Slate has been approved.', 'profile'
  );

  perform public.enqueue_communication_event(
    p_organization_id => administrator_organization_id,
    p_type => 'account-approved', p_category => 'account',
    p_recipient_profile_id => target_profile.id,
    p_business_idempotency_key => concat('account-approved:', target_profile.id),
    p_actor_profile_id => administrator_profile_id,
    p_subject_entity_type => 'profile', p_subject_entity_id => target_profile.id,
    p_occurred_at => approval_time,
    p_metadata => jsonb_build_object('firstName', target_profile.first_name, 'actionPath', ''),
    p_channels => array['in_app','email']::public.communication_channel[]
  );

  insert into public.activities (
    organization_id, actor_profile_id, type, action, subject, message, metadata
  ) values (
    administrator_organization_id, administrator_profile_id, 'account', 'account_approved',
    concat_ws(' ', target_profile.first_name, target_profile.last_name),
    'Umpire account approved and linked to crew.',
    jsonb_build_object('profileId', target_profile.id, 'crewMemberId', target_crew_member.id,
      'crewResolution', case when matching_crew_count = 0 then 'created' else 'matched' end)
  );

  return target_profile;
end;
$$;

revoke all on function public.approve_pending_umpire(uuid) from public, anon;
grant execute on function public.approve_pending_umpire(uuid) to authenticated;

create or replace function public.reject_umpire_profile(
  p_target_profile_id uuid,
  p_reason text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := public.current_profile_id();
  v_org uuid := public.current_organization_id();
  v_profile public.profiles%rowtype;
  v_rejected_at timestamptz := now();
begin
  if not public.is_administrator() then raise exception 'account_rejection_unauthorized'; end if;
  select * into v_profile from public.profiles
    where id = p_target_profile_id and organization_id = v_org for update;
  if not found then raise exception 'account_rejection_not_found'; end if;
  if v_profile.role <> 'umpire' or v_profile.status <> 'pending' then raise exception 'account_rejection_not_pending'; end if;

  update public.profiles set status = 'rejected', rejected_at = v_rejected_at, approved_at = null
    where id = v_profile.id returning * into v_profile;
  insert into public.notifications (organization_id,type,audience,recipient_profile_id,title,message,destination_page)
    values (v_org,'account-rejected','account',v_profile.id,'Account Rejected','Your account for The Slate was not approved.','login');
  perform public.enqueue_communication_event(
    p_organization_id => v_org, p_type => 'account-rejected', p_category => 'account',
    p_recipient_profile_id => v_profile.id,
    p_business_idempotency_key => concat('account-rejected:', v_profile.id),
    p_actor_profile_id => v_actor, p_subject_entity_type => 'profile', p_subject_entity_id => v_profile.id,
    p_occurred_at => v_rejected_at,
    p_metadata => jsonb_build_object('firstName', v_profile.first_name, 'actionPath', ''),
    p_channels => array['email']::public.communication_channel[]
  );
  insert into public.activities (organization_id,actor_profile_id,type,action,subject,message,metadata)
    values (v_org,v_actor,'account','account_rejected',concat_ws(' ',v_profile.first_name,v_profile.last_name),
      'Pending umpire account rejected.',jsonb_build_object('profileId',v_profile.id,'reason',nullif(btrim(p_reason),'')));
  return v_profile;
end;
$$;

revoke all on function public.reject_umpire_profile(uuid, text) from public, anon;
grant execute on function public.reject_umpire_profile(uuid, text) to authenticated;
