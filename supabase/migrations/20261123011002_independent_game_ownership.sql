-- Increment 4C: independent, tenant-safe game ownership.
-- Existing umpire scheduling rows retain their identifiers and relationships.

alter table public.games
  add column game_domain text not null default 'officials',
  add column sport text,
  add column location_name text,
  add column notes text not null default '';

alter table public.games
  add constraint games_domain_check
    check (game_domain in ('league', 'officials', 'tournament')),
  add constraint games_sport_not_blank
    check (sport is null or nullif(btrim(sport), '') is not null),
  add constraint games_location_name_not_blank
    check (location_name is null or nullif(btrim(location_name), '') is not null);

alter table public.games alter column season_id drop not null;
alter table public.games alter column location_id drop not null;
alter table public.games alter column field_id drop not null;

alter table public.games drop constraint if exists games_home_team_check;
alter table public.games drop constraint if exists games_away_team_check;
alter table public.games alter column home_team drop not null;
alter table public.games alter column away_team drop not null;
alter table public.games
  add constraint games_home_team_not_blank check (home_team is null or nullif(btrim(home_team), '') is not null),
  add constraint games_away_team_not_blank check (away_team is null or nullif(btrim(away_team), '') is not null),
  add constraint games_distinct_participants check (
    home_team is null or away_team is null or home_team <> away_team
  );

create index games_organization_domain_date_idx
  on public.games (organization_id, game_domain, game_date, game_time);

create or replace function private.game_domain_module(p_game_domain text)
returns text language sql immutable
set search_path = pg_catalog
as $$
  select case p_game_domain
    when 'league' then 'league'
    when 'officials' then 'umpire'
    when 'tournament' then 'tournament'
  end
$$;

create or replace function private.enforce_game_domain_entitlement()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, private as $$
declare
  v_organization_id uuid := case when tg_op = 'DELETE' then old.organization_id else new.organization_id end;
  v_domain text := case when tg_op = 'DELETE' then old.game_domain else new.game_domain end;
  v_active_organization_id uuid := public.current_organization_id();
begin
  if (select auth.uid()) is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if v_active_organization_id is null or v_organization_id <> v_active_organization_id then
    raise exception using errcode = '42501', message = 'active_workspace_required';
  end if;
  if tg_op = 'UPDATE' and new.game_domain <> old.game_domain then
    raise exception using errcode = '42501', message = 'game_domain_immutable';
  end if;
  if not private.organization_module_enabled(v_organization_id, private.game_domain_module(v_domain)) then
    raise exception using errcode = '42501', message = 'game_domain_module_not_enabled';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end; $$;

revoke all on function private.game_domain_module(text) from public, anon, authenticated;
revoke all on function private.enforce_game_domain_entitlement() from public, anon, authenticated;
grant execute on function private.game_domain_module(text) to service_role;

drop trigger if exists games_require_domain_entitlement on public.games;
create trigger games_require_domain_entitlement
before insert or update or delete on public.games
for each row execute function private.enforce_game_domain_entitlement();

create or replace function private.enforce_assignment_officials_domain()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public as $$
declare v_game_domain text;
begin
  select g.game_domain into v_game_domain
  from public.games g
  where g.organization_id = new.organization_id and g.id = new.game_id;
  if v_game_domain is distinct from 'officials' then
    raise exception using errcode = '42501', message = 'officials_game_required';
  end if;
  return new;
end; $$;
revoke all on function private.enforce_assignment_officials_domain() from public, anon, authenticated;
drop trigger if exists game_assignments_require_officials_domain on public.game_assignments;
create trigger game_assignments_require_officials_domain
before insert or update of organization_id, game_id on public.game_assignments
for each row execute function private.enforce_assignment_officials_domain();

create or replace function private.enforce_reservation_game_domain()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public as $$
declare v_game_domain text;
begin
  if new.game_id is null then return new; end if;
  select g.game_domain into v_game_domain
  from public.games g
  where g.organization_id = new.organization_id and g.id = new.game_id;
  if v_game_domain not in ('league', 'tournament') then
    raise exception using errcode = '42501', message = 'reservation_game_domain_not_supported';
  end if;
  return new;
