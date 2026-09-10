-- Authoritative, organization-scoped hosted schedule deletion.
create or replace function public.delete_schedule_game(p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_organization_id uuid := public.current_organization_id();
  v_profile_id uuid := public.current_profile_id();
  v_game public.games%rowtype;
  v_assignment_count integer := 0;
  v_claim_count integer := 0;
  v_deleted_count integer := 0;
begin
  if auth.uid() is null
     or v_organization_id is null
     or v_profile_id is null
     or not public.is_assigner_or_administrator() then
    raise exception using errcode = 'P0001', message = 'game_delete_forbidden';
  end if;

  select * into v_game
  from public.games
  where id = p_game_id
    and organization_id = v_organization_id
  for update;

  if v_game.id is null then
    return jsonb_build_object(
      'status', 'already_absent',
      'deleted', false,
      'gameId', p_game_id,
      'deletedGameCount', 0,
      'deletedAssignmentCount', 0,
      'deletedClaimCount', 0
    );
  end if;

  select count(*) into v_assignment_count
  from public.game_assignments
  where game_id = v_game.id
    and organization_id = v_organization_id;

  select count(*) into v_claim_count
  from public.assignment_claims claim
  join public.game_assignments assignment
    on assignment.organization_id = claim.organization_id
   and assignment.id = claim.assignment_id
  where assignment.game_id = v_game.id
    and assignment.organization_id = v_organization_id;

  delete from public.games
  where id = v_game.id
    and organization_id = v_organization_id;
  get diagnostics v_deleted_count = row_count;

  if v_deleted_count <> 1 then
    raise exception using errcode = 'P0001', message = 'game_delete_not_confirmed';
  end if;

  return jsonb_build_object(
    'status', 'deleted',
    'deleted', true,
    'gameId', v_game.id,
    'deletedGameCount', v_deleted_count,
    'deletedAssignmentCount', v_assignment_count,
    'deletedClaimCount', v_claim_count
  );
end;
$$;

revoke all on function public.delete_schedule_game(uuid) from public, anon, authenticated;
grant execute on function public.delete_schedule_game(uuid) to authenticated;
