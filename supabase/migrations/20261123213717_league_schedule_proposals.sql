-- Increment 5B: persistent League schedule proposals and atomic publication.

create table public.league_schedule_proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sport text not null,
  season_id uuid not null,
  league_id uuid not null,
  division_id uuid not null,
  name text not null,
  status text not null default 'draft' check (status in ('draft','published')),
  configuration jsonb not null default '{}'::jsonb,
  generation_summary jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid not null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, season_id) references public.seasons(organization_id, id) on delete restrict,
  foreign key (organization_id, league_id) references public.leagues(organization_id, id) on delete restrict,
  foreign key (organization_id, division_id) references public.divisions(organization_id, id) on delete restrict,
  foreign key (organization_id, created_by_profile_id) references public.profiles(organization_id, id) on delete restrict
);

create table public.league_schedule_proposal_games (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  proposal_id uuid not null,
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
  unique (organization_id, id),
  unique (organization_id, proposal_id, ordinal),
  foreign key (organization_id, proposal_id) references public.league_schedule_proposals(organization_id, id) on delete cascade,
  foreign key (organization_id, home_team_id) references public.teams(organization_id, id) on delete restrict,
  foreign key (organization_id, away_team_id) references public.teams(organization_id, id) on delete restrict,
  foreign key (organization_id, location_id) references public.locations(organization_id, id) on delete restrict,
  foreign key (organization_id, field_id) references public.fields(organization_id, id) on delete restrict,
  foreign key (organization_id, published_game_id) references public.games(organization_id, id) on delete restrict,
  check (home_team_id <> away_team_id),
  check ((location_id is null) = (field_id is null)),
  check ((state = 'scheduled' and game_date is not null and game_time is not null and field_id is not null)
    or (state = 'unscheduled' and published_game_id is null))
);

create index league_schedule_proposals_org_status_idx on public.league_schedule_proposals(organization_id,status,updated_at desc);
create index league_schedule_proposal_games_proposal_idx on public.league_schedule_proposal_games(organization_id,proposal_id,ordinal);

alter table public.league_schedule_proposals enable row level security;
alter table public.league_schedule_proposal_games enable row level security;

create policy league_schedule_proposals_select on public.league_schedule_proposals for select to authenticated
using (organization_id = public.current_organization_id() and private.organization_module_enabled(organization_id,'league'));
create policy league_schedule_proposals_insert on public.league_schedule_proposals for insert to authenticated
with check (organization_id = public.current_organization_id() and private.organization_module_enabled(organization_id,'league') and public.is_administrator());
create policy league_schedule_proposals_update on public.league_schedule_proposals for update to authenticated
using (organization_id = public.current_organization_id() and private.organization_module_enabled(organization_id,'league') and public.is_administrator())
with check (organization_id = public.current_organization_id() and private.organization_module_enabled(organization_id,'league') and public.is_administrator());
create policy league_schedule_proposals_delete on public.league_schedule_proposals for delete to authenticated
using (organization_id = public.current_organization_id() and private.organization_module_enabled(organization_id,'league') and public.is_administrator());
create policy league_schedule_proposal_games_select on public.league_schedule_proposal_games for select to authenticated
using (organization_id = public.current_organization_id() and private.organization_module_enabled(organization_id,'league'));
create policy league_schedule_proposal_games_insert on public.league_schedule_proposal_games for insert to authenticated
with check (organization_id = public.current_organization_id() and private.organization_module_enabled(organization_id,'league') and public.is_administrator());
create policy league_schedule_proposal_games_update on public.league_schedule_proposal_games for update to authenticated
using (organization_id = public.current_organization_id() and private.organization_module_enabled(organization_id,'league') and public.is_administrator())
with check (organization_id = public.current_organization_id() and private.organization_module_enabled(organization_id,'league') and public.is_administrator());
create policy league_schedule_proposal_games_delete on public.league_schedule_proposal_games for delete to authenticated
using (organization_id = public.current_organization_id() and private.organization_module_enabled(organization_id,'league') and public.is_administrator());

revoke all on public.league_schedule_proposals, public.league_schedule_proposal_games from public,anon;
grant select,insert,update,delete on public.league_schedule_proposals, public.league_schedule_proposal_games to authenticated;

