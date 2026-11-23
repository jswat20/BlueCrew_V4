-- Increment 6A: independent Tournament Management and pool-play scheduling.

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sport text not null check (nullif(btrim(sport),'') is not null),
  name text not null check (nullif(btrim(name),'') is not null),
  starts_on date not null,
  ends_on date not null,
  timezone text not null,
  description text not null default '',
  status text not null default 'draft' check (status in ('draft','registration','scheduled','active','completed','cancelled')),
  created_by_profile_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,id),
  foreign key (organization_id,created_by_profile_id) references public.profiles(organization_id,id) on delete restrict,
  check (ends_on >= starts_on)
);

create table public.tournament_divisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  tournament_id uuid not null,
  name text not null check (nullif(btrim(name),'') is not null),
  age_group text not null default '',
  game_duration_minutes integer not null default 90 check (game_duration_minutes between 15 and 1440),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,id),
  unique (organization_id,tournament_id,name),
  foreign key (organization_id,tournament_id) references public.tournaments(organization_id,id) on delete cascade
);

create table public.tournament_teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  tournament_id uuid not null,
  division_id uuid not null,
  name text not null check (nullif(btrim(name),'') is not null),
  contact_name text not null default '',
  contact_email text not null default '',
  contact_phone text not null default '',
  seed integer check (seed is null or seed > 0),
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,id),
  foreign key (organization_id,tournament_id) references public.tournaments(organization_id,id) on delete cascade,
  foreign key (organization_id,division_id) references public.tournament_divisions(organization_id,id) on delete restrict
);
create unique index tournament_teams_active_name_idx on public.tournament_teams(organization_id,tournament_id,division_id,lower(name)) where withdrawn_at is null;

create table public.tournament_pools (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  tournament_id uuid not null,
  division_id uuid not null,
  name text not null check (nullif(btrim(name),'') is not null),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,id),
  unique (organization_id,tournament_id,division_id,name),
  foreign key (organization_id,tournament_id) references public.tournaments(organization_id,id) on delete cascade,
  foreign key (organization_id,division_id) references public.tournament_divisions(organization_id,id) on delete cascade
);

create table public.tournament_pool_memberships (
  organization_id uuid not null,
  tournament_id uuid not null,
  pool_id uuid not null,
  team_id uuid not null,
  assigned_at timestamptz not null default now(),
  primary key (organization_id,pool_id,team_id),
  unique (organization_id,tournament_id,team_id),
  foreign key (organization_id,tournament_id) references public.tournaments(organization_id,id) on delete cascade,
  foreign key (organization_id,pool_id) references public.tournament_pools(organization_id,id) on delete cascade,
  foreign key (organization_id,team_id) references public.tournament_teams(organization_id,id) on delete cascade
);

create table public.tournament_schedule_proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  tournament_id uuid not null,
  name text not null,
  status text not null default 'draft' check (status in ('draft','published')),
  configuration jsonb not null default '{}'::jsonb,
  generation_summary jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid not null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,id),
  foreign key (organization_id,tournament_id) references public.tournaments(organization_id,id) on delete cascade,
  foreign key (organization_id,created_by_profile_id) references public.profiles(organization_id,id) on delete restrict
);

