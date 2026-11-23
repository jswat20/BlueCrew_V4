-- Cover tenant-qualified foreign keys used by validation and delete checks.
create index league_schedule_proposals_season_idx
  on public.league_schedule_proposals (organization_id, season_id);
create index league_schedule_proposals_league_idx
  on public.league_schedule_proposals (organization_id, league_id);
create index league_schedule_proposals_division_idx
  on public.league_schedule_proposals (organization_id, division_id);
create index league_schedule_proposals_creator_idx
  on public.league_schedule_proposals (organization_id, created_by_profile_id);

create index league_schedule_proposal_games_home_team_idx
  on public.league_schedule_proposal_games (organization_id, home_team_id);
create index league_schedule_proposal_games_away_team_idx
  on public.league_schedule_proposal_games (organization_id, away_team_id);
create index league_schedule_proposal_games_location_idx
  on public.league_schedule_proposal_games (organization_id, location_id);
create index league_schedule_proposal_games_field_idx
  on public.league_schedule_proposal_games (organization_id, field_id);
create index league_schedule_proposal_games_published_game_idx
  on public.league_schedule_proposal_games (organization_id, published_game_id)
  where published_game_id is not null;
