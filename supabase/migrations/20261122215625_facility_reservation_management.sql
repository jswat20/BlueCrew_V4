-- Increment 2: tenant-safe facilities, availability, closures, and reservations.
create extension if not exists btree_gist with schema extensions;

alter table public.locations
  add column if not exists timezone text not null default 'America/New_York',
  add column if not exists status text not null default 'operational',
  add column if not exists supported_sports text[] not null default '{}',
  add column if not exists notes text not null default '';

alter table public.locations
  add constraint locations_status_check check (status in ('operational','limited','closed'));

alter table public.fields
  add column if not exists status text not null default 'operational',
  add column if not exists supported_sports text[] not null default '{}',
  add column if not exists minimum_age smallint,
  add column if not exists maximum_age smallint,
  add column if not exists division_notes text not null default '';

alter table public.fields
  add constraint fields_status_check check (status in ('operational','limited','closed')),
  add constraint fields_age_range_check check (
    (minimum_age is null or minimum_age between 3 and 99)
    and (maximum_age is null or maximum_age between 3 and 99)
    and (minimum_age is null or maximum_age is null or minimum_age <= maximum_age)
  );

create table public.field_availability_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  field_id uuid not null,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  starts_at_local time not null,
  ends_at_local time not null,
  effective_from date,
  effective_until date,
  active boolean not null default true,
  created_by_profile_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, field_id) references public.fields(organization_id, id) on delete cascade,
  foreign key (organization_id, created_by_profile_id) references public.profiles(organization_id, id) on delete restrict,
  check (ends_at_local > starts_at_local),
  check (effective_until is null or effective_from is null or effective_until >= effective_from)
);

create table public.field_closures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  field_id uuid not null,
  closure_type text not null default 'maintenance' check (closure_type in ('maintenance','blackout','weather','administrative')),
  title text not null check (btrim(title) <> ''),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  notes text not null default '',
  active boolean not null default true,
  created_by_profile_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, field_id) references public.fields(organization_id, id) on delete cascade,
  foreign key (organization_id, created_by_profile_id) references public.profiles(organization_id, id) on delete restrict,
  check (ends_at > starts_at)
);

create table public.field_reservations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  field_id uuid not null,
  game_id uuid,
  reservation_type text not null check (reservation_type in ('game','practice','tournament','administrative_hold')),
  status text not null default 'active' check (status in ('active','cancelled')),
  title text not null check (btrim(title) <> ''),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  notes text not null default '',
  created_by_profile_id uuid not null,
  cancelled_at timestamptz,
  cancelled_by_profile_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, field_id) references public.fields(organization_id, id) on delete restrict,
  foreign key (organization_id, game_id) references public.games(organization_id, id) on delete restrict,
  foreign key (organization_id, created_by_profile_id) references public.profiles(organization_id, id) on delete restrict,
  foreign key (organization_id, cancelled_by_profile_id) references public.profiles(organization_id, id) on delete restrict,
  check (ends_at > starts_at),
  check ((status = 'cancelled') = (cancelled_at is not null))
);

alter table public.field_reservations
  add constraint field_reservations_no_active_overlap
  exclude using gist (
    organization_id with =,
    field_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status = 'active');

create index field_availability_rules_field_idx on public.field_availability_rules (organization_id, field_id, day_of_week) where active;
create index field_closures_field_time_idx on public.field_closures (organization_id, field_id, starts_at, ends_at) where active;
create index field_reservations_field_time_idx on public.field_reservations (organization_id, field_id, starts_at, ends_at) where status = 'active';
create index field_reservations_game_idx on public.field_reservations (organization_id, game_id) where game_id is not null;
create index field_reservations_creator_idx on public.field_reservations (organization_id, created_by_profile_id);

create or replace function public.validate_field_reservation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_timezone text;
  v_local_start timestamp;
  v_local_end timestamp;
