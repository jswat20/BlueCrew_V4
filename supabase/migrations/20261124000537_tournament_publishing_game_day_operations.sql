-- Increment 6C: explicit tournament publishing, game-day operations, safe
-- rescheduling, and idempotent bye advancement.

create table public.tournament_publications (
  organization_id uuid not null,
  tournament_id uuid not null,
  share_token uuid not null default gen_random_uuid(),
  published boolean not null default false,
  published_at timestamptz,
  published_by_profile_id uuid,
  updated_at timestamptz not null default now(),
  primary key (organization_id,tournament_id),
  unique (share_token),
  foreign key (organization_id,tournament_id) references public.tournaments(organization_id,id) on delete cascade,
  foreign key (organization_id,published_by_profile_id) references public.profiles(organization_id,id) on delete restrict,
  check ((not published) or (published_at is not null and published_by_profile_id is not null))
);

alter table public.tournament_publications enable row level security;
create policy tournament_publications_select on public.tournament_publications for select to authenticated
using (organization_id=(select public.current_organization_id()) and private.organization_module_enabled(organization_id,'tournament'));
revoke all on public.tournament_publications from public,anon;
grant select on public.tournament_publications to authenticated;

create or replace function public.set_tournament_publication(p_tournament_id uuid,p_published boolean)
returns public.tournament_publications language plpgsql security definer
set search_path=pg_catalog,public,private as $$
declare v_org uuid:=private.require_tournament_admin(); v_row public.tournament_publications%rowtype;
begin
  if not exists(select 1 from public.tournaments where organization_id=v_org and id=p_tournament_id) then
    raise exception 'tournament_not_found';
  end if;
  insert into public.tournament_publications(organization_id,tournament_id,published,published_at,published_by_profile_id)
  values(v_org,p_tournament_id,p_published,case when p_published then now() end,case when p_published then public.current_profile_id() end)
  on conflict(organization_id,tournament_id) do update set
    published=excluded.published,
    published_at=case when excluded.published then now() else null end,
    published_by_profile_id=case when excluded.published then public.current_profile_id() else null end,
    updated_at=now()
  returning * into v_row;
  insert into public.workspace_audit_events(organization_id,actor_auth_user_id,action,entity_type,entity_id,metadata)
  values(v_org,(select auth.uid()),case when p_published then 'tournament.published' else 'tournament.unpublished' end,
    'tournament',p_tournament_id,jsonb_build_object('share_token',v_row.share_token));
  return v_row;
end $$;

-- The sole anonymous tournament interface. It resolves an opaque token and
-- returns a deliberately constructed document containing no contacts, notes,
-- membership records, audit data, profile identifiers, or organization data.
create or replace function public.get_public_tournament_pool_standings(p_organization_id uuid,p_pool_id uuid)
returns jsonb language sql security definer stable
set search_path=pg_catalog,public as $$ select '[]'::jsonb $$;