create table public.tournament_schedule_proposal_games (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  proposal_id uuid not null,
  tournament_id uuid not null,
  division_id uuid not null,
  pool_id uuid not null,
  ordinal integer not null check (ordinal > 0),
  home_team_id uuid not null,
  away_team_id uuid not null,
  game_date date,
  game_time time,
  duration_minutes integer not null check (duration_minutes between 15 and 1440),
  location_id uuid,
  field_id uuid,
  state text not null default 'scheduled' check (state in ('scheduled','unscheduled')),
  issue text not null default '',
  notes text not null default '',
  published_game_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,id),
  unique (organization_id,proposal_id,ordinal),
  foreign key (organization_id,proposal_id) references public.tournament_schedule_proposals(organization_id,id) on delete cascade,
  foreign key (organization_id,tournament_id) references public.tournaments(organization_id,id) on delete cascade,
  foreign key (organization_id,division_id) references public.tournament_divisions(organization_id,id) on delete restrict,
  foreign key (organization_id,pool_id) references public.tournament_pools(organization_id,id) on delete restrict,
  foreign key (organization_id,home_team_id) references public.tournament_teams(organization_id,id) on delete restrict,
  foreign key (organization_id,away_team_id) references public.tournament_teams(organization_id,id) on delete restrict,
  foreign key (organization_id,location_id) references public.locations(organization_id,id) on delete restrict,
  foreign key (organization_id,field_id) references public.fields(organization_id,id) on delete restrict,
  foreign key (organization_id,published_game_id) references public.games(organization_id,id) on delete restrict,
  check (home_team_id <> away_team_id),
  check ((location_id is null) = (field_id is null)),
  check ((state='scheduled' and game_date is not null and game_time is not null and field_id is not null)
    or (state='unscheduled' and published_game_id is null))
);

alter table public.games
  add column tournament_id uuid,
  add column tournament_division_id uuid,
  add column tournament_pool_id uuid,
  add column tournament_home_team_id uuid,
  add column tournament_away_team_id uuid;
alter table public.games
  add foreign key (organization_id,tournament_id) references public.tournaments(organization_id,id) on delete restrict,
  add foreign key (organization_id,tournament_division_id) references public.tournament_divisions(organization_id,id) on delete restrict,
  add foreign key (organization_id,tournament_pool_id) references public.tournament_pools(organization_id,id) on delete restrict,
  add foreign key (organization_id,tournament_home_team_id) references public.tournament_teams(organization_id,id) on delete restrict,
  add foreign key (organization_id,tournament_away_team_id) references public.tournament_teams(organization_id,id) on delete restrict,
  add constraint games_distinct_tournament_teams check (tournament_home_team_id is null or tournament_away_team_id is null or tournament_home_team_id<>tournament_away_team_id);

create index tournaments_org_status_idx on public.tournaments(organization_id,status,starts_on);
create index tournament_divisions_tournament_idx on public.tournament_divisions(organization_id,tournament_id);
create index tournament_teams_tournament_idx on public.tournament_teams(organization_id,tournament_id,division_id);
create index tournament_pools_tournament_idx on public.tournament_pools(organization_id,tournament_id,division_id);
create index tournament_pool_memberships_team_idx on public.tournament_pool_memberships(organization_id,team_id);
create index tournament_proposals_tournament_idx on public.tournament_schedule_proposals(organization_id,tournament_id,status);
create index tournament_proposal_games_proposal_idx on public.tournament_schedule_proposal_games(organization_id,proposal_id,ordinal);
create index tournament_proposal_games_home_idx on public.tournament_schedule_proposal_games(organization_id,home_team_id);
create index tournament_proposal_games_away_idx on public.tournament_schedule_proposal_games(organization_id,away_team_id);
create index tournament_proposal_games_field_idx on public.tournament_schedule_proposal_games(organization_id,field_id);
create index tournament_proposal_games_published_idx on public.tournament_schedule_proposal_games(organization_id,published_game_id) where published_game_id is not null;
create index games_tournament_idx on public.games(organization_id,tournament_id,game_date,game_time) where game_domain='tournament';

do $$ declare v_table text; begin
  foreach v_table in array array['tournaments','tournament_divisions','tournament_teams','tournament_pools','tournament_pool_memberships','tournament_schedule_proposals','tournament_schedule_proposal_games'] loop
    execute format('alter table public.%I enable row level security',v_table);
    execute format('create policy %I on public.%I for select to authenticated using (organization_id=public.current_organization_id() and private.organization_module_enabled(organization_id,''tournament''))',v_table||'_select',v_table);
    execute format('create policy %I on public.%I for all to authenticated using (organization_id=public.current_organization_id() and private.organization_module_enabled(organization_id,''tournament'') and public.is_administrator()) with check (organization_id=public.current_organization_id() and private.organization_module_enabled(organization_id,''tournament'') and public.is_administrator())',v_table||'_manage',v_table);
    execute format('revoke all on public.%I from public,anon',v_table);
    execute format('grant select,insert,update,delete on public.%I to authenticated',v_table);
  end loop;
