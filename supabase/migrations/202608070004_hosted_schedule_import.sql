create or replace function public.import_schedule_games(p_games jsonb)
returns jsonb
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  v_org uuid := public.current_organization_id();
  v_actor uuid := public.current_profile_id();
  v_season uuid;
  v_item jsonb;
  v_location uuid;
  v_field uuid;
  v_game public.games%rowtype;
  v_count integer := 0;
  v_level text;
  v_assignment_status public.assignment_status;
begin
  if not public.is_assigner_or_administrator() then raise exception 'schedule_import_unauthorized'; end if;
  if jsonb_typeof(p_games) <> 'array' or jsonb_array_length(p_games) = 0 then raise exception 'schedule_import_empty'; end if;
  select id into v_season from public.seasons where organization_id = v_org and active order by starts_on desc, id limit 1;
  if v_season is null then raise exception 'schedule_import_active_season_required'; end if;

  for v_item in select value from jsonb_array_elements(p_games)
  loop
    v_level := btrim(v_item->>'level');
    if v_level !~ '^(6|8|10|12|14|16)U$' and v_level not in ('Juniors','Seniors') then raise exception 'schedule_import_unknown_level:%', v_level; end if;
    select id into v_location from public.locations where organization_id=v_org and lower(name)=lower(btrim(v_item->>'location')) and active limit 1;
    if v_location is null then raise exception 'schedule_import_unknown_location:%', v_item->>'location'; end if;
    select id into v_field from public.fields where organization_id=v_org and location_id=v_location and lower(name)=lower(btrim(v_item->>'field')) and active limit 1;
    if v_field is null then raise exception 'schedule_import_unknown_field:%', v_item->>'field'; end if;
    v_assignment_status := coalesce(nullif(v_item->>'assignmentStatus',''),'needs_assignment')::public.assignment_status;

    insert into public.games(organization_id,season_id,location_id,field_id,legacy_game_id,game_date,game_time,timezone,home_team,away_team,level,game_type,lifecycle_status,source_metadata,created_by_profile_id)
    values(v_org,v_season,v_location,v_field,nullif(v_item->>'externalGameId',''),(v_item->>'date')::date,(v_item->>'time')::time,coalesce(nullif(v_item->>'timezone',''),'America/New_York'),btrim(v_item->>'homeTeam'),btrim(v_item->>'awayTeam'),v_level,coalesce(nullif(v_item->>'gameType',''),'single'),coalesce(nullif(v_item->>'lifecycleStatus',''),'scheduled')::public.game_lifecycle_status,jsonb_build_object('importNotes',coalesce(v_item->>'notes','')),v_actor)
    returning * into v_game;
    insert into public.game_assignments(organization_id,game_id,position,status) values(v_org,v_game.id,'Plate',v_assignment_status);
    v_count := v_count + 1;
  end loop;
  return jsonb_build_object('importedCount',v_count,'skippedCount',0,'errorCount',0);
end;
$$;
revoke all on function public.import_schedule_games(jsonb) from public;
grant execute on function public.import_schedule_games(jsonb) to authenticated;
