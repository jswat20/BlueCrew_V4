-- Spring 2027 increment 1: tenant-scoped competition catalog.
-- Additive only: existing season, game, assignment, and official contracts remain unchanged.

create table public.sports (
  code text primary key check (code ~ '^[a-z][a-z0-9_]*$'),
  name text not null unique check (btrim(name) <> ''),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.sports (code, name)
values ('baseball', 'Baseball'), ('softball', 'Softball');

create table public.organization_sports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  sport_code text not null references public.sports(code) on delete restrict,
  display_name text not null check (btrim(display_name) <> ''),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, sport_code)
);

create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  organization_sport_id uuid not null,
  name text not null check (btrim(name) <> ''),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, organization_sport_id, slug),
  foreign key (organization_id, organization_sport_id)
    references public.organization_sports(organization_id, id) on delete restrict
);

create table public.divisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  league_id uuid not null,
  season_id uuid not null,
  name text not null check (btrim(name) <> ''),
  code text not null check (btrim(code) <> ''),
  minimum_age smallint check (minimum_age between 3 and 99),
  maximum_age smallint check (maximum_age between 3 and 99),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, season_id, league_id, code),
  foreign key (organization_id, league_id)
    references public.leagues(organization_id, id) on delete restrict,
  foreign key (organization_id, season_id)
    references public.seasons(organization_id, id) on delete restrict,
  check (minimum_age is null or maximum_age is null or maximum_age >= minimum_age)
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  season_id uuid not null,
  division_id uuid not null,
  name text not null check (btrim(name) <> ''),
  short_name text not null default '',
  external_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, season_id, division_id, name),
  unique (organization_id, season_id, external_id),
  foreign key (organization_id, division_id)
    references public.divisions(organization_id, id) on delete restrict,
  foreign key (organization_id, season_id)
    references public.seasons(organization_id, id) on delete restrict
);

create index organization_sports_org_active_idx
  on public.organization_sports (organization_id, active, sport_code);
create index leagues_org_sport_active_idx
  on public.leagues (organization_id, organization_sport_id, active, name);
create index divisions_org_season_active_idx
  on public.divisions (organization_id, season_id, active, sort_order, name);
create index divisions_org_league_idx
  on public.divisions (organization_id, league_id);
create index teams_org_division_active_idx
  on public.teams (organization_id, division_id, active, name);
create index teams_org_season_idx
  on public.teams (organization_id, season_id);

create trigger organization_sports_set_updated_at
before update on public.organization_sports
for each row execute function public.set_updated_at();
create trigger leagues_set_updated_at
before update on public.leagues
for each row execute function public.set_updated_at();
create trigger divisions_set_updated_at
before update on public.divisions
for each row execute function public.set_updated_at();
create trigger teams_set_updated_at
before update on public.teams
for each row execute function public.set_updated_at();

alter table public.sports enable row level security;
alter table public.organization_sports enable row level security;
alter table public.leagues enable row level security;
alter table public.divisions enable row level security;
alter table public.teams enable row level security;

create policy sports_select_authenticated
on public.sports for select to authenticated
using (true);

create policy organization_sports_select_member
on public.organization_sports for select to authenticated
using (organization_id = (select public.current_organization_id()) and (select public.is_approved_account()));
create policy organization_sports_insert_admin on public.organization_sports for insert to authenticated
with check (organization_id = (select public.current_organization_id()) and (select public.is_administrator()));
create policy organization_sports_update_admin on public.organization_sports for update to authenticated
using (organization_id = (select public.current_organization_id()) and (select public.is_administrator()))
with check (organization_id = (select public.current_organization_id()) and (select public.is_administrator()));
create policy organization_sports_delete_admin on public.organization_sports for delete to authenticated
using (organization_id = (select public.current_organization_id()) and (select public.is_administrator()));

create policy leagues_select_member
on public.leagues for select to authenticated
using (organization_id = (select public.current_organization_id()) and (select public.is_approved_account()));
create policy leagues_insert_admin on public.leagues for insert to authenticated
with check (organization_id = (select public.current_organization_id()) and (select public.is_administrator()));
create policy leagues_update_admin on public.leagues for update to authenticated
using (organization_id = (select public.current_organization_id()) and (select public.is_administrator()))
with check (organization_id = (select public.current_organization_id()) and (select public.is_administrator()));
create policy leagues_delete_admin on public.leagues for delete to authenticated
using (organization_id = (select public.current_organization_id()) and (select public.is_administrator()));

