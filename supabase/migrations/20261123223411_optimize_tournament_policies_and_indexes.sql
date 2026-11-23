-- Keep Tournament reads available to entitled workspace members without
-- evaluating a redundant administrator SELECT policy. Mutations still fail
-- closed at both RLS and the RPC authorization boundary.
do $$
declare
  v_table text;
  v_predicate text := 'organization_id=public.current_organization_id() and private.organization_module_enabled(organization_id,''tournament'') and public.is_administrator()';
begin
  foreach v_table in array array[
    'tournaments','tournament_divisions','tournament_teams','tournament_pools',
    'tournament_pool_memberships','tournament_schedule_proposals',
    'tournament_schedule_proposal_games'
  ] loop
    execute format('drop policy %I on public.%I',v_table||'_manage',v_table);
    execute format('create policy %I on public.%I for insert to authenticated with check (%s)',v_table||'_insert_admin',v_table,v_predicate);
    execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)',v_table||'_update_admin',v_table,v_predicate,v_predicate);
    execute format('create policy %I on public.%I for delete to authenticated using (%s)',v_table||'_delete_admin',v_table,v_predicate);
  end loop;
end $$;

create index tournaments_creator_idx
  on public.tournaments(organization_id,created_by_profile_id);
create index tournament_teams_division_idx
  on public.tournament_teams(organization_id,division_id);
create index tournament_pools_division_idx
  on public.tournament_pools(organization_id,division_id);
create index tournament_proposals_creator_idx
  on public.tournament_schedule_proposals(organization_id,created_by_profile_id);
create index tournament_proposal_games_tournament_idx
  on public.tournament_schedule_proposal_games(organization_id,tournament_id);
create index tournament_proposal_games_division_idx
  on public.tournament_schedule_proposal_games(organization_id,division_id);
create index tournament_proposal_games_pool_idx
  on public.tournament_schedule_proposal_games(organization_id,pool_id);
create index tournament_proposal_games_location_idx
  on public.tournament_schedule_proposal_games(organization_id,location_id);