end $$;

create or replace function private.require_tournament_admin()
returns uuid language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_org uuid:=public.current_organization_id(); begin
  if v_org is null then raise exception using errcode='42501',message='active_workspace_required'; end if;
  if not private.organization_module_enabled(v_org,'tournament') then raise exception using errcode='42501',message='tournament_module_not_enabled'; end if;
  if not public.is_administrator() then raise exception using errcode='42501',message='tournament_management_forbidden'; end if;
  return v_org;
end $$;
revoke all on function private.require_tournament_admin() from public,anon,authenticated;
grant execute on function private.require_tournament_admin() to service_role;

create or replace function public.save_tournament(p_payload jsonb)
returns public.tournaments language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_org uuid:=private.require_tournament_admin(); v_row public.tournaments%rowtype; v_id uuid:=nullif(p_payload->>'id','')::uuid;
begin
  if nullif(btrim(p_payload->>'name'),'') is null or nullif(btrim(p_payload->>'sport'),'') is null then raise exception 'tournament_core_required'; end if;
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=coalesce(nullif(p_payload->>'timezone',''),(select timezone from public.organizations where id=v_org))) then raise exception 'invalid_timezone'; end if;
  if v_id is null then
    insert into public.tournaments(organization_id,sport,name,starts_on,ends_on,timezone,description,created_by_profile_id)
    values(v_org,btrim(p_payload->>'sport'),btrim(p_payload->>'name'),(p_payload->>'starts_on')::date,(p_payload->>'ends_on')::date,
      coalesce(nullif(p_payload->>'timezone',''),(select timezone from public.organizations where id=v_org)),btrim(coalesce(p_payload->>'description','')),public.current_profile_id()) returning * into v_row;
  else
    update public.tournaments set sport=btrim(p_payload->>'sport'),name=btrim(p_payload->>'name'),starts_on=(p_payload->>'starts_on')::date,
      ends_on=(p_payload->>'ends_on')::date,timezone=coalesce(nullif(p_payload->>'timezone',''),timezone),description=btrim(coalesce(p_payload->>'description','')),updated_at=now()
    where organization_id=v_org and id=v_id and status in ('draft','registration') returning * into v_row;
    if v_row.id is null then raise exception 'tournament_not_editable'; end if;
  end if;
  insert into public.workspace_audit_events(organization_id,actor_auth_user_id,action,entity_type,entity_id,metadata)
  values(v_org,(select auth.uid()),case when v_id is null then 'tournament.created' else 'tournament.updated' end,'tournament',v_row.id,jsonb_build_object('status',v_row.status));
  return v_row;
end $$;

create or replace function public.transition_tournament(p_tournament_id uuid,p_status text)
returns public.tournaments language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_org uuid:=private.require_tournament_admin(); v_row public.tournaments%rowtype;
begin
  select * into v_row from public.tournaments where organization_id=v_org and id=p_tournament_id for update;
  if v_row.id is null then raise exception 'tournament_not_found'; end if;
  if not ((v_row.status='draft' and p_status in ('registration','cancelled')) or (v_row.status='registration' and p_status in ('draft','scheduled','cancelled'))
    or (v_row.status='scheduled' and p_status in ('active','cancelled')) or (v_row.status='active' and p_status in ('completed','cancelled'))) then raise exception 'tournament_transition_invalid'; end if;
  update public.tournaments set status=p_status,updated_at=now() where id=v_row.id returning * into v_row;
  insert into public.workspace_audit_events(organization_id,actor_auth_user_id,action,entity_type,entity_id,metadata)
  values(v_org,(select auth.uid()),'tournament.status_changed','tournament',v_row.id,jsonb_build_object('status',p_status)); return v_row;
