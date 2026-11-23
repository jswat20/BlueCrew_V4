-- Increment 5A: atomic League game and field-reservation scheduling.

alter table public.games
  add column league_id uuid,
  add column division_id uuid,
  add column home_team_id uuid,
  add column away_team_id uuid,
  add column duration_minutes integer not null default 90;

alter table public.games
  add constraint games_duration_minutes_check check (duration_minutes between 15 and 1440),
  add foreign key (organization_id, league_id) references public.leagues(organization_id, id) on delete restrict,
  add foreign key (organization_id, division_id) references public.divisions(organization_id, id) on delete restrict,
  add foreign key (organization_id, home_team_id) references public.teams(organization_id, id) on delete restrict,
  add foreign key (organization_id, away_team_id) references public.teams(organization_id, id) on delete restrict,
  add constraint games_distinct_catalog_teams check (home_team_id is null or away_team_id is null or home_team_id <> away_team_id);

create unique index field_reservations_one_active_game_idx
  on public.field_reservations (organization_id, game_id)
  where status = 'active' and game_id is not null;

create or replace function public.save_league_game(
  p_game_id uuid,
  p_sport text,
  p_season_id uuid,
  p_league_id uuid,
  p_division_id uuid,
  p_home_team_id uuid,
  p_away_team_id uuid,
  p_game_date date,
  p_game_time time,
  p_duration_minutes integer,
  p_location_id uuid default null,
  p_field_id uuid default null,
  p_notes text default ''
) returns public.games
language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_org uuid := public.current_organization_id();
  v_actor uuid := public.current_profile_id();
  v_game public.games%rowtype;
  v_existing public.games%rowtype;
  v_timezone text;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_home_name text;
  v_away_name text;
  v_division_name text;
  v_reservation public.field_reservations%rowtype;
begin
  if v_org is null then raise exception using errcode='42501', message='active_workspace_required'; end if;
  if not private.organization_module_enabled(v_org, 'league') then raise exception using errcode='42501', message='league_module_not_enabled'; end if;
  if not public.is_administrator() then raise exception using errcode='42501', message='league_schedule_forbidden'; end if;
  if p_game_date is null or p_game_time is null or p_duration_minutes not between 15 and 1440 then
    raise exception using message='league_game_time_invalid';
  end if;
  if nullif(btrim(coalesce(p_sport,'')),'') is null then raise exception using message='league_game_sport_required'; end if;
  if p_home_team_id is null or p_away_team_id is null or p_home_team_id = p_away_team_id then
    raise exception using message='league_game_teams_invalid';
  end if;
  if (p_location_id is null) <> (p_field_id is null) then raise exception using message='game_location_field_pair_required'; end if;

  select d.name, h.name, a.name into v_division_name, v_home_name, v_away_name
  from public.divisions d
  join public.leagues l on l.organization_id=d.organization_id and l.id=d.league_id
  join public.teams h on h.organization_id=d.organization_id and h.division_id=d.id and h.season_id=d.season_id
  join public.teams a on a.organization_id=d.organization_id and a.division_id=d.id and a.season_id=d.season_id
  where d.organization_id=v_org and d.id=p_division_id and d.league_id=p_league_id and d.season_id=p_season_id
    and l.active and d.active and h.id=p_home_team_id and a.id=p_away_team_id and h.active and a.active;
  if v_division_name is null then raise exception using message='league_catalog_selection_invalid'; end if;

  if p_field_id is not null then
    select l.timezone into v_timezone from public.fields f
    join public.locations l on l.organization_id=f.organization_id and l.id=f.location_id
    where f.organization_id=v_org and f.id=p_field_id and f.location_id=p_location_id
      and f.active and f.status <> 'closed' and l.active and l.status <> 'closed';
    if v_timezone is null then raise exception using message='field_unavailable'; end if;
  else
    select timezone into v_timezone from public.organizations where id=v_org;
  end if;
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=v_timezone) then raise exception using message='invalid_timezone'; end if;
  v_starts_at := (p_game_date + p_game_time) at time zone v_timezone;
  v_ends_at := v_starts_at + make_interval(mins => p_duration_minutes);

  if p_game_id is null then
    insert into public.games(organization_id,game_domain,sport,season_id,league_id,division_id,home_team_id,away_team_id,
      game_date,game_time,timezone,location_id,field_id,home_team,away_team,level,game_type,lifecycle_status,duration_minutes,notes,created_by_profile_id)
    values(v_org,'league',btrim(p_sport),p_season_id,p_league_id,p_division_id,p_home_team_id,p_away_team_id,
      p_game_date,p_game_time,v_timezone,p_location_id,p_field_id,v_home_name,v_away_name,v_division_name,'league','scheduled',p_duration_minutes,btrim(coalesce(p_notes,'')),v_actor)
    returning * into v_game;
  else
    select * into v_existing from public.games where organization_id=v_org and id=p_game_id and game_domain='league' for update;
    if v_existing.id is null then raise exception using message='league_game_not_found'; end if;
    if v_existing.lifecycle_status in ('completed','submitted','approved') then raise exception using message='league_game_locked'; end if;
    update public.games set sport=btrim(p_sport),season_id=p_season_id,league_id=p_league_id,division_id=p_division_id,
      home_team_id=p_home_team_id,away_team_id=p_away_team_id,home_team=v_home_name,away_team=v_away_name,level=v_division_name,
      game_date=p_game_date,game_time=p_game_time,timezone=v_timezone,location_id=p_location_id,field_id=p_field_id,
      duration_minutes=p_duration_minutes,notes=btrim(coalesce(p_notes,'')),updated_at=now()
    where id=p_game_id and organization_id=v_org returning * into v_game;
  end if;

  select * into v_reservation from public.field_reservations
  where organization_id=v_org and game_id=v_game.id and status='active' for update;
  if p_field_id is null then
    if v_reservation.id is not null then
      update public.field_reservations set status='cancelled',cancelled_at=now(),cancelled_by_profile_id=v_actor,updated_at=now()
      where id=v_reservation.id;
    end if;
  elsif v_reservation.id is null then
    insert into public.field_reservations(organization_id,field_id,game_id,reservation_type,title,starts_at,ends_at,notes,created_by_profile_id)
    values(v_org,p_field_id,v_game.id,'game',v_away_name||' @ '||v_home_name,v_starts_at,v_ends_at,btrim(coalesce(p_notes,'')),v_actor);
  else
    update public.field_reservations set field_id=p_field_id,title=v_away_name||' @ '||v_home_name,
      starts_at=v_starts_at,ends_at=v_ends_at,notes=btrim(coalesce(p_notes,'')),updated_at=now()
    where id=v_reservation.id;
  end if;

  insert into public.workspace_audit_events(organization_id,actor_auth_user_id,action,entity_type,entity_id,metadata)
  values(v_org,(select auth.uid()),case when p_game_id is null then 'league_game.created' else 'league_game.updated' end,
    'game',v_game.id,jsonb_build_object('field_id',p_field_id,'starts_at',v_starts_at,'ends_at',v_ends_at));
  return v_game;
