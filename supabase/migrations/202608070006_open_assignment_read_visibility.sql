-- Approved active umpires need the complete own-organization open-slot snapshot.
-- Eligibility remains an application/RPC concern; this policy grants SELECT only.

create policy assignments_select_open_needs_assignment
on public.game_assignments
for select
to authenticated
using (
  organization_id = public.current_organization_id()
  and public.current_account_role() = 'umpire'
  and public.is_approved_account()
  and status = 'needs_assignment'
  and assigned_crew_member_id is null
  and locked = false
  and exists (
    select 1
    from public.crew_members crew
    where crew.organization_id = game_assignments.organization_id
      and crew.id = public.current_crew_member_id()
      and crew.active = true
  )
  and exists (
    select 1
    from public.games game
    where game.organization_id = game_assignments.organization_id
      and game.id = game_assignments.game_id
  )
);

-- Keep the authoritative command consistent with discovery for fresh imports.
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
  select * into v_claimant from public.crew_members where id = v_crew and organization_id = v_org;
  if v_game.id is null then raise exception using errcode = 'P0001', message = 'claim_game_not_found'; end if;
  if v_claimant.id is null then raise exception using errcode = 'P0001', message = 'claimant_not_found'; end if;
  if not v_claimant.active or not (v_game.level = any(v_claimant.eligible_levels)) then
    raise exception using errcode = 'P0001', message = 'claim_level_ineligible';
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
end;
$$;

revoke all on function public.submit_assignment_claim(uuid) from public;
grant execute on function public.submit_assignment_claim(uuid) to authenticated;
