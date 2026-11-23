-- Tournament-only workspaces do not require League seasons.
create or replace function public.schedule_tournament_bracket_game(p_bracket_game_id uuid,p_game_date date,p_game_time time,p_location_id uuid,p_field_id uuid)
returns public.games language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_org uuid:=private.require_tournament_admin(); v_bg public.tournament_bracket_games%rowtype; v_div public.tournament_divisions%rowtype; v_t public.tournaments%rowtype; v_game public.games%rowtype; v_starts timestamptz; v_ends timestamptz;
begin
  select * into v_bg from public.tournament_bracket_games where organization_id=v_org and id=p_bracket_game_id for update;
  if v_bg.id is null or v_bg.home_team_id is null or v_bg.away_team_id is null then raise exception 'tournament_bracket_matchup_incomplete'; end if;
  if v_bg.canonical_game_id is not null then select * into v_game from public.games where organization_id=v_org and id=v_bg.canonical_game_id; return v_game; end if;
  select * into v_div from public.tournament_divisions where organization_id=v_org and id=v_bg.division_id;
  select * into v_t from public.tournaments where organization_id=v_org and id=v_bg.tournament_id;
  v_starts:=make_timestamptz(extract(year from p_game_date)::int,extract(month from p_game_date)::int,extract(day from p_game_date)::int,extract(hour from p_game_time)::int,extract(minute from p_game_time)::int,0,v_t.timezone);
  v_ends:=v_starts+make_interval(mins=>v_div.game_duration_minutes);
  insert into public.games(organization_id,season_id,location_id,field_id,game_date,game_time,timezone,home_team,away_team,level,game_type,created_by_profile_id,game_domain,duration_minutes,tournament_id,tournament_division_id,tournament_home_team_id,tournament_away_team_id)
  select v_org,null,p_location_id,p_field_id,p_game_date,p_game_time,v_t.timezone,h.name,a.name,v_div.name,'tournament_elimination',public.current_profile_id(),'tournament',v_div.game_duration_minutes,v_t.id,v_div.id,h.id,a.id
  from public.tournament_teams h join public.tournament_teams a on a.organization_id=h.organization_id where h.organization_id=v_org and h.id=v_bg.home_team_id and a.id=v_bg.away_team_id returning * into v_game;
  insert into public.field_reservations(organization_id,field_id,game_id,reservation_type,title,starts_at,ends_at,notes,created_by_profile_id)
  values(v_org,p_field_id,v_game.id,'tournament',v_t.name||' elimination game',v_starts,v_ends,'Tournament bracket',public.current_profile_id());
  update public.tournament_bracket_games set canonical_game_id=v_game.id,updated_at=now() where id=v_bg.id;
  update public.tournament_brackets set status='in_progress',updated_at=now() where id=v_bg.bracket_id;
  insert into public.workspace_audit_events(organization_id,actor_auth_user_id,action,entity_type,entity_id,metadata)
  values(v_org,(select auth.uid()),'tournament.bracket_game_scheduled','tournament_bracket_game',v_bg.id,jsonb_build_object('game_id',v_game.id,'field_id',p_field_id));
  return v_game;
exception when exclusion_violation or unique_violation then raise exception using errcode='23P01',message='tournament_field_conflict';
end $$;
revoke all on function public.schedule_tournament_bracket_game(uuid,date,time,uuid,uuid) from public,anon;
grant execute on function public.schedule_tournament_bracket_game(uuid,date,time,uuid,uuid) to authenticated;