end $$;

create or replace function public.save_tournament_division(p_payload jsonb)
returns public.tournament_divisions language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_org uuid:=private.require_tournament_admin(); v_row public.tournament_divisions%rowtype;
begin
  if not exists(select 1 from public.tournaments where organization_id=v_org and id=(p_payload->>'tournament_id')::uuid and status in ('draft','registration')) then raise exception 'tournament_not_editable'; end if;
  insert into public.tournament_divisions(organization_id,tournament_id,name,age_group,game_duration_minutes)
  values(v_org,(p_payload->>'tournament_id')::uuid,btrim(p_payload->>'name'),btrim(coalesce(p_payload->>'age_group','')),coalesce((p_payload->>'game_duration_minutes')::integer,90)) returning * into v_row;
  return v_row;
end $$;

create or replace function public.save_tournament_team(p_payload jsonb)
returns public.tournament_teams language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_org uuid:=private.require_tournament_admin(); v_row public.tournament_teams%rowtype; v_id uuid:=nullif(p_payload->>'id','')::uuid;
begin
  if not exists(select 1 from public.tournament_divisions d join public.tournaments t on t.organization_id=d.organization_id and t.id=d.tournament_id
    where d.organization_id=v_org and d.id=(p_payload->>'division_id')::uuid and d.tournament_id=(p_payload->>'tournament_id')::uuid and t.status in ('draft','registration')) then raise exception 'tournament_division_invalid'; end if;
  if v_id is null then
    insert into public.tournament_teams(organization_id,tournament_id,division_id,name,contact_name,contact_email,contact_phone,seed)
    values(v_org,(p_payload->>'tournament_id')::uuid,(p_payload->>'division_id')::uuid,btrim(p_payload->>'name'),btrim(coalesce(p_payload->>'contact_name','')),
      lower(btrim(coalesce(p_payload->>'contact_email',''))),btrim(coalesce(p_payload->>'contact_phone','')),nullif(p_payload->>'seed','')::integer) returning * into v_row;
  else
    update public.tournament_teams set name=btrim(p_payload->>'name'),contact_name=btrim(coalesce(p_payload->>'contact_name','')),
      contact_email=lower(btrim(coalesce(p_payload->>'contact_email',''))),contact_phone=btrim(coalesce(p_payload->>'contact_phone','')),seed=nullif(p_payload->>'seed','')::integer,updated_at=now()
    where organization_id=v_org and id=v_id and withdrawn_at is null returning * into v_row;
  end if;
  return v_row;
exception when unique_violation then raise exception 'tournament_team_duplicate';
end $$;

create or replace function public.withdraw_tournament_team(p_team_id uuid)
returns public.tournament_teams language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_org uuid:=private.require_tournament_admin(); v_row public.tournament_teams%rowtype;
begin
  if exists(select 1 from public.tournament_schedule_proposal_games where organization_id=v_org and (home_team_id=p_team_id or away_team_id=p_team_id) and published_game_id is not null) then raise exception 'tournament_team_already_scheduled'; end if;
  update public.tournament_teams set withdrawn_at=now(),updated_at=now() where organization_id=v_org and id=p_team_id and withdrawn_at is null returning * into v_row;
  if v_row.id is null then raise exception 'tournament_team_not_found'; end if; return v_row;
end $$;

create or replace function public.save_tournament_pool(p_payload jsonb)
returns public.tournament_pools language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_org uuid:=private.require_tournament_admin(); v_row public.tournament_pools%rowtype;
begin
  if not exists(select 1 from public.tournament_divisions where organization_id=v_org and id=(p_payload->>'division_id')::uuid and tournament_id=(p_payload->>'tournament_id')::uuid) then raise exception 'tournament_division_invalid'; end if;
  insert into public.tournament_pools(organization_id,tournament_id,division_id,name)
  values(v_org,(p_payload->>'tournament_id')::uuid,(p_payload->>'division_id')::uuid,btrim(p_payload->>'name')) returning * into v_row; return v_row;
