-- A pending claim is the exclusive reservation for one authoritative assignment
-- position. Closed claim history remains outside this invariant.
--
-- Read-only preflight/audit query (safe to run before applying this migration):
-- select organization_id, assignment_id, count(*) as pending_claim_count
-- from public.assignment_claims
-- where status = 'pending'
-- group by organization_id, assignment_id
-- having count(*) > 1
-- order by organization_id, assignment_id;
--
-- Rollback plan: drop assignment_claims_one_pending_per_assignment and restore
-- submit_assignment_claim(uuid) from 202608070006_open_assignment_read_visibility.sql.

do $$
begin
  if exists (
    select 1
    from public.assignment_claims
    where status = 'pending'
    group by organization_id, assignment_id
    having count(*) > 1
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'pending_claim_reservation_duplicates_require_reconciliation';
  end if;
end;
$$;

create unique index if not exists assignment_claims_one_pending_per_assignment
  on public.assignment_claims (organization_id, assignment_id)
  where status = 'pending';

create or replace function public.submit_assignment_claim(p_assignment_id uuid)
returns public.assignment_claims
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_org uuid := public.current_organization_id();
  v_crew uuid := public.current_crew_member_id();
  v_assignment public.game_assignments%rowtype;
  v_claim public.assignment_claims%rowtype;
  v_game public.games%rowtype;
  v_claimant public.crew_members%rowtype;
begin
  if v_org is null or v_crew is null or public.current_account_role() <> 'umpire' or not public.is_approved_account() then
    raise exception using errcode = 'P0001', message = 'claim_identity_required';
  end if;

  select * into v_assignment
  from public.game_assignments
  where id = p_assignment_id and organization_id = v_org
  for update;
  if not found then raise exception using errcode = 'P0001', message = 'claim_assignment_not_found'; end if;

  select * into v_game from public.games where id = v_assignment.game_id and organization_id = v_org;
  if v_game.id is null then raise exception using errcode = 'P0001', message = 'claim_game_not_found'; end if;

  -- Different positions use different assignment row locks. This per-umpire/game
  -- transaction lock also serializes attempts to claim two positions in one game.
  perform pg_advisory_xact_lock(hashtextextended(v_org::text || ':' || v_game.id::text || ':' || v_crew::text, 0));

  if exists (
    select 1 from public.assignment_claims
    where organization_id = v_org
      and assignment_id = v_assignment.id
      and status = 'pending'
  ) then
    raise exception using errcode = 'P0001', message = 'assignment_position_reserved';
  end if;

  if exists (
    select 1
    from public.assignment_claims claim
    join public.game_assignments claimed_assignment
      on claimed_assignment.organization_id = claim.organization_id
     and claimed_assignment.id = claim.assignment_id
    where claim.organization_id = v_org
      and claimed_assignment.game_id = v_game.id
      and claim.claimant_crew_member_id = v_crew
      and claim.status = 'pending'
  ) then
    raise exception using errcode = 'P0001', message = 'claimant_already_has_pending_game_claim';
  end if;

  if exists (
    select 1 from public.game_assignments assigned
    where assigned.organization_id = v_org
      and assigned.game_id = v_game.id
      and assigned.assigned_crew_member_id = v_crew
      and assigned.status in ('assigned', 'locked')
  ) then
    raise exception using errcode = 'P0001', message = 'claimant_already_assigned_to_game';
  end if;

  select * into v_claimant from public.crew_members where id = v_crew and organization_id = v_org;
  if v_claimant.id is null then raise exception using errcode = 'P0001', message = 'claimant_not_found'; end if;
  if not v_claimant.active or not (v_game.level = any(v_claimant.eligible_levels)) then
    raise exception using errcode = 'P0001', message = 'claim_level_ineligible';
  end if;
  if exists (
    select 1
    from public.game_assignments assigned
    join public.games other_game
      on other_game.organization_id = assigned.organization_id
     and other_game.id = assigned.game_id
    where assigned.organization_id = v_org
      and assigned.assigned_crew_member_id = v_crew
      and assigned.status in ('assigned', 'locked')
      and other_game.id <> v_game.id
      and other_game.game_date = v_game.game_date
      and other_game.game_time = v_game.game_time
  ) then
    raise exception using errcode = 'P0001', message = 'claim_schedule_conflict';
  end if;
  if (
    select count(distinct other_game.id)
    from public.game_assignments assigned
    join public.games other_game
      on other_game.organization_id = assigned.organization_id
     and other_game.id = assigned.game_id
    where assigned.organization_id = v_org
      and assigned.assigned_crew_member_id = v_crew
      and assigned.status in ('assigned', 'locked')
      and other_game.game_date = v_game.game_date
      and other_game.id <> v_game.id
  ) >= 2 then
    raise exception using errcode = 'P0001', message = 'claim_daily_limit_reached';
  end if;
  if v_assignment.locked
     or v_assignment.assigned_crew_member_id is not null
     or v_assignment.status not in ('open_for_claim', 'needs_assignment') then
    raise exception using errcode = 'P0001', message = 'assignment_already_claimed';
  end if;

  insert into public.assignment_claims (organization_id, assignment_id, claimant_crew_member_id, status)
  values (v_org, v_assignment.id, v_crew, 'pending')
  returning * into v_claim;

  update public.game_assignments
  set status = 'pending_approval', updated_at = now()
  where id = v_assignment.id and organization_id = v_org;

  perform public.notify_organization_administrators(
    v_org, 'claim-submitted', 'Game Claimed',
    concat(concat_ws(' ', v_claimant.first_name, v_claimant.last_name), ' claimed ', v_assignment.position, ' for ', v_game.away_team, ' @ ', v_game.home_team, '.'),
    'claims'
  );
  return v_claim;
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'assignment_position_reserved';
end;
$$;

revoke all on function public.submit_assignment_claim(uuid) from public;
grant execute on function public.submit_assignment_claim(uuid) to authenticated;
