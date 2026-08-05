-- Milestone 3A: authenticated own-availability transactional mutations.

create function public.upsert_own_availability(
  p_availability_date date,
  p_status public.availability_status,
  p_starts_at time default null,
  p_ends_at time default null,
  p_availability_id uuid default null
)
returns public.availability
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_organization_id uuid := public.current_organization_id();
  v_crew_member_id uuid := public.current_crew_member_id();
  saved public.availability%rowtype;
begin
  if v_organization_id is null or v_crew_member_id is null or not public.is_approved_account() then
    raise exception 'An approved linked crew account is required';
  end if;
  if p_availability_date is null
    or ((p_starts_at is null) <> (p_ends_at is null))
    or (p_starts_at is not null and p_ends_at <= p_starts_at) then
    raise exception 'A valid availability date and time window are required';
  end if;

  if p_availability_id is not null then
    update public.availability
    set availability_date = p_availability_date,
        status = p_status,
        starts_at = p_starts_at,
        ends_at = p_ends_at
    where id = p_availability_id
      and organization_id = v_organization_id
      and crew_member_id = v_crew_member_id
    returning * into saved;
    if not found then raise exception 'Availability entry was not found'; end if;
  else
    insert into public.availability (
      organization_id, crew_member_id, availability_date, status, starts_at, ends_at
    ) values (
      v_organization_id, v_crew_member_id, p_availability_date, p_status, p_starts_at, p_ends_at
    )
    on conflict (organization_id, crew_member_id, availability_date, starts_at, ends_at)
    do update set status = excluded.status
    returning * into saved;
  end if;
  return saved;
end;
$$;

create function public.set_own_availability_range(
  p_start_date date,
  p_end_date date,
  p_status public.availability_status
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_organization_id uuid := public.current_organization_id();
  v_crew_member_id uuid := public.current_crew_member_id();
  affected integer;
begin
  if v_organization_id is null or v_crew_member_id is null or not public.is_approved_account() then
    raise exception 'An approved linked crew account is required';
  end if;
  if p_start_date is null or p_end_date is null or p_start_date > p_end_date then
    raise exception 'A valid availability date range is required';
  end if;

  insert into public.availability (
    organization_id, crew_member_id, availability_date, status, starts_at, ends_at
  )
  select v_organization_id, v_crew_member_id, day_value::date, p_status, null, null
  from generate_series(p_start_date, p_end_date, interval '1 day') day_value
  on conflict (organization_id, crew_member_id, availability_date, starts_at, ends_at)
  do update set status = excluded.status;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

create function public.copy_own_availability_week(
  p_source_start_date date,
  p_target_start_date date
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_organization_id uuid := public.current_organization_id();
  v_crew_member_id uuid := public.current_crew_member_id();
  copied integer;
begin
  if v_organization_id is null or v_crew_member_id is null or not public.is_approved_account() then
    raise exception 'An approved linked crew account is required';
  end if;
  if p_source_start_date is null or p_target_start_date is null then
    raise exception 'Valid source and target week dates are required';
  end if;

  delete from public.availability
  where organization_id = v_organization_id
    and crew_member_id = v_crew_member_id
    and availability_date between p_target_start_date and p_target_start_date + 6;

  insert into public.availability (
    organization_id, crew_member_id, availability_date, status, starts_at, ends_at, note
  )
  select v_organization_id,
         v_crew_member_id,
         p_target_start_date + (availability_date - p_source_start_date),
         status,
         starts_at,
         ends_at,
         note
  from public.availability
  where organization_id = v_organization_id
    and crew_member_id = v_crew_member_id
    and availability_date between p_source_start_date and p_source_start_date + 6;
  get diagnostics copied = row_count;
  return copied;
end;
$$;

revoke all on function public.upsert_own_availability(date, public.availability_status, time, time, uuid) from public;
revoke all on function public.set_own_availability_range(date, date, public.availability_status) from public;
revoke all on function public.copy_own_availability_week(date, date) from public;

grant execute on function public.upsert_own_availability(date, public.availability_status, time, time, uuid) to authenticated;
grant execute on function public.set_own_availability_range(date, date, public.availability_status) to authenticated;
grant execute on function public.copy_own_availability_week(date, date) to authenticated;