end $$;

create or replace function public.assign_tournament_team_to_pool(p_team_id uuid,p_pool_id uuid)
returns public.tournament_pool_memberships language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_org uuid:=private.require_tournament_admin(); v_team public.tournament_teams%rowtype; v_pool public.tournament_pools%rowtype; v_row public.tournament_pool_memberships%rowtype;
begin
  select * into v_team from public.tournament_teams where organization_id=v_org and id=p_team_id and withdrawn_at is null;
  select * into v_pool from public.tournament_pools where organization_id=v_org and id=p_pool_id;
  if v_team.id is null or v_pool.id is null or v_team.tournament_id<>v_pool.tournament_id or v_team.division_id<>v_pool.division_id then raise exception 'tournament_pool_assignment_invalid'; end if;
  insert into public.tournament_pool_memberships(organization_id,tournament_id,pool_id,team_id) values(v_org,v_team.tournament_id,v_pool.id,v_team.id)
  on conflict (organization_id,tournament_id,team_id) do update set pool_id=excluded.pool_id,assigned_at=now() returning * into v_row; return v_row;
end $$;

create or replace function public.save_tournament_schedule_proposal(p_payload jsonb)
returns public.tournament_schedule_proposals language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_org uuid:=private.require_tournament_admin(); v_row public.tournament_schedule_proposals%rowtype; v_item jsonb; v_ordinal integer:=0;
begin
  if not exists(select 1 from public.tournaments where organization_id=v_org and id=(p_payload->>'tournament_id')::uuid and status in ('draft','registration','scheduled')) then raise exception 'tournament_not_schedulable'; end if;
  if coalesce(jsonb_array_length(p_payload->'games'),0)=0 then raise exception 'proposal_games_required'; end if;
  insert into public.tournament_schedule_proposals(organization_id,tournament_id,name,configuration,generation_summary,created_by_profile_id)
  values(v_org,(p_payload->>'tournament_id')::uuid,coalesce(nullif(btrim(p_payload->>'name'),''),'Pool-play proposal'),p_payload-'games',coalesce(p_payload->'summary','{}'),public.current_profile_id()) returning * into v_row;
  for v_item in select value from jsonb_array_elements(p_payload->'games') loop
    v_ordinal:=v_ordinal+1;
    if not exists(select 1 from public.tournament_pool_memberships h join public.tournament_pool_memberships a on a.organization_id=h.organization_id and a.pool_id=h.pool_id
      where h.organization_id=v_org and h.pool_id=(v_item->>'pool_id')::uuid and h.team_id=(v_item->>'home_team_id')::uuid and a.team_id=(v_item->>'away_team_id')::uuid) then raise exception 'tournament_matchup_invalid'; end if;
    insert into public.tournament_schedule_proposal_games(organization_id,proposal_id,tournament_id,division_id,pool_id,ordinal,home_team_id,away_team_id,game_date,game_time,duration_minutes,location_id,field_id,state,issue,notes)
    values(v_org,v_row.id,v_row.tournament_id,(v_item->>'division_id')::uuid,(v_item->>'pool_id')::uuid,v_ordinal,(v_item->>'home_team_id')::uuid,(v_item->>'away_team_id')::uuid,
      nullif(v_item->>'game_date','')::date,nullif(v_item->>'game_time','')::time,coalesce((v_item->>'duration_minutes')::integer,90),nullif(v_item->>'location_id','')::uuid,
      nullif(v_item->>'field_id','')::uuid,coalesce(v_item->>'state','unscheduled'),coalesce(v_item->>'issue',''),coalesce(v_item->>'notes',''));
  end loop;
  insert into public.workspace_audit_events(organization_id,actor_auth_user_id,action,entity_type,entity_id,metadata)
  values(v_org,(select auth.uid()),'tournament_schedule_proposal.created','tournament_schedule_proposal',v_row.id,jsonb_build_object('games',v_ordinal)); return v_row;