create or replace function public.get_public_tournament(p_share_token uuid)
returns jsonb language sql security definer stable
set search_path=pg_catalog,public as $$
  select jsonb_build_object(
    'tournament',jsonb_build_object('name',t.name,'sport',t.sport,'starts_on',t.starts_on,'ends_on',t.ends_on,'status',t.status,'description',t.description,'timezone',t.timezone),
    'divisions',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,'age_group',d.age_group) order by d.name) from public.tournament_divisions d where d.organization_id=t.organization_id and d.tournament_id=t.id and d.active),'[]'::jsonb),
    'teams',coalesce((select jsonb_agg(jsonb_build_object('id',tm.id,'division_id',tm.division_id,'name',tm.name,'seed',tm.seed) order by tm.name) from public.tournament_teams tm where tm.organization_id=t.organization_id and tm.tournament_id=t.id and tm.withdrawn_at is null),'[]'::jsonb),
    'pools',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'division_id',p.division_id,'name',p.name) order by p.name) from public.tournament_pools p where p.organization_id=t.organization_id and p.tournament_id=t.id),'[]'::jsonb),
    'games',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'division_id',g.tournament_division_id,'pool_id',g.tournament_pool_id,'date',g.game_date,'time',g.game_time,'timezone',g.timezone,'home_team_id',g.tournament_home_team_id,'away_team_id',g.tournament_away_team_id,'home_team',g.home_team,'away_team',g.away_team,'status',g.lifecycle_status,'facility',l.name,'field',f.name,'result',case when r.id is null then null else jsonb_build_object('status',r.result_status,'home_score',r.home_score,'away_score',r.away_score,'winner_team_id',r.winner_team_id) end) order by g.game_date,g.game_time,g.id) from public.games g left join public.locations l on l.organization_id=g.organization_id and l.id=g.location_id left join public.fields f on f.organization_id=g.organization_id and f.id=g.field_id left join public.tournament_game_results r on r.organization_id=g.organization_id and r.game_id=g.id where g.organization_id=t.organization_id and g.tournament_id=t.id and g.game_domain='tournament'),'[]'::jsonb),
    'standings',coalesce((select jsonb_object_agg(p.id::text,public.get_public_tournament_pool_standings(p.organization_id,p.id)) from public.tournament_pools p where p.organization_id=t.organization_id and p.tournament_id=t.id),'{}'::jsonb),
    'brackets',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'division_id',b.division_id,'name',b.name,'status',b.status,'champion_team_id',b.champion_team_id,'rounds',(select coalesce(jsonb_agg(jsonb_build_object('id',br.id,'number',br.round_number,'name',br.name,'games',(select coalesce(jsonb_agg(jsonb_build_object('id',bg.id,'number',bg.game_number,'home_team_id',bg.home_team_id,'away_team_id',bg.away_team_id,'winner_team_id',bg.winner_team_id,'canonical_game_id',bg.canonical_game_id) order by bg.game_number),'[]'::jsonb) from public.tournament_bracket_games bg where bg.organization_id=b.organization_id and bg.round_id=br.id)) order by br.round_number),'[]'::jsonb) from public.tournament_bracket_rounds br where br.organization_id=b.organization_id and br.bracket_id=b.id)) order by b.generated_at) from public.tournament_brackets b where b.organization_id=t.organization_id and b.tournament_id=t.id),'[]'::jsonb)
  )
  from public.tournament_publications pub
  join public.tournaments t on t.organization_id=pub.organization_id and t.id=pub.tournament_id
  where pub.share_token=p_share_token and pub.published;
$$;

-- Public standings variant takes the already validated tenant identity from the
-- publication query rather than authenticated workspace state.
create or replace function public.get_public_tournament_pool_standings(p_organization_id uuid,p_pool_id uuid)
returns jsonb language sql security definer stable
set search_path=pg_catalog,public as $$
  with members as (
    select tm.id team_id,tm.name
    from public.tournament_pool_memberships pm join public.tournament_teams tm
      on tm.organization_id=pm.organization_id and tm.id=pm.team_id
    where pm.organization_id=p_organization_id and pm.pool_id=p_pool_id
  ), totals as (
    select m.team_id,m.name,count(r.id) filter(where r.result_status in ('final','forfeited')) games_played,
      count(*) filter(where r.winner_team_id=m.team_id and r.result_status in ('final','forfeited')) wins,
      count(*) filter(where r.winner_team_id is not null and r.winner_team_id<>m.team_id and r.result_status in ('final','forfeited')) losses,
      count(*) filter(where r.winner_team_id is null and r.result_status='final') ties,
      coalesce(sum(case when g.tournament_home_team_id=m.team_id then r.home_score when g.tournament_away_team_id=m.team_id then r.away_score end) filter(where r.result_status in ('final','forfeited')),0) points_for,
      coalesce(sum(case when g.tournament_home_team_id=m.team_id then r.away_score when g.tournament_away_team_id=m.team_id then r.home_score end) filter(where r.result_status in ('final','forfeited')),0) points_against
    from members m left join public.games g on g.organization_id=p_organization_id and g.tournament_pool_id=p_pool_id and m.team_id in(g.tournament_home_team_id,g.tournament_away_team_id)
    left join public.tournament_game_results r on r.organization_id=g.organization_id and r.game_id=g.id group by m.team_id,m.name
  ) select jsonb_agg(jsonb_build_object('seed',seed,'team_id',team_id,'name',name,'games_played',games_played,'wins',wins,'losses',losses,'ties',ties,'points_for',points_for,'points_against',points_against,'score_differential',points_for-points_against) order by seed)
  from (select totals.*,row_number() over(order by wins desc,(points_for-points_against) desc,points_for desc,name)::integer seed from totals) ranked;