create or replace function public.save_league_schedule_proposal(p_payload jsonb)
returns public.league_schedule_proposals language plpgsql security definer
set search_path=pg_catalog,public,private as $$
declare
  v_org uuid:=public.current_organization_id(); v_actor uuid:=public.current_profile_id();
  v_proposal public.league_schedule_proposals%rowtype; v_item jsonb; v_ordinal integer:=0;
  v_team_ids uuid[]; v_field_ids uuid[];
begin
  if v_org is null then raise exception using errcode='42501',message='active_workspace_required'; end if;
  if not private.organization_module_enabled(v_org,'league') then raise exception using errcode='42501',message='league_module_not_enabled'; end if;
  if not public.is_administrator() then raise exception using errcode='42501',message='league_schedule_forbidden'; end if;
  if coalesce(jsonb_array_length(p_payload->'games'),0)=0 then raise exception using message='proposal_games_required'; end if;

  select array_agg(value::uuid) into v_team_ids from jsonb_array_elements_text(coalesce(p_payload->'team_ids','[]'::jsonb));
  select array_agg(value::uuid) into v_field_ids from jsonb_array_elements_text(coalesce(p_payload->'field_ids','[]'::jsonb));
  if coalesce(array_length(v_team_ids,1),0)<2 then raise exception using message='proposal_teams_required'; end if;
  if not exists(select 1 from public.divisions d join public.leagues l on l.organization_id=d.organization_id and l.id=d.league_id
    where d.organization_id=v_org and d.id=(p_payload->>'division_id')::uuid and d.league_id=(p_payload->>'league_id')::uuid
      and d.season_id=(p_payload->>'season_id')::uuid and d.active and l.active) then
    raise exception using message='league_catalog_selection_invalid';
  end if;
  if exists(select 1 from unnest(v_team_ids) id where not exists(select 1 from public.teams t where t.organization_id=v_org and t.id=id
    and t.division_id=(p_payload->>'division_id')::uuid and t.season_id=(p_payload->>'season_id')::uuid and t.active)) then
    raise exception using message='proposal_team_invalid';
  end if;
  if exists(select 1 from unnest(coalesce(v_field_ids,'{}'::uuid[])) id where not exists(select 1 from public.fields f join public.locations l
    on l.organization_id=f.organization_id and l.id=f.location_id where f.organization_id=v_org and f.id=id and f.active and l.active)) then
    raise exception using message='proposal_field_invalid';
  end if;

  insert into public.league_schedule_proposals(organization_id,sport,season_id,league_id,division_id,name,configuration,generation_summary,created_by_profile_id)
  values(v_org,btrim(p_payload->>'sport'),(p_payload->>'season_id')::uuid,(p_payload->>'league_id')::uuid,
    (p_payload->>'division_id')::uuid,coalesce(nullif(btrim(p_payload->>'name'),''),'League schedule proposal'),
    p_payload-'games',coalesce(p_payload->'summary','{}'::jsonb),v_actor) returning * into v_proposal;

  for v_item in select value from jsonb_array_elements(p_payload->'games') loop
    v_ordinal:=v_ordinal+1;
    if not ((v_item->>'home_team_id')::uuid=any(v_team_ids) and (v_item->>'away_team_id')::uuid=any(v_team_ids)) then
      raise exception using message='proposal_team_invalid';
    end if;
    if v_item->>'state'='scheduled' and not ((v_item->>'field_id')::uuid=any(v_field_ids)) then
      raise exception using message='proposal_field_invalid';
    end if;
    insert into public.league_schedule_proposal_games(organization_id,proposal_id,ordinal,home_team_id,away_team_id,
      game_date,game_time,duration_minutes,location_id,field_id,state,issue,notes)
    values(v_org,v_proposal.id,v_ordinal,(v_item->>'home_team_id')::uuid,(v_item->>'away_team_id')::uuid,
      nullif(v_item->>'game_date','')::date,nullif(v_item->>'game_time','')::time,coalesce((v_item->>'duration_minutes')::integer,90),
      nullif(v_item->>'location_id','')::uuid,nullif(v_item->>'field_id','')::uuid,coalesce(v_item->>'state','unscheduled'),
      coalesce(v_item->>'issue',''),coalesce(v_item->>'notes',''));
  end loop;
  insert into public.workspace_audit_events(organization_id,actor_auth_user_id,action,entity_type,entity_id,metadata)
  values(v_org,(select auth.uid()),'league_schedule_proposal.created','league_schedule_proposal',v_proposal.id,
    jsonb_build_object('games',v_ordinal,'scheduled',coalesce((p_payload->'summary'->>'scheduled')::integer,0)));
  return v_proposal;
