-- Keep the team-conflict error distinct from the reservation exclusion
-- constraint that save_league_game translates to league_field_conflict.
create or replace function private.enforce_league_team_schedule_conflict()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_conflicting_game_id uuid;
begin
  if new.game_domain <> 'league'
    or new.home_team_id is null
    or new.away_team_id is null
    or new.lifecycle_status::text in ('cancelled', 'postponed') then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('league-team-schedule:' || new.organization_id::text, 0)
  );

  select game.id
  into v_conflicting_game_id
  from public.games game
  where game.organization_id = new.organization_id
    and game.game_domain = 'league'
    and game.id <> new.id
    and game.lifecycle_status::text not in ('cancelled', 'postponed')
    and (
      game.home_team_id in (new.home_team_id, new.away_team_id)
      or game.away_team_id in (new.home_team_id, new.away_team_id)
    )
    and (game.game_date + game.game_time)
      < (new.game_date + new.game_time + pg_catalog.make_interval(mins => new.duration_minutes))
    and (new.game_date + new.game_time)
      < (game.game_date + game.game_time + pg_catalog.make_interval(mins => game.duration_minutes))
  limit 1;

  if v_conflicting_game_id is not null then
    raise exception using
      errcode = '23514',
      message = 'league_team_conflict',
      detail = 'A participating team already has an overlapping League game.';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_league_team_schedule_conflict()
  from public, anon, authenticated;
grant execute on function private.enforce_league_team_schedule_conflict()
  to service_role;