$$;

create or replace function public.reschedule_tournament_game(p_game_id uuid,p_game_date date,p_game_time time,p_location_id uuid,p_field_id uuid)
returns public.games language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_org uuid:=private.require_tournament_admin(); v_game public.games%rowtype; v_old public.games%rowtype; v_zone text; v_start timestamptz; v_end timestamptz; v_res public.field_reservations%rowtype;
begin
  select * into v_game from public.games where organization_id=v_org and id=p_game_id and game_domain='tournament' for update;
  if v_game.id is null then raise exception 'tournament_game_not_found'; end if;
  v_old:=v_game;
  if exists(select 1 from public.tournament_game_results where organization_id=v_org and game_id=p_game_id and result_status in ('final','forfeited')) then raise exception 'tournament_final_game_locked'; end if;
  select l.timezone into v_zone from public.fields f join public.locations l on l.organization_id=f.organization_id and l.id=f.location_id
    where f.organization_id=v_org and f.id=p_field_id and f.location_id=p_location_id and f.active and f.status<>'closed' and l.active and l.status<>'closed';
  if v_zone is null then raise exception 'field_unavailable'; end if;
  v_start:=(p_game_date+p_game_time) at time zone v_zone; v_end:=v_start+make_interval(mins=>v_game.duration_minutes);
  update public.games set game_date=p_game_date,game_time=p_game_time,timezone=v_zone,location_id=p_location_id,field_id=p_field_id,lifecycle_status='scheduled',updated_at=now()
    where organization_id=v_org and id=p_game_id returning * into v_game;
  select * into v_res from public.field_reservations where organization_id=v_org and game_id=p_game_id and status='active' for update;
  if v_res.id is null then
    insert into public.field_reservations(organization_id,field_id,game_id,reservation_type,title,starts_at,ends_at,notes,created_by_profile_id)
    values(v_org,p_field_id,p_game_id,'tournament',v_game.away_team||' @ '||v_game.home_team,v_start,v_end,'Tournament game',public.current_profile_id());
  else
    update public.field_reservations set field_id=p_field_id,starts_at=v_start,ends_at=v_end,updated_at=now() where id=v_res.id;
  end if;
  insert into public.workspace_audit_events(organization_id,actor_auth_user_id,action,entity_type,entity_id,metadata)
  values(v_org,(select auth.uid()),'tournament.game_rescheduled','game',p_game_id,jsonb_build_object('from_date',v_old.game_date,'from_time',v_old.game_time,'from_field_id',v_old.field_id,'to_date',p_game_date,'to_time',p_game_time,'to_field_id',p_field_id));
  return v_game;
exception when exclusion_violation or unique_violation then raise exception using errcode='23P01',message='tournament_field_conflict';
end $$;

