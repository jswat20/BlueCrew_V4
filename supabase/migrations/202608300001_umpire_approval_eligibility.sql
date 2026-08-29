-- Require trusted eligibility review before approving an Umpire request.
-- The existing p_division_levels argument remains scope data for League Viewers
-- and is the reviewed eligibility set for Umpires.

create or replace function public.approve_pending_account(
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
  reviewed_levels text[];
begin
  if public.is_administrator() is not true then raise exception 'administrator_required'; end if;
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
    if exists (
      select 1
      from unnest(coalesce(p_division_levels, '{}')) requested_level
      where requested_level is null
        or requested_level <> all(array['6U','8U','10U','12U','14U','16U','Juniors','Seniors','JR','SR'])
    ) then raise exception 'unsupported_umpire_eligibility'; end if;
    select coalesce(array_agg(distinct level order by level), '{}') into reviewed_levels
    from unnest(coalesce(p_division_levels, '{}')) level
    where level = any(array['6U','8U','10U','12U','14U','16U','Juniors','Seniors','JR','SR']);
    if cardinality(reviewed_levels) = 0 then raise exception 'umpire_eligibility_required'; end if;
    target := public.approve_pending_umpire(target.id);
    update public.crew_members
      set eligible_levels = reviewed_levels, updated_at = now()
      where organization_id = actor_org and profile_id = target.id;
    return target;
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

-- Approval must flow through approve_pending_account so eligibility cannot be
-- bypassed by directly invoking the historical one-argument helper.
revoke execute on function public.approve_pending_umpire(uuid) from authenticated;
revoke all on function public.approve_pending_account(uuid,boolean,text[]) from public,anon;
grant execute on function public.approve_pending_account(uuid,boolean,text[]) to authenticated;

notify pgrst, 'reload schema';