end; $$;

create or replace function public.update_league_schedule_proposal_game(p_proposal_game_id uuid,p_game_date date,p_game_time time,
  p_location_id uuid,p_field_id uuid,p_notes text default '') returns public.league_schedule_proposal_games
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_org uuid:=public.current_organization_id(); v_row public.league_schedule_proposal_games%rowtype;
begin
  if not private.organization_module_enabled(v_org,'league') or not public.is_administrator() then raise exception using errcode='42501',message='league_schedule_forbidden'; end if;
  if p_game_date is null or p_game_time is null or p_location_id is null or p_field_id is null then raise exception using message='proposal_schedule_required'; end if;
  if not exists(select 1 from public.fields f where f.organization_id=v_org and f.id=p_field_id and f.location_id=p_location_id and f.active) then raise exception using message='proposal_field_invalid'; end if;
  update public.league_schedule_proposal_games g set game_date=p_game_date,game_time=p_game_time,location_id=p_location_id,field_id=p_field_id,
    state='scheduled',issue='',notes=btrim(coalesce(p_notes,'')),updated_at=now()
  from public.league_schedule_proposals p where g.id=p_proposal_game_id and g.organization_id=v_org and p.id=g.proposal_id
    and p.organization_id=v_org and p.status='draft' returning g.* into v_row;
  if v_row.id is null then raise exception using message='proposal_game_not_editable'; end if;
  return v_row;
end; $$;

create or replace function public.publish_league_schedule_proposal(p_proposal_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_org uuid:=public.current_organization_id(); v_proposal public.league_schedule_proposals%rowtype;
  v_item public.league_schedule_proposal_games%rowtype; v_game public.games%rowtype; v_ids jsonb:='[]'::jsonb;
begin
  if not private.organization_module_enabled(v_org,'league') or not public.is_administrator() then raise exception using errcode='42501',message='league_schedule_forbidden'; end if;
  select * into v_proposal from public.league_schedule_proposals where organization_id=v_org and id=p_proposal_id for update;
  if v_proposal.id is null then raise exception using message='proposal_not_found'; end if;
  if v_proposal.status='published' then
    select coalesce(jsonb_agg(published_game_id order by ordinal),'[]'::jsonb) into v_ids from public.league_schedule_proposal_games
      where organization_id=v_org and proposal_id=p_proposal_id and published_game_id is not null;
    return jsonb_build_object('proposal_id',p_proposal_id,'published',true,'idempotent',true,'game_ids',v_ids);
  end if;
  for v_item in select * from public.league_schedule_proposal_games where organization_id=v_org and proposal_id=p_proposal_id and state='scheduled' order by ordinal for update loop
    v_game:=public.save_league_game(null,v_proposal.sport,v_proposal.season_id,v_proposal.league_id,v_proposal.division_id,
      v_item.home_team_id,v_item.away_team_id,v_item.game_date,v_item.game_time,v_item.duration_minutes,v_item.location_id,v_item.field_id,v_item.notes);
    update public.league_schedule_proposal_games set published_game_id=v_game.id,updated_at=now() where id=v_item.id;
    v_ids:=v_ids||to_jsonb(v_game.id);
  end loop;
  update public.league_schedule_proposals set status='published',published_at=now(),updated_at=now() where id=p_proposal_id returning * into v_proposal;
  insert into public.workspace_audit_events(organization_id,actor_auth_user_id,action,entity_type,entity_id,metadata)
  values(v_org,(select auth.uid()),'league_schedule_proposal.published','league_schedule_proposal',p_proposal_id,
    jsonb_build_object('game_ids',v_ids,'atomic',true));
  return jsonb_build_object('proposal_id',p_proposal_id,'published',true,'idempotent',false,'game_ids',v_ids);
end; $$;

revoke all on function public.save_league_schedule_proposal(jsonb) from public,anon;
revoke all on function public.update_league_schedule_proposal_game(uuid,date,time,uuid,uuid,text) from public,anon;
revoke all on function public.publish_league_schedule_proposal(uuid) from public,anon;
grant execute on function public.save_league_schedule_proposal(jsonb) to authenticated;
grant execute on function public.update_league_schedule_proposal_game(uuid,date,time,uuid,uuid,text) to authenticated;
grant execute on function public.publish_league_schedule_proposal(uuid) to authenticated;