end $$;

create or replace function public.update_tournament_schedule_proposal_game(p_game_id uuid,p_date date,p_time time,p_location_id uuid,p_field_id uuid,p_notes text default '')
returns public.tournament_schedule_proposal_games language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_org uuid:=private.require_tournament_admin(); v_row public.tournament_schedule_proposal_games%rowtype;
begin
  if not exists(select 1 from public.fields where organization_id=v_org and id=p_field_id and location_id=p_location_id and active) then raise exception 'proposal_field_invalid'; end if;
  update public.tournament_schedule_proposal_games g set game_date=p_date,game_time=p_time,location_id=p_location_id,field_id=p_field_id,state='scheduled',issue='',notes=btrim(coalesce(p_notes,'')),updated_at=now()
  from public.tournament_schedule_proposals p where g.id=p_game_id and g.organization_id=v_org and p.id=g.proposal_id and p.organization_id=v_org and p.status='draft' returning g.* into v_row;
  if v_row.id is null then raise exception 'proposal_game_not_editable'; end if; return v_row;
end $$;

create or replace function private.create_tournament_game(p_item public.tournament_schedule_proposal_games,p_tournament public.tournaments)
returns public.games language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_game public.games%rowtype; v_home text; v_away text; v_division text; v_pool text; v_timezone text; v_start timestamptz; v_end timestamptz;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('tournament-team-schedule:'||p_item.organization_id::text,0));
  if exists(select 1 from public.games g where g.organization_id=p_item.organization_id and g.game_domain='tournament' and g.lifecycle_status::text not in ('cancelled','postponed')
    and (g.tournament_home_team_id in (p_item.home_team_id,p_item.away_team_id) or g.tournament_away_team_id in (p_item.home_team_id,p_item.away_team_id))
    and (g.game_date+g.game_time)<(p_item.game_date+p_item.game_time+make_interval(mins=>p_item.duration_minutes))
    and (p_item.game_date+p_item.game_time)<(g.game_date+g.game_time+make_interval(mins=>g.duration_minutes))) then raise exception using errcode='23514',message='tournament_team_conflict'; end if;
  select h.name,a.name,d.name,p.name,l.timezone into v_home,v_away,v_division,v_pool,v_timezone
  from public.tournament_teams h join public.tournament_teams a on a.organization_id=h.organization_id
  join public.tournament_divisions d on d.organization_id=h.organization_id and d.id=p_item.division_id
  join public.tournament_pools p on p.organization_id=h.organization_id and p.id=p_item.pool_id
  join public.fields f on f.organization_id=h.organization_id and f.id=p_item.field_id and f.location_id=p_item.location_id and f.active and f.status<>'closed'
  join public.locations l on l.organization_id=f.organization_id and l.id=f.location_id and l.active and l.status<>'closed'
  where h.organization_id=p_item.organization_id and h.id=p_item.home_team_id and a.id=p_item.away_team_id and h.withdrawn_at is null and a.withdrawn_at is null;
  if v_home is null then raise exception 'tournament_game_catalog_invalid'; end if;
  v_start:=(p_item.game_date+p_item.game_time) at time zone v_timezone; v_end:=v_start+make_interval(mins=>p_item.duration_minutes);
  insert into public.games(organization_id,game_domain,sport,game_date,game_time,timezone,location_id,field_id,home_team,away_team,level,game_type,lifecycle_status,duration_minutes,notes,created_by_profile_id,
    tournament_id,tournament_division_id,tournament_pool_id,tournament_home_team_id,tournament_away_team_id)
  values(p_item.organization_id,'tournament',p_tournament.sport,p_item.game_date,p_item.game_time,v_timezone,p_item.location_id,p_item.field_id,v_home,v_away,v_division||' · '||v_pool,'pool_play','scheduled',p_item.duration_minutes,p_item.notes,public.current_profile_id(),
    p_item.tournament_id,p_item.division_id,p_item.pool_id,p_item.home_team_id,p_item.away_team_id) returning * into v_game;
  insert into public.field_reservations(organization_id,field_id,game_id,reservation_type,title,starts_at,ends_at,notes,created_by_profile_id)
  values(p_item.organization_id,p_item.field_id,v_game.id,'tournament',v_away||' @ '||v_home,v_start,v_end,p_item.notes,public.current_profile_id()); return v_game;
