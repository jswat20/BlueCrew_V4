create or replace function public.get_public_tournament_pool_standings(p_organization_id uuid,p_pool_id uuid)
returns jsonb language sql security definer stable
set search_path=pg_catalog,public as $$
  with rules as (
    select coalesce(r.win_points,3) win_points,coalesce(r.tie_points,1) tie_points,coalesce(r.loss_points,0) loss_points
    from public.tournament_pools p left join public.tournament_scoring_rules r
      on r.organization_id=p.organization_id and r.division_id=p.division_id
    where p.organization_id=p_organization_id and p.id=p_pool_id
  ), members as (
    select tm.id team_id,tm.name
    from public.tournament_pool_memberships pm join public.tournament_teams tm
      on tm.organization_id=pm.organization_id and tm.id=pm.team_id
    where pm.organization_id=p_organization_id and pm.pool_id=p_pool_id
  ), totals as (
    select m.team_id,m.name,count(r.id) filter(where r.result_status in ('final','forfeited')) games_played,
      count(*) filter(where r.winner_team_id=m.team_id and r.result_status in ('final','forfeited')) wins,
      count(*) filter(where r.winner_team_id is not null and r.winner_team_id<>m.team_id and r.result_status in ('final','forfeited')) losses,
      count(*) filter(where r.winner_team_id is null and r.result_status='final') ties,
      coalesce(sum(case when g.tournament_home_team_id=m.team_id then r.home_score when g.tournament_away_team_id=m.team_id then r.away_score end) filter(where r.result_status in ('final','forfeited')),0) points_for,
      coalesce(sum(case when g.tournament_home_team_id=m.team_id then r.away_score when g.tournament_away_team_id=m.team_id then r.home_score end) filter(where r.result_status in ('final','forfeited')),0) points_against
    from members m left join public.games g on g.organization_id=p_organization_id and g.tournament_pool_id=p_pool_id and m.team_id in(g.tournament_home_team_id,g.tournament_away_team_id)
    left join public.tournament_game_results r on r.organization_id=g.organization_id and r.game_id=g.id group by m.team_id,m.name
  ), scored as (
    select totals.*,(wins*rules.win_points+ties*rules.tie_points+losses*rules.loss_points) standings_points
    from totals cross join rules
  ) select coalesce(jsonb_agg(jsonb_build_object('seed',seed,'team_id',team_id,'name',name,'games_played',games_played,'wins',wins,'losses',losses,'ties',ties,'standings_points',standings_points,'points_for',points_for,'points_against',points_against,'score_differential',points_for-points_against) order by seed),'[]'::jsonb)
  from (select scored.*,row_number() over(order by standings_points desc,wins desc,(points_for-points_against) desc,points_for desc,name)::integer seed from scored) ranked;
$$;

revoke all on function public.get_public_tournament_pool_standings(uuid,uuid) from public,anon,authenticated;
