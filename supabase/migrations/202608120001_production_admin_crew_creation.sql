create or replace function public.create_crew_member(
  p_first_name text,
  p_last_name text,
  p_email text default '',
  p_phone text default '',
  p_active boolean default true,
  p_eligible_levels text[] default '{}',
  p_preferences jsonb default '{}'::jsonb,
  p_notes text default ''
)
returns public.crew_members
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_organization_id uuid := public.current_organization_id();
  v_crew_member public.crew_members%rowtype;
begin
  if not public.is_administrator() then
    raise exception 'administrator_required';
  end if;
  if nullif(btrim(coalesce(p_first_name, '')), '') is null
    or nullif(btrim(coalesce(p_last_name, '')), '') is null then
    raise exception 'crew_name_required';
  end if;

  insert into public.crew_members (
    organization_id, first_name, last_name, email, phone, active,
    eligible_levels, preferences, notes
  ) values (
    v_organization_id, btrim(p_first_name), btrim(p_last_name),
    btrim(coalesce(p_email, '')), btrim(coalesce(p_phone, '')), coalesce(p_active, true),
    coalesce(p_eligible_levels, '{}'), coalesce(p_preferences, '{}'::jsonb), btrim(coalesce(p_notes, ''))
  )
  returning * into v_crew_member;

  return v_crew_member;
end;
$$;

revoke all on function public.create_crew_member(text, text, text, text, boolean, text[], jsonb, text) from public;
grant execute on function public.create_crew_member(text, text, text, text, boolean, text[], jsonb, text) to authenticated;
