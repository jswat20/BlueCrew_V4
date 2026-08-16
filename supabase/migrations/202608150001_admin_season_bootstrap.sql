-- Admin season bootstrap: atomic season creation and activation for the current organization.

create or replace function public.create_season(
  p_name text,
  p_starts_on date,
  p_ends_on date,
  p_active boolean default false
)
returns public.seasons
language plpgsql
set search_path = public
as $$
declare
  v_organization_id uuid := public.current_organization_id();
  v_season public.seasons;
begin
  if not public.is_administrator() then
    raise exception 'administrator_required';
  end if;

  if v_organization_id is null then
    raise exception 'organization_required';
  end if;

  if nullif(btrim(p_name), '') is null then
    raise exception 'season_name_required';
  end if;

  if p_starts_on is null or p_ends_on is null then
    raise exception 'season_dates_required';
  end if;

  if p_ends_on < p_starts_on then
    raise exception 'season_date_range_invalid';
  end if;

  if p_active then
    update public.seasons
      set active = false,
          updated_at = now()
      where organization_id = v_organization_id
        and active = true;
  end if;

  insert into public.seasons (organization_id, name, starts_on, ends_on, active)
  values (v_organization_id, btrim(p_name), p_starts_on, p_ends_on, p_active)
  returning * into v_season;

  return v_season;
end;
$$;

create or replace function public.activate_season(p_season_id uuid)
returns public.seasons
language plpgsql
set search_path = public
as $$
declare
  v_organization_id uuid := public.current_organization_id();
  v_season public.seasons;
begin
  if not public.is_administrator() then
    raise exception 'administrator_required';
  end if;

  if v_organization_id is null then
    raise exception 'organization_required';
  end if;

  if not exists (
    select 1
    from public.seasons
    where id = p_season_id
      and organization_id = v_organization_id
  ) then
    raise exception 'season_not_found';
  end if;

  update public.seasons
    set active = false,
        updated_at = now()
    where organization_id = v_organization_id
      and active = true
      and id <> p_season_id;

  update public.seasons
    set active = true,
        updated_at = now()
    where id = p_season_id
      and organization_id = v_organization_id
  returning * into v_season;

  return v_season;
end;
$$;

revoke all on function public.create_season(text, date, date, boolean) from public;
revoke all on function public.activate_season(uuid) from public;
grant execute on function public.create_season(text, date, date, boolean) to authenticated;
grant execute on function public.activate_season(uuid) to authenticated;