create policy divisions_select_member
on public.divisions for select to authenticated
using (organization_id = (select public.current_organization_id()) and (select public.is_approved_account()));
create policy divisions_insert_admin on public.divisions for insert to authenticated
with check (organization_id = (select public.current_organization_id()) and (select public.is_administrator()));
create policy divisions_update_admin on public.divisions for update to authenticated
using (organization_id = (select public.current_organization_id()) and (select public.is_administrator()))
with check (organization_id = (select public.current_organization_id()) and (select public.is_administrator()));
create policy divisions_delete_admin on public.divisions for delete to authenticated
using (organization_id = (select public.current_organization_id()) and (select public.is_administrator()));

create policy teams_select_member
on public.teams for select to authenticated
using (organization_id = (select public.current_organization_id()) and (select public.is_approved_account()));
create policy teams_insert_admin on public.teams for insert to authenticated
with check (organization_id = (select public.current_organization_id()) and (select public.is_administrator()));
create policy teams_update_admin on public.teams for update to authenticated
using (organization_id = (select public.current_organization_id()) and (select public.is_administrator()))
with check (organization_id = (select public.current_organization_id()) and (select public.is_administrator()));
create policy teams_delete_admin on public.teams for delete to authenticated
using (organization_id = (select public.current_organization_id()) and (select public.is_administrator()));

grant select on public.sports to authenticated;
grant select, insert, update, delete on public.organization_sports, public.leagues, public.divisions, public.teams to authenticated;
revoke all on public.sports, public.organization_sports, public.leagues, public.divisions, public.teams from anon;

create function public.create_competition_program(
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
  on conflict (organization_id, organization_sport_id, slug)
  do update set name = excluded.name, active = true
  returning id into v_league_id;

  return query select v_sport_id, v_league_id;
end;
$$;

create function public.create_competition_division(
  p_league_id uuid,
  p_season_id uuid,
  p_name text,
  p_code text,
  p_minimum_age smallint default null,
  p_maximum_age smallint default null
)
returns public.divisions
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org uuid := public.current_organization_id();
  v_row public.divisions;
begin
  if v_org is null or not public.is_administrator() then
    raise exception using errcode = '42501', message = 'competition_catalog_administrator_required';
  end if;
  if not exists (select 1 from public.leagues where id = p_league_id and organization_id = v_org and active) then
    raise exception using errcode = 'P0001', message = 'competition_catalog_league_not_found';
  end if;
  if not exists (select 1 from public.seasons where id = p_season_id and organization_id = v_org) then
    raise exception using errcode = 'P0001', message = 'competition_catalog_season_not_found';
  end if;

  insert into public.divisions (
    organization_id, league_id, season_id, name, code, minimum_age, maximum_age
  ) values (
    v_org, p_league_id, p_season_id, btrim(p_name), upper(btrim(p_code)), p_minimum_age, p_maximum_age
  ) returning * into v_row;
  return v_row;
end;
$$;

create function public.create_competition_team(
  p_division_id uuid,
  p_name text,
  p_short_name text default ''
)
returns public.teams
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org uuid := public.current_organization_id();
  v_division public.divisions;
  v_row public.teams;
begin
  if v_org is null or not public.is_administrator() then
    raise exception using errcode = '42501', message = 'competition_catalog_administrator_required';
  end if;
  select * into v_division from public.divisions
  where id = p_division_id and organization_id = v_org and active;
  if v_division.id is null then
    raise exception using errcode = 'P0001', message = 'competition_catalog_division_not_found';
  end if;

  insert into public.teams (organization_id, season_id, division_id, name, short_name)
  values (v_org, v_division.season_id, v_division.id, btrim(p_name), btrim(coalesce(p_short_name, '')))
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.create_competition_program(text, text, text) from public;
revoke all on function public.create_competition_division(uuid, uuid, text, text, smallint, smallint) from public;
revoke all on function public.create_competition_team(uuid, text, text) from public;
grant execute on function public.create_competition_program(text, text, text) to authenticated;
grant execute on function public.create_competition_division(uuid, uuid, text, text, smallint, smallint) to authenticated;
grant execute on function public.create_competition_team(uuid, text, text) to authenticated;
