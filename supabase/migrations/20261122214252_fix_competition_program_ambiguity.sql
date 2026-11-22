-- The table-returning output name organization_sport_id is also a leagues
-- column. Target the named constraint so PL/pgSQL never resolves the output
-- variable while parsing the upsert conflict target.
create or replace function public.create_competition_program(
  p_sport_code text,
  p_display_name text,
  p_league_name text
)
returns table (organization_sport_id uuid, league_id uuid)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org uuid := public.current_organization_id();
  v_sport_id uuid;
  v_league_id uuid;
  v_sport_code text := lower(btrim(coalesce(p_sport_code, '')));
  v_display_name text := btrim(coalesce(p_display_name, ''));
  v_league_name text := btrim(coalesce(p_league_name, ''));
  v_slug text;
begin
  if v_org is null or not public.is_administrator() then
    raise exception using errcode = '42501', message = 'competition_catalog_administrator_required';
  end if;
  if not exists (select 1 from public.sports where code = v_sport_code and active) then
    raise exception using errcode = 'P0001', message = 'competition_catalog_sport_invalid';
  end if;
  if v_display_name = '' or v_league_name = '' then
    raise exception using errcode = 'P0001', message = 'competition_catalog_name_required';
  end if;

  insert into public.organization_sports (organization_id, sport_code, display_name)
  values (v_org, v_sport_code, v_display_name)
  on conflict (organization_id, sport_code)
  do update set display_name = excluded.display_name, active = true
  returning id into v_sport_id;

  v_slug := trim(both '-' from regexp_replace(lower(v_league_name), '[^a-z0-9]+', '-', 'g'));
  if v_slug = '' then
    raise exception using errcode = 'P0001', message = 'competition_catalog_league_slug_invalid';
  end if;

  insert into public.leagues (organization_id, organization_sport_id, name, slug)
  values (v_org, v_sport_id, v_league_name, v_slug)
  on conflict on constraint leagues_organization_id_organization_sport_id_slug_key
  do update set name = excluded.name, active = true
  returning id into v_league_id;

  return query select v_sport_id, v_league_id;
end;
$$;

revoke all on function public.create_competition_program(text, text, text) from public, anon;
grant execute on function public.create_competition_program(text, text, text) to authenticated;