begin
  if new.status = 'cancelled' then return new; end if;
  if new.ends_at <= new.starts_at then raise exception using message = 'reservation_end_must_follow_start'; end if;

  select location.timezone into v_timezone
  from public.fields field
  join public.locations location on location.organization_id = field.organization_id and location.id = field.location_id
  where field.organization_id = new.organization_id and field.id = new.field_id
    and field.active and field.status <> 'closed'
    and location.active and location.status <> 'closed';
  if v_timezone is null then raise exception using message = 'field_unavailable'; end if;

  v_local_start := new.starts_at at time zone v_timezone;
  v_local_end := new.ends_at at time zone v_timezone;
  if v_local_start::date <> v_local_end::date then raise exception using message = 'reservation_must_fit_single_local_day'; end if;

  if not exists (
    select 1 from public.field_availability_rules rule
    where rule.organization_id = new.organization_id and rule.field_id = new.field_id and rule.active
      and rule.day_of_week = extract(dow from v_local_start)::smallint
      and (rule.effective_from is null or v_local_start::date >= rule.effective_from)
      and (rule.effective_until is null or v_local_start::date <= rule.effective_until)
      and v_local_start::time >= rule.starts_at_local and v_local_end::time <= rule.ends_at_local
  ) then raise exception using message = 'reservation_outside_availability'; end if;

  if exists (
    select 1 from public.field_closures closure
    where closure.organization_id = new.organization_id and closure.field_id = new.field_id and closure.active
      and tstzrange(closure.starts_at, closure.ends_at, '[)') && tstzrange(new.starts_at, new.ends_at, '[)')
  ) then raise exception using message = 'reservation_blocked_by_closure'; end if;
  return new;
end;
$$;

create trigger field_reservations_validate
before insert or update of organization_id, field_id, status, starts_at, ends_at on public.field_reservations
for each row execute function public.validate_field_reservation();

alter table public.field_availability_rules enable row level security;
alter table public.field_closures enable row level security;
alter table public.field_reservations enable row level security;

create policy field_availability_select_member on public.field_availability_rules for select to authenticated
using (organization_id = (select public.current_organization_id()) and (select public.is_approved_account()));
create policy field_availability_manage_admin on public.field_availability_rules for all to authenticated
using (organization_id = (select public.current_organization_id()) and (select public.is_administrator()))
with check (organization_id = (select public.current_organization_id()) and (select public.is_administrator()));
create policy field_closures_select_member on public.field_closures for select to authenticated
using (organization_id = (select public.current_organization_id()) and (select public.is_approved_account()));
create policy field_closures_manage_admin on public.field_closures for all to authenticated
using (organization_id = (select public.current_organization_id()) and (select public.is_administrator()))
with check (organization_id = (select public.current_organization_id()) and (select public.is_administrator()));
create policy field_reservations_select_member on public.field_reservations for select to authenticated
using (organization_id = (select public.current_organization_id()) and (select public.is_approved_account()));
create policy field_reservations_manage_admin on public.field_reservations for all to authenticated
using (organization_id = (select public.current_organization_id()) and (select public.is_administrator()))
with check (organization_id = (select public.current_organization_id()) and (select public.is_administrator()));

create or replace function public.create_facility(
  p_name text, p_address text default '', p_timezone text default 'America/New_York',
  p_supported_sports text[] default '{}', p_status text default 'operational', p_notes text default ''
) returns public.locations
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_row public.locations%rowtype;
begin
  if not public.is_administrator() then raise exception using message = 'administrator_required'; end if;
  if nullif(btrim(coalesce(p_name,'')),'') is null then raise exception using message = 'facility_name_required'; end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then raise exception using message = 'invalid_timezone'; end if;
  insert into public.locations(organization_id,name,address,timezone,supported_sports,status,notes)
  values(public.current_organization_id(),btrim(p_name),btrim(coalesce(p_address,'')),p_timezone,coalesce(p_supported_sports,'{}'),p_status,btrim(coalesce(p_notes,'')))
  returning * into v_row;
  return v_row;
end; $$;

