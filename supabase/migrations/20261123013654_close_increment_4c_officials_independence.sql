-- Increment 4C closure: Officials scheduling is independent of league catalog,
-- season, and facility-reservation prerequisites. Existing function signature
-- and legacy identifiers remain unchanged.

create or replace function public.import_schedule_games(p_games jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_org uuid := public.current_organization_id();
  v_actor uuid := public.current_profile_id();
  v_item jsonb;
  v_location uuid;
  v_field uuid;
  v_game public.games%rowtype;
  v_imported integer := 0;
  v_skipped integer := 0;
  v_level text;
  v_sport text;
  v_matchup text;
  v_location_name text;
  v_requested_location text;
  v_requested_field text;
  v_external_id text;
  v_assignment_status public.assignment_status;
  v_positions text[];
  v_position text;
  v_allowed constant text[] := array['Plate','Base','U3','U4','Observer','Mentor'];
begin
  if v_org is null then
    raise exception using errcode = '42501', message = 'active_workspace_required';
  end if;
  if not public.is_assigner_or_administrator() then
    raise exception using errcode = '42501', message = 'schedule_import_unauthorized';
  end if;
  if not private.organization_module_enabled(v_org, 'umpire') then
    raise exception using errcode = '42501', message = 'umpire_module_not_enabled';
  end if;
  if jsonb_typeof(p_games) <> 'array' or jsonb_array_length(p_games) = 0 then
    raise exception 'schedule_import_empty';
  end if;

  for v_item in select value from jsonb_array_elements(p_games)
  loop
    if nullif(v_item->>'date', '') is null or nullif(v_item->>'time', '') is null then
      raise exception 'schedule_import_core_details_required';
    end if;
    v_matchup := nullif(btrim(coalesce(v_item->>'matchupDescription', '')), '');
    if v_matchup is null
       and nullif(btrim(coalesce(v_item->>'homeTeam', '')), '') is null
       and nullif(btrim(coalesce(v_item->>'awayTeam', '')), '') is null then
      raise exception 'schedule_import_matchup_required';
    end if;
    if jsonb_typeof(v_item->'positions') <> 'array' or jsonb_array_length(v_item->'positions') = 0 then
      raise exception 'schedule_import_positions_required';
    end if;
    select array_agg(value order by ordinal)
      into v_positions
      from jsonb_array_elements_text(v_item->'positions') with ordinality as position(value, ordinal);
    if cardinality(v_positions) <> cardinality(array(select distinct unnest(v_positions)))
       or exists(select 1 from unnest(v_positions) p where not (p = any(v_allowed))) then
      raise exception 'schedule_import_invalid_positions';
    end if;
  end loop;

  for v_item in select value from jsonb_array_elements(p_games)
  loop
    v_external_id := nullif(btrim(coalesce(v_item->>'externalGameId', '')), '');
    if v_external_id is not null and exists (
      select 1 from public.games
      where organization_id = v_org
        and game_domain = 'officials'
        and legacy_game_id = v_external_id
    ) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    v_level := btrim(coalesce(v_item->>'level', ''));
    if v_level <> ''
       and v_level !~ '^(6|8|10|12|14|16|18)U$'
       and v_level not in ('Juniors','Seniors') then
      raise exception 'schedule_import_unknown_level:%', v_level;
    end if;
    v_sport := coalesce(nullif(btrim(coalesce(v_item->>'sport', '')), ''), 'Baseball');
    v_matchup := nullif(btrim(coalesce(v_item->>'matchupDescription', '')), '');
    v_requested_location := nullif(btrim(coalesce(v_item->>'location', '')), '');
    v_requested_field := nullif(btrim(coalesce(v_item->>'field', '')), '');
    v_location_name := nullif(btrim(coalesce(v_item->>'locationName', '')), '');
    v_location := null;
    v_field := null;

    if v_requested_location is not null then
      select id into v_location
      from public.locations
      where organization_id = v_org
        and lower(name) = lower(v_requested_location)
        and active
      limit 1;
    end if;
    if v_location is not null and v_requested_field is not null then
      select id into v_field
      from public.fields
      where organization_id = v_org
        and location_id = v_location
        and lower(name) = lower(v_requested_field)
        and active
      limit 1;
    end if;
    if v_location is null and v_location_name is null then
      v_location_name := concat_ws(' — ', v_requested_location, v_requested_field);
      v_location_name := nullif(btrim(v_location_name), '');
    elsif v_location is not null and v_field is null and v_requested_field is not null and v_location_name is null then
      v_location_name := v_requested_field;
    end if;

    v_assignment_status := coalesce(nullif(v_item->>'assignmentStatus', ''), 'needs_assignment')::public.assignment_status;
    insert into public.games(
      organization_id, game_domain, sport, season_id, location_id, field_id,
      location_name, legacy_game_id, game_date, game_time, timezone,
      home_team, away_team, level, game_type, lifecycle_status, notes,
      source_metadata, created_by_profile_id
    ) values (
      v_org, 'officials', v_sport, null, v_location, v_field,
      v_location_name, v_external_id, (v_item->>'date')::date,
      (v_item->>'time')::time,
      coalesce(nullif(v_item->>'timezone', ''), (select timezone from public.organizations where id = v_org)),
      nullif(btrim(coalesce(v_item->>'homeTeam', '')), ''),
      nullif(btrim(coalesce(v_item->>'awayTeam', '')), ''),
      v_level, coalesce(nullif(v_item->>'gameType', ''), 'single'),
      coalesce(nullif(v_item->>'lifecycleStatus', ''), 'scheduled')::public.game_lifecycle_status,
      btrim(coalesce(v_item->>'notes', '')),
      jsonb_build_object('importNotes', coalesce(v_item->>'notes', ''), 'matchupDescription', v_matchup),
      v_actor
    ) returning * into v_game;

    for v_position in select value from jsonb_array_elements_text(v_item->'positions')
    loop
      insert into public.game_assignments(organization_id, game_id, position, status)
      values(v_org, v_game.id, v_position, v_assignment_status);
    end loop;
    v_imported := v_imported + 1;
  end loop;

  insert into public.workspace_audit_events(
    organization_id, actor_auth_user_id, action, entity_type, metadata
  ) values (
    v_org, (select auth.uid()), 'games.imported', 'game',
    jsonb_build_object('domain', 'officials', 'imported_count', v_imported, 'skipped_count', v_skipped)
  );

  return jsonb_build_object(
    'importedCount', v_imported,
    'skippedCount', v_skipped,
    'errorCount', 0
  );
end;
$$;

revoke all on function public.import_schedule_games(jsonb) from public, anon;
grant execute on function public.import_schedule_games(jsonb) to authenticated;

comment on function public.import_schedule_games(jsonb) is
  'Imports Officials-domain games using active-workspace authorization without requiring League catalog, season, or facility records.';