end; $$;
revoke all on function private.enforce_reservation_game_domain() from public, anon, authenticated;
drop trigger if exists field_reservations_require_schedulable_game_domain on public.field_reservations;
create trigger field_reservations_require_schedulable_game_domain
before insert or update of organization_id, game_id on public.field_reservations
for each row execute function private.enforce_reservation_game_domain();

drop policy if exists games_manage_assigners on public.games;
create policy games_insert_domain_manager on public.games for insert to authenticated
with check (
  organization_id = (select public.current_organization_id())
  and (
    (game_domain = 'officials' and (select public.is_assigner_or_administrator()))
    or (game_domain in ('league', 'tournament') and (select public.is_administrator()))
  )
);
create policy games_update_domain_manager on public.games for update to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (case when game_domain = 'officials' then (select public.is_assigner_or_administrator()) else (select public.is_administrator()) end)
)
with check (
  organization_id = (select public.current_organization_id())
  and (case when game_domain = 'officials' then (select public.is_assigner_or_administrator()) else (select public.is_administrator()) end)
);
create policy games_delete_domain_manager on public.games for delete to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (case when game_domain = 'officials' then (select public.is_assigner_or_administrator()) else (select public.is_administrator()) end)
);

create or replace function public.create_domain_game(
  p_game_domain text,
  p_sport text,
  p_game_date date,
  p_game_time time,
  p_timezone text default null,
  p_location_id uuid default null,
  p_field_id uuid default null,
  p_location_name text default null,
  p_home_team text default null,
  p_away_team text default null,
  p_level text default '',
  p_game_type text default 'single',
  p_notes text default ''
) returns public.games language plpgsql security definer
set search_path = pg_catalog, public, private as $$
declare
  v_org uuid := public.current_organization_id();
  v_game public.games%rowtype;
  v_location_id uuid;
begin
  if v_org is null then raise exception using errcode='42501', message='active_workspace_required'; end if;
  if p_game_domain not in ('league','officials','tournament') then raise exception using message='game_domain_invalid'; end if;
  if not private.organization_module_enabled(v_org, private.game_domain_module(p_game_domain)) then
    raise exception using errcode='42501', message='game_domain_module_not_enabled';
  end if;
  if (p_game_domain = 'officials' and not public.is_assigner_or_administrator())
     or (p_game_domain <> 'officials' and not public.is_administrator()) then
    raise exception using errcode='42501', message='game_management_forbidden';
  end if;
  if p_game_date is null or p_game_time is null or nullif(btrim(coalesce(p_sport,'')),'') is null then
    raise exception using message='game_core_details_required';
  end if;
  if (p_location_id is null) <> (p_field_id is null) then
    raise exception using message='game_location_field_pair_required';
  end if;
  if p_field_id is not null then
    select f.location_id into v_location_id from public.fields f
    where f.organization_id=v_org and f.location_id=p_location_id and f.id=p_field_id and f.active;
    if v_location_id is null then raise exception using message='game_field_not_found'; end if;
  end if;
  insert into public.games(
    organization_id, game_domain, sport, game_date, game_time, timezone,
    location_id, field_id, location_name, home_team, away_team, level,
    game_type, notes, created_by_profile_id
  ) values (
    v_org, p_game_domain, btrim(p_sport), p_game_date, p_game_time,
    coalesce(nullif(btrim(coalesce(p_timezone,'')),''),(select timezone from public.organizations where id=v_org)),
    p_location_id, p_field_id, nullif(btrim(coalesce(p_location_name,'')),''),
    nullif(btrim(coalesce(p_home_team,'')),''), nullif(btrim(coalesce(p_away_team,'')),''),
    btrim(coalesce(p_level,'')), coalesce(nullif(btrim(coalesce(p_game_type,'')),''),'single'),
    btrim(coalesce(p_notes,'')), public.current_profile_id()
  ) returning * into v_game;
  insert into public.workspace_audit_events(organization_id,actor_auth_user_id,action,entity_type,entity_id,metadata)
  values(v_org,(select auth.uid()),'game.created','game',v_game.id,jsonb_build_object('domain',p_game_domain));
  return v_game;
end; $$;

revoke all on function public.create_domain_game(text,text,date,time,text,uuid,uuid,text,text,text,text,text,text) from public, anon;
grant execute on function public.create_domain_game(text,text,date,time,text,uuid,uuid,text,text,text,text,text,text) to authenticated;