create or replace function public.transition_tournament_game(p_game_id uuid,p_action text)
returns public.games language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_org uuid:=private.require_tournament_admin(); v_game public.games%rowtype;
begin
  select * into v_game from public.games where organization_id=v_org and id=p_game_id and game_domain='tournament' for update;
  if v_game.id is null then raise exception 'tournament_game_not_found'; end if;
  if exists(select 1 from public.tournament_game_results where organization_id=v_org and game_id=p_game_id and result_status in ('final','forfeited')) then raise exception 'tournament_final_game_locked'; end if;
  if p_action not in ('postpone','cancel') then raise exception 'tournament_game_action_invalid'; end if;
  update public.field_reservations set status='cancelled',cancelled_at=now(),cancelled_by_profile_id=public.current_profile_id(),updated_at=now()
    where organization_id=v_org and game_id=p_game_id and status='active';
  update public.games set lifecycle_status=(case when p_action='postpone' then 'postponed' else 'cancelled' end)::public.game_lifecycle_status,location_id=null,field_id=null,updated_at=now()
    where organization_id=v_org and id=p_game_id returning * into v_game;
  insert into public.workspace_audit_events(organization_id,actor_auth_user_id,action,entity_type,entity_id,metadata)
  values(v_org,(select auth.uid()),'tournament.game_'||p_action,'game',p_game_id,'{}'::jsonb);
  return v_game;
end $$;

create or replace function public.advance_tournament_byes(p_bracket_id uuid)
returns integer language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_org uuid:=private.require_tournament_admin(); v_game public.tournament_bracket_games%rowtype; v_winner uuid; v_count integer:=0;
begin
  if not exists(select 1 from public.tournament_brackets where organization_id=v_org and id=p_bracket_id) then raise exception 'tournament_bracket_not_found'; end if;
  for v_game in select * from public.tournament_bracket_games where organization_id=v_org and bracket_id=p_bracket_id and round_number=1 and winner_team_id is null and ((home_team_id is null)<>(away_team_id is null)) for update loop
    v_winner:=coalesce(v_game.home_team_id,v_game.away_team_id);
    update public.tournament_bracket_games set winner_team_id=v_winner,updated_at=now() where organization_id=v_org and id=v_game.id and winner_team_id is null;
    if found then
      if v_game.next_slot='home' then update public.tournament_bracket_games set home_team_id=v_winner,updated_at=now() where organization_id=v_org and id=v_game.next_game_id and home_team_id is null;
      else update public.tournament_bracket_games set away_team_id=v_winner,updated_at=now() where organization_id=v_org and id=v_game.next_game_id and away_team_id is null; end if;
      insert into public.workspace_audit_events(organization_id,actor_auth_user_id,action,entity_type,entity_id,metadata)
      values(v_org,(select auth.uid()),'tournament.bye_advanced','tournament_bracket_game',v_game.id,jsonb_build_object('winner_team_id',v_winner,'next_game_id',v_game.next_game_id));
      v_count:=v_count+1;
    end if;
  end loop;
  return v_count;
end $$;

revoke all on function public.set_tournament_publication(uuid,boolean) from public,anon;
revoke all on function public.get_public_tournament(uuid) from public,anon,authenticated;
revoke all on function public.get_public_tournament_pool_standings(uuid,uuid) from public,anon,authenticated;
revoke all on function public.reschedule_tournament_game(uuid,date,time,uuid,uuid) from public,anon;
revoke all on function public.transition_tournament_game(uuid,text) from public,anon;
revoke all on function public.advance_tournament_byes(uuid) from public,anon;
grant execute on function public.set_tournament_publication(uuid,boolean) to authenticated;
grant execute on function public.get_public_tournament(uuid) to anon,authenticated;
grant execute on function public.reschedule_tournament_game(uuid,date,time,uuid,uuid) to authenticated;
grant execute on function public.transition_tournament_game(uuid,text) to authenticated;
grant execute on function public.advance_tournament_byes(uuid) to authenticated;

comment on function public.get_public_tournament(uuid) is 'Read-only opaque-token tournament publication endpoint; returns an explicitly allowlisted public document.';
