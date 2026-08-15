-- Pilot E5: allow multiple assignments in one season while rejecting exact entries.
do $$
declare constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  where con.conrelid = 'public.official_service_history'::regclass
    and con.contype = 'u'
    and pg_get_constraintdef(con.oid) = 'UNIQUE (organization_id, profile_id, service_year, season_label)';
  if constraint_name is not null then
    execute format('alter table public.official_service_history drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.official_service_history
  add constraint official_service_history_exact_entry_unique
  unique (organization_id, profile_id, service_year, season_label, service_role, level);

create or replace function public.replace_official_service_history(
  p_profile_id uuid,
  p_entries jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_id uuid := public.current_profile_id();
  actor_org uuid := public.current_organization_id();
  entry jsonb;
  entry_year integer;
  entry_season text;
  entry_role public.account_role;
  entry_level text;
begin
  if not public.is_administrator() then raise exception 'administrator_required'; end if;
  if jsonb_typeof(coalesce(p_entries, '[]'::jsonb)) <> 'array' then raise exception 'service_history_array_required'; end if;
  if not exists (select 1 from public.profiles where id = p_profile_id and organization_id = actor_org) then
    raise exception 'profile_not_found';
  end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) item
    group by (item->>'year')::integer,
      lower(btrim(item->>'season')),
      lower(btrim(item->>'role')),
      lower(btrim(item->>'level'))
    having count(*) > 1
  ) then raise exception 'duplicate_service_history_entry'; end if;

  update public.official_service_history set active = false, recorded_by_profile_id = actor_id
  where organization_id = actor_org and profile_id = p_profile_id and active = true;

  for entry in select value from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) loop
    entry_year := (entry->>'year')::integer;
    entry_season := btrim(coalesce(entry->>'season', ''));
    entry_role := nullif(entry->>'role', '')::public.account_role;
    entry_level := btrim(coalesce(entry->>'level', ''));
    if entry_year < 1900 or entry_year > extract(year from current_date)::integer + 2 then raise exception 'invalid_service_year'; end if;
    if entry_season not in ('Spring', 'Summer', 'Fall', 'Winter') or entry_role is null or entry_level = '' then
      raise exception 'service_history_required_fields';
    end if;
    insert into public.official_service_history (
      organization_id, profile_id, service_year, season_label, service_role, level,
      notes, active, recorded_by_profile_id
    ) values (
      actor_org, p_profile_id, entry_year, entry_season, entry_role, entry_level,
      '', true, actor_id
    )
    on conflict (organization_id, profile_id, service_year, season_label, service_role, level) do update
      set active = true, recorded_by_profile_id = excluded.recorded_by_profile_id;
  end loop;
  perform public.sync_official_history_projection(p_profile_id);
end;
$$;

revoke all on function public.replace_official_service_history(uuid,jsonb) from public, anon;
grant execute on function public.replace_official_service_history(uuid,jsonb) to authenticated;