-- Legacy import is explicitly an Officials-domain operation.
create or replace function public.import_schedule_games(p_games jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare
  v_org uuid:=public.current_organization_id(); v_actor uuid:=public.current_profile_id(); v_season uuid;
  v_item jsonb; v_location uuid; v_field uuid; v_game public.games%rowtype; v_count integer:=0;
  v_level text; v_assignment_status public.assignment_status; v_positions text[]; v_position text;
  v_allowed constant text[] := array['Plate','Base','U3','U4','Observer','Mentor'];
begin
  if not public.is_assigner_or_administrator() then raise exception 'schedule_import_unauthorized'; end if;
  if not private.organization_module_enabled(v_org,'umpire') then raise exception using errcode='42501', message='umpire_module_not_enabled'; end if;
  if jsonb_typeof(p_games)<>'array' or jsonb_array_length(p_games)=0 then raise exception 'schedule_import_empty'; end if;
  select id into v_season from public.seasons where organization_id=v_org and active order by starts_on desc,id limit 1;
  if v_season is null then raise exception 'schedule_import_active_season_required'; end if;
  for v_item in select value from jsonb_array_elements(p_games) loop
    if jsonb_typeof(v_item->'positions')<>'array' or jsonb_array_length(v_item->'positions')=0 then raise exception 'schedule_import_positions_required'; end if;
    select array_agg(value order by ordinal) into v_positions from jsonb_array_elements_text(v_item->'positions') with ordinality as position(value,ordinal);
    if cardinality(v_positions)<>cardinality(array(select distinct unnest(v_positions))) or exists(select 1 from unnest(v_positions) p where not (p=any(v_allowed))) then raise exception 'schedule_import_invalid_positions'; end if;
  end loop;
  for v_item in select value from jsonb_array_elements(p_games) loop
    v_level:=btrim(v_item->>'level');
    if v_level !~ '^(6|8|10|12|14|16)U$' and v_level not in ('Juniors','Seniors') then raise exception 'schedule_import_unknown_level:%',v_level; end if;
    select id into v_location from public.locations where organization_id=v_org and lower(name)=lower(btrim(v_item->>'location')) and active limit 1;
    if v_location is null then raise exception 'schedule_import_unknown_location:%',v_item->>'location'; end if;
    select id into v_field from public.fields where organization_id=v_org and location_id=v_location and lower(name)=lower(btrim(v_item->>'field')) and active limit 1;
    if v_field is null then raise exception 'schedule_import_unknown_field:%',v_item->>'field'; end if;
    v_assignment_status:=coalesce(nullif(v_item->>'assignmentStatus',''),'needs_assignment')::public.assignment_status;
    insert into public.games(organization_id,game_domain,season_id,location_id,field_id,legacy_game_id,game_date,game_time,timezone,home_team,away_team,level,game_type,lifecycle_status,source_metadata,created_by_profile_id)
    values(v_org,'officials',v_season,v_location,v_field,nullif(v_item->>'externalGameId',''),(v_item->>'date')::date,(v_item->>'time')::time,coalesce(nullif(v_item->>'timezone',''),'America/New_York'),btrim(v_item->>'homeTeam'),btrim(v_item->>'awayTeam'),v_level,coalesce(nullif(v_item->>'gameType',''),'single'),coalesce(nullif(v_item->>'lifecycleStatus',''),'scheduled')::public.game_lifecycle_status,jsonb_build_object('importNotes',coalesce(v_item->>'notes','')),v_actor) returning * into v_game;
    for v_position in select value from jsonb_array_elements_text(v_item->'positions') loop
      insert into public.game_assignments(organization_id,game_id,position,status) values(v_org,v_game.id,v_position,v_assignment_status);
    end loop;
    v_count:=v_count+1;
  end loop;
  return jsonb_build_object('importedCount',v_count,'skippedCount',0,'errorCount',0);
end; $$;
revoke all on function public.import_schedule_games(jsonb) from public, anon;
grant execute on function public.import_schedule_games(jsonb) to authenticated;

comment on column public.games.game_domain is
  'Owning module boundary. Existing rows are backfilled as officials; domain is immutable after creation.';