exception when exclusion_violation or unique_violation then raise exception using errcode='23P01',message='tournament_field_conflict';
end $$;
revoke all on function private.create_tournament_game(public.tournament_schedule_proposal_games,public.tournaments) from public,anon,authenticated;
grant execute on function private.create_tournament_game(public.tournament_schedule_proposal_games,public.tournaments) to service_role;

create or replace function public.publish_tournament_schedule_proposal(p_proposal_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_org uuid:=private.require_tournament_admin(); v_proposal public.tournament_schedule_proposals%rowtype; v_tournament public.tournaments%rowtype; v_item public.tournament_schedule_proposal_games%rowtype; v_game public.games%rowtype; v_ids jsonb:='[]';
begin
  select * into v_proposal from public.tournament_schedule_proposals where organization_id=v_org and id=p_proposal_id for update;
  if v_proposal.id is null then raise exception 'proposal_not_found'; end if;
  if v_proposal.status='published' then select coalesce(jsonb_agg(published_game_id order by ordinal),'[]') into v_ids from public.tournament_schedule_proposal_games where organization_id=v_org and proposal_id=p_proposal_id and published_game_id is not null; return jsonb_build_object('published',true,'idempotent',true,'game_ids',v_ids); end if;
  select * into v_tournament from public.tournaments where organization_id=v_org and id=v_proposal.tournament_id for update;
  for v_item in select * from public.tournament_schedule_proposal_games where organization_id=v_org and proposal_id=p_proposal_id and state='scheduled' order by ordinal for update loop
    v_game:=private.create_tournament_game(v_item,v_tournament);
    update public.tournament_schedule_proposal_games set published_game_id=v_game.id,updated_at=now() where id=v_item.id; v_ids:=v_ids||to_jsonb(v_game.id);
  end loop;
  update public.tournament_schedule_proposals set status='published',published_at=now(),updated_at=now() where id=p_proposal_id;
  update public.tournaments set status=case when status in ('draft','registration') then 'scheduled' else status end,updated_at=now() where id=v_tournament.id;
  insert into public.workspace_audit_events(organization_id,actor_auth_user_id,action,entity_type,entity_id,metadata)
  values(v_org,(select auth.uid()),'tournament_schedule_proposal.published','tournament_schedule_proposal',p_proposal_id,jsonb_build_object('game_ids',v_ids,'atomic',true));
  return jsonb_build_object('published',true,'idempotent',false,'game_ids',v_ids);
end $$;

do $$ declare v_signature regprocedure; begin
  foreach v_signature in array array[
    'public.save_tournament(jsonb)'::regprocedure,'public.transition_tournament(uuid,text)'::regprocedure,'public.save_tournament_division(jsonb)'::regprocedure,
    'public.save_tournament_team(jsonb)'::regprocedure,'public.withdraw_tournament_team(uuid)'::regprocedure,'public.save_tournament_pool(jsonb)'::regprocedure,
    'public.assign_tournament_team_to_pool(uuid,uuid)'::regprocedure,'public.save_tournament_schedule_proposal(jsonb)'::regprocedure,
    'public.update_tournament_schedule_proposal_game(uuid,date,time,uuid,uuid,text)'::regprocedure,'public.publish_tournament_schedule_proposal(uuid)'::regprocedure
  ] loop execute format('revoke all on function %s from public,anon',v_signature); execute format('grant execute on function %s to authenticated',v_signature); end loop;
end $$;
