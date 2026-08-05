create function public.submit_assignment_claim(p_assignment_id uuid)
returns public.assignment_claims
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_organization_id uuid := public.current_organization_id();
  v_crew_member_id uuid := public.current_crew_member_id();
  v_assignment public.game_assignments;
  v_claim public.assignment_claims;
begin
  if v_organization_id is null
    or v_crew_member_id is null
    or public.current_account_role() <> 'umpire'
    or not public.is_approved_account() then
    raise exception using errcode = 'P0001', message = 'claim_identity_required';
  end if;

  select * into v_assignment
  from public.game_assignments
  where id = p_assignment_id
    and organization_id = v_organization_id
  for update;

  if v_assignment.id is null
    or v_assignment.status <> 'open_for_claim'
    or v_assignment.locked then
    raise exception using errcode = 'P0001', message = 'assignment_already_claimed';
  end if;

  insert into public.assignment_claims (
    organization_id,
    assignment_id,
    claimant_crew_member_id,
    status
  ) values (
    v_organization_id,
    v_assignment.id,
    v_crew_member_id,
    'pending'
  )
  returning * into v_claim;

  update public.game_assignments
  set status = 'pending_approval', updated_at = now()
  where id = v_assignment.id
    and organization_id = v_organization_id;

  return v_claim;
end;
$$;

create function public.decide_assignment_claim(
  p_assignment_id uuid,
  p_decision public.claim_status,
  p_reason text default null
)
returns public.game_assignments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_organization_id uuid := public.current_organization_id();
  v_profile_id uuid := public.current_profile_id();
  v_assignment public.game_assignments;
  v_claim public.assignment_claims;
begin
  if v_organization_id is null
    or v_profile_id is null
    or not public.is_assigner_or_administrator() then
    raise exception using errcode = 'P0001', message = 'claim_decision_forbidden';
  end if;

  if p_decision is null or p_decision not in ('approved', 'rejected') then
    raise exception using errcode = 'P0001', message = 'invalid_claim_decision';
  end if;

  select * into v_assignment
  from public.game_assignments
  where id = p_assignment_id
    and organization_id = v_organization_id
  for update;

  if v_assignment.id is null
    or v_assignment.status <> 'pending_approval'
    or v_assignment.assigned_crew_member_id is not null
    or v_assignment.locked then
    raise exception using errcode = 'P0001', message = 'claim_no_longer_pending';
  end if;

  select * into v_claim
  from public.assignment_claims
  where organization_id = v_organization_id
    and assignment_id = v_assignment.id
    and status = 'pending'
  order by claimed_at, id
  limit 1
  for update;

  if v_claim.id is null then
    raise exception using errcode = 'P0001', message = 'claim_no_longer_pending';
  end if;

  update public.assignment_claims
  set status = p_decision,
      decision_by_profile_id = v_profile_id,
      decision_reason = nullif(btrim(p_reason), ''),
      decided_at = now(),
      updated_at = now()
  where id = v_claim.id
    and organization_id = v_organization_id;

  if p_decision = 'approved' then
    update public.assignment_claims
    set status = 'rejected',
        decision_by_profile_id = v_profile_id,
        decision_reason = 'Another claim was approved.',
        decided_at = now(),
        updated_at = now()
    where organization_id = v_organization_id
      and assignment_id = v_assignment.id
      and status = 'pending';

    update public.game_assignments
    set status = 'assigned',
        assigned_crew_member_id = v_claim.claimant_crew_member_id,
        locked = false,
        updated_at = now()
    where id = v_assignment.id
      and organization_id = v_organization_id
    returning * into v_assignment;
  else
    update public.game_assignments
    set status = 'open_for_claim',
        assigned_crew_member_id = null,
        locked = false,
        updated_at = now()
    where id = v_assignment.id
      and organization_id = v_organization_id
    returning * into v_assignment;
  end if;

  return v_assignment;
end;
$$;

revoke all on function public.submit_assignment_claim(uuid) from public;
revoke all on function public.decide_assignment_claim(uuid, public.claim_status, text) from public;
grant execute on function public.submit_assignment_claim(uuid) to authenticated;
grant execute on function public.decide_assignment_claim(uuid, public.claim_status, text) to authenticated;

drop policy if exists claims_insert_own on public.assignment_claims;
revoke insert, update, delete on public.assignment_claims from authenticated;