create or replace function public.update_facility(
  p_facility_id uuid, p_name text, p_address text, p_timezone text,
  p_supported_sports text[], p_status text, p_notes text default ''
) returns public.locations
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_row public.locations%rowtype;
begin
  if not public.is_administrator() then raise exception using message = 'administrator_required'; end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then raise exception using message = 'invalid_timezone'; end if;
  update public.locations set name=btrim(p_name), address=btrim(coalesce(p_address,'')), timezone=p_timezone,
    supported_sports=coalesce(p_supported_sports,'{}'), status=p_status, notes=btrim(coalesce(p_notes,'')), updated_at=now()
  where id=p_facility_id and organization_id=public.current_organization_id() returning * into v_row;
  if v_row.id is null then raise exception using message = 'facility_not_found'; end if;
  return v_row;
end; $$;

create or replace function public.create_facility_field(
  p_facility_id uuid, p_name text, p_supported_sports text[] default '{}',
  p_status text default 'operational', p_minimum_age smallint default null,
  p_maximum_age smallint default null, p_division_notes text default ''
) returns public.fields
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_row public.fields%rowtype;
begin
  if not public.is_administrator() then raise exception using message = 'administrator_required'; end if;
  insert into public.fields(organization_id,location_id,name,supported_sports,status,minimum_age,maximum_age,division_notes)
  select public.current_organization_id(),id,btrim(p_name),coalesce(p_supported_sports,'{}'),p_status,p_minimum_age,p_maximum_age,btrim(coalesce(p_division_notes,''))
  from public.locations where id=p_facility_id and organization_id=public.current_organization_id()
  returning * into v_row;
  if v_row.id is null then raise exception using message = 'facility_not_found'; end if;
  return v_row;
end; $$;

create or replace function public.update_facility_field(
  p_field_id uuid, p_name text, p_supported_sports text[], p_status text,
  p_minimum_age smallint default null, p_maximum_age smallint default null, p_division_notes text default ''
) returns public.fields
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_row public.fields%rowtype;
begin
  if not public.is_administrator() then raise exception using message = 'administrator_required'; end if;
  update public.fields set name=btrim(p_name), supported_sports=coalesce(p_supported_sports,'{}'), status=p_status,
    minimum_age=p_minimum_age, maximum_age=p_maximum_age, division_notes=btrim(coalesce(p_division_notes,'')), updated_at=now()
  where id=p_field_id and organization_id=public.current_organization_id() returning * into v_row;
  if v_row.id is null then raise exception using message = 'field_not_found'; end if;
  return v_row;
end; $$;

create or replace function public.create_field_availability_rule(
  p_field_id uuid, p_day_of_week smallint, p_starts_at_local time, p_ends_at_local time,
  p_effective_from date default null, p_effective_until date default null
) returns public.field_availability_rules
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_row public.field_availability_rules%rowtype;
begin
  if not public.is_administrator() then raise exception using message = 'administrator_required'; end if;
  insert into public.field_availability_rules(organization_id,field_id,day_of_week,starts_at_local,ends_at_local,effective_from,effective_until,created_by_profile_id)
  select public.current_organization_id(),id,p_day_of_week,p_starts_at_local,p_ends_at_local,p_effective_from,p_effective_until,public.current_profile_id()
  from public.fields where id=p_field_id and organization_id=public.current_organization_id()
  returning * into v_row;
  if v_row.id is null then raise exception using message = 'field_not_found'; end if;
  return v_row;
end; $$;

create or replace function public.create_field_closure(
  p_field_id uuid, p_closure_type text, p_title text, p_starts_at timestamptz, p_ends_at timestamptz, p_notes text default ''
) returns public.field_closures
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_row public.field_closures%rowtype;
begin
  if not public.is_administrator() then raise exception using message = 'administrator_required'; end if;
  insert into public.field_closures(organization_id,field_id,closure_type,title,starts_at,ends_at,notes,created_by_profile_id)
  select public.current_organization_id(),id,p_closure_type,btrim(p_title),p_starts_at,p_ends_at,btrim(coalesce(p_notes,'')),public.current_profile_id()
  from public.fields where id=p_field_id and organization_id=public.current_organization_id()
  returning * into v_row;
  if v_row.id is null then raise exception using message = 'field_not_found'; end if;
  return v_row;