exception
  when exclusion_violation or unique_violation then
    raise exception using errcode='23P01', message='league_field_conflict';
end;
$$;

create or replace function public.transition_league_game(p_game_id uuid, p_action text)
returns public.games language plpgsql security definer
set search_path = pg_catalog, public, private as $$
declare v_org uuid:=public.current_organization_id(); v_actor uuid:=public.current_profile_id(); v_game public.games%rowtype;
begin
  if not private.organization_module_enabled(v_org,'league') or not public.is_administrator() then
    raise exception using errcode='42501', message='league_schedule_forbidden';
  end if;
  select * into v_game from public.games where organization_id=v_org and id=p_game_id and game_domain='league' for update;
  if v_game.id is null then raise exception using message='league_game_not_found'; end if;
  if p_action not in ('cancel','postpone','delete') then raise exception using message='league_game_action_invalid'; end if;
  update public.field_reservations set status='cancelled',cancelled_at=now(),cancelled_by_profile_id=v_actor,updated_at=now()
    where organization_id=v_org and game_id=p_game_id and status='active';
  if p_action='delete' then
    delete from public.field_reservations where organization_id=v_org and game_id=p_game_id;
    delete from public.games where organization_id=v_org and id=p_game_id returning * into v_game;
  else
    update public.games set lifecycle_status=(case when p_action='cancel' then 'cancelled' else 'postponed' end)::public.game_lifecycle_status,
      location_id=null,field_id=null,updated_at=now() where organization_id=v_org and id=p_game_id returning * into v_game;
  end if;
  insert into public.workspace_audit_events(organization_id,actor_auth_user_id,action,entity_type,entity_id,metadata)
  values(v_org,(select auth.uid()),'league_game.'||p_action,'game',case when p_action='delete' then null else p_game_id end,jsonb_build_object('game_id',p_game_id));
  return v_game;
end;
$$;

revoke all on function public.save_league_game(uuid,text,uuid,uuid,uuid,uuid,uuid,date,time,integer,uuid,uuid,text) from public,anon;
revoke all on function public.transition_league_game(uuid,text) from public,anon;
grant execute on function public.save_league_game(uuid,text,uuid,uuid,uuid,uuid,uuid,date,time,integer,uuid,uuid,text) to authenticated;
grant execute on function public.transition_league_game(uuid,text) to authenticated;

comment on function public.save_league_game(uuid,text,uuid,uuid,uuid,uuid,uuid,date,time,integer,uuid,uuid,text) is
  'Creates or reschedules a League game and its optional field reservation atomically in the validated active workspace.';
