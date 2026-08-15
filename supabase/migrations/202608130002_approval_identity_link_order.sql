-- Preserve the approved-profile identity invariant while allowing a valid pending
-- umpire to transition atomically through one-click approval.
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
  end if;

  -- The crew/profile integrity trigger requires an approved umpire. Approve first
  -- inside this transaction; any later failure rolls the complete transition back.
  update public.profiles set status = 'approved', approved_at = approval_time, rejected_at = null
  where id = target_profile.id returning * into target_profile;

  if matching_crew_count = 0 then
    insert into public.crew_members (
      organization_id, profile_id, first_name, last_name, email, phone, active
    ) values (
      administrator_organization_id, target_profile.id, target_profile.first_name,
      target_profile.last_name, normalized_verified_email, target_profile.phone, true
    ) returning * into target_crew_member;
  else
    update public.crew_members set profile_id = target_profile.id
    where id = target_crew_member.id returning * into target_crew_member;
  end if;

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