end; $$;

create or replace function public.save_field_reservation(
  p_reservation_id uuid, p_field_id uuid, p_reservation_type text, p_title text,
  p_starts_at timestamptz, p_ends_at timestamptz, p_game_id uuid default null, p_notes text default ''
) returns public.field_reservations
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_row public.field_reservations%rowtype; v_org uuid := public.current_organization_id();
begin
  if not public.is_administrator() then raise exception using message = 'administrator_required'; end if;
  if p_reservation_id is null then
    insert into public.field_reservations(organization_id,field_id,game_id,reservation_type,title,starts_at,ends_at,notes,created_by_profile_id)
    values(v_org,p_field_id,p_game_id,p_reservation_type,btrim(p_title),p_starts_at,p_ends_at,btrim(coalesce(p_notes,'')),public.current_profile_id())
    returning * into v_row;
  else
    update public.field_reservations set field_id=p_field_id, game_id=p_game_id, reservation_type=p_reservation_type,
      title=btrim(p_title), starts_at=p_starts_at, ends_at=p_ends_at, notes=btrim(coalesce(p_notes,'')), updated_at=now()
    where id=p_reservation_id and organization_id=v_org and status='active' returning * into v_row;
    if v_row.id is null then raise exception using message = 'active_reservation_not_found'; end if;
  end if;
  return v_row;
exception when exclusion_violation then
  raise exception using message = 'reservation_conflict';
end; $$;

create or replace function public.cancel_field_reservation(p_reservation_id uuid)
returns public.field_reservations
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_row public.field_reservations%rowtype;
begin
  if not public.is_administrator() then raise exception using message = 'administrator_required'; end if;
  update public.field_reservations set status='cancelled',cancelled_at=now(),cancelled_by_profile_id=public.current_profile_id(),updated_at=now()
  where id=p_reservation_id and organization_id=public.current_organization_id() and status='active' returning * into v_row;
  if v_row.id is null then raise exception using message = 'active_reservation_not_found'; end if;
  return v_row;
end; $$;

revoke all on function public.validate_field_reservation() from public;
revoke all on function public.create_facility(text,text,text,text[],text,text) from public;
revoke all on function public.update_facility(uuid,text,text,text,text[],text,text) from public;
revoke all on function public.create_facility_field(uuid,text,text[],text,smallint,smallint,text) from public;
revoke all on function public.update_facility_field(uuid,text,text[],text,smallint,smallint,text) from public;
revoke all on function public.create_field_availability_rule(uuid,smallint,time,time,date,date) from public;
revoke all on function public.create_field_closure(uuid,text,text,timestamptz,timestamptz,text) from public;
revoke all on function public.save_field_reservation(uuid,uuid,text,text,timestamptz,timestamptz,uuid,text) from public;
revoke all on function public.cancel_field_reservation(uuid) from public;
grant execute on function public.create_facility(text,text,text,text[],text,text) to authenticated;
grant execute on function public.update_facility(uuid,text,text,text,text[],text,text) to authenticated;
grant execute on function public.create_facility_field(uuid,text,text[],text,smallint,smallint,text) to authenticated;
grant execute on function public.update_facility_field(uuid,text,text[],text,smallint,smallint,text) to authenticated;
grant execute on function public.create_field_availability_rule(uuid,smallint,time,time,date,date) to authenticated;
grant execute on function public.create_field_closure(uuid,text,text,timestamptz,timestamptz,text) to authenticated;
grant execute on function public.save_field_reservation(uuid,uuid,text,text,timestamptz,timestamptz,uuid,text) to authenticated;
grant execute on function public.cancel_field_reservation(uuid) to authenticated;
