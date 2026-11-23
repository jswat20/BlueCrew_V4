-- Increment 6B: Tournament results, deterministic standings, and elimination brackets.

create table public.tournament_scoring_rules (
  organization_id uuid not null,
  tournament_id uuid not null,
  division_id uuid not null,
  win_points numeric(6,2) not null default 3,
  tie_points numeric(6,2) not null default 1,
  loss_points numeric(6,2) not null default 0,
  ties_allowed boolean not null default true,
  differential_cap integer check (differential_cap is null or differential_cap > 0),
  tiebreak_order text[] not null default array['points','win_percentage','head_to_head','score_differential','points_for','manual'],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id,division_id),
  foreign key (organization_id,tournament_id) references public.tournaments(organization_id,id) on delete cascade,
  foreign key (organization_id,division_id) references public.tournament_divisions(organization_id,id) on delete cascade,
  check (array_length(tiebreak_order,1) > 0)
);

create table public.tournament_game_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  tournament_id uuid not null,
  division_id uuid not null,
  game_id uuid not null,
  result_status text not null check (result_status in ('in_progress','final','forfeited','cancelled','postponed')),
  home_score integer,
  away_score integer,
  winner_team_id uuid,
  decision_note text not null default '',
  revision integer not null default 1 check (revision > 0),
  finalized_at timestamptz,
  finalized_by_profile_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,id),
  unique (organization_id,game_id),
  foreign key (organization_id,tournament_id) references public.tournaments(organization_id,id) on delete cascade,
  foreign key (organization_id,division_id) references public.tournament_divisions(organization_id,id) on delete restrict,
  foreign key (organization_id,game_id) references public.games(organization_id,id) on delete restrict,
  foreign key (organization_id,winner_team_id) references public.tournament_teams(organization_id,id) on delete restrict,
  foreign key (organization_id,finalized_by_profile_id) references public.profiles(organization_id,id) on delete restrict,
  check (home_score is null or home_score >= 0),
  check (away_score is null or away_score >= 0),
  check ((result_status in ('final','forfeited')) = (finalized_at is not null)),
  check (result_status not in ('final','forfeited') or (home_score is not null and away_score is not null))
);

create table public.tournament_manual_tiebreaks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  tournament_id uuid not null,
  division_id uuid not null,
  pool_id uuid not null,
  team_id uuid not null,
  priority integer not null check (priority > 0),
  reason text not null check (nullif(btrim(reason),'') is not null),
  decided_by_profile_id uuid not null,
  created_at timestamptz not null default now(),
  unique (organization_id,id),
  unique (organization_id,pool_id,team_id),
  unique (organization_id,pool_id,priority),
  foreign key (organization_id,tournament_id) references public.tournaments(organization_id,id) on delete cascade,
  foreign key (organization_id,division_id) references public.tournament_divisions(organization_id,id) on delete cascade,
  foreign key (organization_id,pool_id) references public.tournament_pools(organization_id,id) on delete cascade,
  foreign key (organization_id,team_id) references public.tournament_teams(organization_id,id) on delete cascade,
  foreign key (organization_id,decided_by_profile_id) references public.profiles(organization_id,id) on delete restrict
);

create table public.tournament_brackets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  tournament_id uuid not null,
  division_id uuid not null,
  name text not null,
  bracket_size integer not null check (bracket_size in (4,8)),
  status text not null default 'generated' check (status in ('generated','in_progress','completed')),
  standings_snapshot jsonb not null,
  seeding_rule text not null,
  generation_key text not null,
  champion_team_id uuid,
  generated_by_profile_id uuid not null,
  generated_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,id),
  unique (organization_id,division_id,generation_key),
  foreign key (organization_id,tournament_id) references public.tournaments(organization_id,id) on delete cascade,
  foreign key (organization_id,division_id) references public.tournament_divisions(organization_id,id) on delete restrict,
  foreign key (organization_id,champion_team_id) references public.tournament_teams(organization_id,id) on delete restrict,
  foreign key (organization_id,generated_by_profile_id) references public.profiles(organization_id,id) on delete restrict
);

create table public.tournament_bracket_rounds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  bracket_id uuid not null,
  round_number integer not null check (round_number > 0),
  name text not null,
  created_at timestamptz not null default now(),
  unique (organization_id,id),
  unique (organization_id,bracket_id,round_number),
  foreign key (organization_id,bracket_id) references public.tournament_brackets(organization_id,id) on delete cascade
);

create table public.tournament_bracket_games (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  tournament_id uuid not null,
  division_id uuid not null,
  bracket_id uuid not null,
  round_id uuid not null,
  round_number integer not null,
  game_number integer not null,
  home_team_id uuid,
  away_team_id uuid,
  home_seed integer,
  away_seed integer,
  winner_team_id uuid,
  next_game_id uuid,
  next_slot text check (next_slot in ('home','away')),
  canonical_game_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,id),
  unique (organization_id,bracket_id,round_number,game_number),
  foreign key (organization_id,tournament_id) references public.tournaments(organization_id,id) on delete cascade,
  foreign key (organization_id,division_id) references public.tournament_divisions(organization_id,id) on delete restrict,
  foreign key (organization_id,bracket_id) references public.tournament_brackets(organization_id,id) on delete cascade,
  foreign key (organization_id,round_id) references public.tournament_bracket_rounds(organization_id,id) on delete cascade,
  foreign key (organization_id,home_team_id) references public.tournament_teams(organization_id,id) on delete restrict,
  foreign key (organization_id,away_team_id) references public.tournament_teams(organization_id,id) on delete restrict,
  foreign key (organization_id,winner_team_id) references public.tournament_teams(organization_id,id) on delete restrict,
  foreign key (organization_id,next_game_id) references public.tournament_bracket_games(organization_id,id) deferrable initially deferred,
  foreign key (organization_id,canonical_game_id) references public.games(organization_id,id) on delete restrict,
  check (home_team_id is null or away_team_id is null or home_team_id <> away_team_id)
);

create index tournament_results_tournament_idx on public.tournament_game_results(organization_id,tournament_id,division_id);
create index tournament_manual_tiebreak_pool_idx on public.tournament_manual_tiebreaks(organization_id,pool_id,priority);
create index tournament_brackets_tournament_idx on public.tournament_brackets(organization_id,tournament_id,division_id);
create index tournament_bracket_games_bracket_idx on public.tournament_bracket_games(organization_id,bracket_id,round_number,game_number);
create index tournament_bracket_games_canonical_idx on public.tournament_bracket_games(organization_id,canonical_game_id) where canonical_game_id is not null;

do $$ declare v_table text; begin
  foreach v_table in array array['tournament_scoring_rules','tournament_game_results','tournament_manual_tiebreaks','tournament_brackets','tournament_bracket_rounds','tournament_bracket_games'] loop
    execute format('alter table public.%I enable row level security',v_table);
    execute format('create policy %I on public.%I for select to authenticated using (organization_id=public.current_organization_id() and private.organization_module_enabled(organization_id,''tournament''))',v_table||'_select',v_table);
    execute format('create policy %I on public.%I for insert to authenticated with check (organization_id=public.current_organization_id() and private.organization_module_enabled(organization_id,''tournament'') and public.is_administrator())',v_table||'_insert',v_table);
    execute format('create policy %I on public.%I for update to authenticated using (organization_id=public.current_organization_id() and private.organization_module_enabled(organization_id,''tournament'') and public.is_administrator()) with check (organization_id=public.current_organization_id() and private.organization_module_enabled(organization_id,''tournament'') and public.is_administrator())',v_table||'_update',v_table);
    execute format('create policy %I on public.%I for delete to authenticated using (organization_id=public.current_organization_id() and private.organization_module_enabled(organization_id,''tournament'') and public.is_administrator())',v_table||'_delete',v_table);
    execute format('revoke all on public.%I from public,anon',v_table);
    execute format('grant select,insert,update,delete on public.%I to authenticated',v_table);
  end loop;
end $$;

create or replace function public.save_tournament_scoring_rules(p_payload jsonb)
returns public.tournament_scoring_rules language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_org uuid:=private.require_tournament_admin(); v_row public.tournament_scoring_rules%rowtype; v_div public.tournament_divisions%rowtype;
begin
  select * into v_div from public.tournament_divisions where organization_id=v_org and id=(p_payload->>'division_id')::uuid;
  if v_div.id is null then raise exception 'tournament_division_not_found'; end if;
  insert into public.tournament_scoring_rules(organization_id,tournament_id,division_id,win_points,tie_points,loss_points,ties_allowed,differential_cap,tiebreak_order)
  values(v_org,v_div.tournament_id,v_div.id,coalesce((p_payload->>'win_points')::numeric,3),coalesce((p_payload->>'tie_points')::numeric,1),coalesce((p_payload->>'loss_points')::numeric,0),coalesce((p_payload->>'ties_allowed')::boolean,true),nullif(p_payload->>'differential_cap','')::integer,coalesce(array(select jsonb_array_elements_text(p_payload->'tiebreak_order')),array['points','win_percentage','head_to_head','score_differential','points_for','manual']))
  on conflict(organization_id,division_id) do update set win_points=excluded.win_points,tie_points=excluded.tie_points,loss_points=excluded.loss_points,ties_allowed=excluded.ties_allowed,differential_cap=excluded.differential_cap,tiebreak_order=excluded.tiebreak_order,updated_at=now() returning * into v_row;
  insert into public.workspace_audit_events(organization_id,actor_auth_user_id,action,entity_type,entity_id,metadata) values(v_org,(select auth.uid()),'tournament.scoring_rules_saved','tournament_division',v_div.id,to_jsonb(v_row)-'organization_id');
  return v_row;
end $$;

create or replace function public.save_tournament_game_result(p_game_id uuid,p_status text,p_home_score integer,p_away_score integer,p_winner_team_id uuid default null,p_decision_note text default '')
returns public.tournament_game_results language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_org uuid:=private.require_tournament_admin(); v_game public.games%rowtype; v_existing public.tournament_game_results%rowtype; v_row public.tournament_game_results%rowtype; v_rule public.tournament_scoring_rules%rowtype; v_bracket public.tournament_bracket_games%rowtype; v_winner uuid; v_loser uuid;
begin
  select * into v_game from public.games where organization_id=v_org and id=p_game_id and game_domain='tournament' for update;
  if v_game.id is null then raise exception 'tournament_game_not_found'; end if;
  if p_status not in ('in_progress','final','forfeited','cancelled','postponed') then raise exception 'tournament_result_status_invalid'; end if;
  if p_home_score is not null and p_home_score<0 or p_away_score is not null and p_away_score<0 then raise exception 'tournament_score_invalid'; end if;
  if p_status in ('final','forfeited') and (p_home_score is null or p_away_score is null) then raise exception 'tournament_final_score_required'; end if;
  select * into v_rule from public.tournament_scoring_rules where organization_id=v_org and division_id=v_game.tournament_division_id;
  if v_rule.division_id is null then v_rule.ties_allowed:=true; end if;
  select * into v_bracket from public.tournament_bracket_games where organization_id=v_org and canonical_game_id=v_game.id for update;
  if p_status in ('final','forfeited') then
    if p_winner_team_id is not null and p_winner_team_id not in (v_game.tournament_home_team_id,v_game.tournament_away_team_id) then raise exception 'tournament_winner_invalid'; end if;
    if p_home_score=p_away_score then
      if v_bracket.id is not null and p_winner_team_id is null then raise exception 'elimination_winner_required'; end if;
      if v_bracket.id is null and not coalesce(v_rule.ties_allowed,true) then raise exception 'tournament_tie_not_allowed'; end if;
      v_winner:=p_winner_team_id;
    else
      v_winner:=case when p_home_score>p_away_score then v_game.tournament_home_team_id else v_game.tournament_away_team_id end;
      if p_winner_team_id is not null and p_winner_team_id<>v_winner then raise exception 'tournament_winner_score_mismatch'; end if;
    end if;
  end if;
  select * into v_existing from public.tournament_game_results where organization_id=v_org and game_id=v_game.id for update;
  if v_existing.id is not null and v_bracket.id is not null and v_bracket.winner_team_id is not null and v_existing.winner_team_id is distinct from v_winner then
    if v_bracket.next_game_id is not null and exists(select 1 from public.tournament_bracket_games n join public.tournament_game_results r on r.organization_id=n.organization_id and r.game_id=n.canonical_game_id where n.organization_id=v_org and n.id=v_bracket.next_game_id and r.result_status in ('final','forfeited')) then raise exception 'downstream_bracket_result_final'; end if;
  end if;
  insert into public.tournament_game_results(organization_id,tournament_id,division_id,game_id,result_status,home_score,away_score,winner_team_id,decision_note,finalized_at,finalized_by_profile_id)
  values(v_org,v_game.tournament_id,v_game.tournament_division_id,v_game.id,p_status,p_home_score,p_away_score,v_winner,btrim(coalesce(p_decision_note,'')),case when p_status in ('final','forfeited') then now() end,case when p_status in ('final','forfeited') then public.current_profile_id() end)
  on conflict(organization_id,game_id) do update set result_status=excluded.result_status,home_score=excluded.home_score,away_score=excluded.away_score,winner_team_id=excluded.winner_team_id,decision_note=excluded.decision_note,revision=public.tournament_game_results.revision+1,finalized_at=excluded.finalized_at,finalized_by_profile_id=excluded.finalized_by_profile_id,updated_at=now() returning * into v_row;
  update public.games set lifecycle_status=(case when p_status in ('final','forfeited') then 'completed' when p_status='cancelled' then 'cancelled' when p_status='postponed' then 'postponed' else 'scheduled' end)::public.game_lifecycle_status,updated_at=now() where id=v_game.id;
  if v_bracket.id is not null then
    update public.tournament_bracket_games set winner_team_id=v_winner,updated_at=now() where id=v_bracket.id;
    if v_bracket.next_game_id is not null then
      if v_bracket.next_slot='home' then update public.tournament_bracket_games set home_team_id=v_winner,updated_at=now() where id=v_bracket.next_game_id;
      else update public.tournament_bracket_games set away_team_id=v_winner,updated_at=now() where id=v_bracket.next_game_id; end if;
    elsif v_winner is not null then
      update public.tournament_brackets set champion_team_id=v_winner,status='completed',completed_at=now(),updated_at=now() where id=v_bracket.bracket_id;
    end if;
  end if;
  insert into public.workspace_audit_events(organization_id,actor_auth_user_id,action,entity_type,entity_id,metadata) values(v_org,(select auth.uid()),case when v_existing.id is null then 'tournament.result_recorded' else 'tournament.result_corrected' end,'game',v_game.id,jsonb_build_object('status',p_status,'home_score',p_home_score,'away_score',p_away_score,'winner_team_id',v_winner,'revision',v_row.revision));
  return v_row;
end $$;

create or replace function public.save_tournament_manual_tiebreak(p_pool_id uuid,p_team_id uuid,p_priority integer,p_reason text)
returns public.tournament_manual_tiebreaks language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_org uuid:=private.require_tournament_admin(); v_pool public.tournament_pools%rowtype; v_row public.tournament_manual_tiebreaks%rowtype;
begin
  select * into v_pool from public.tournament_pools where organization_id=v_org and id=p_pool_id;
  if v_pool.id is null or not exists(select 1 from public.tournament_pool_memberships where organization_id=v_org and pool_id=p_pool_id and team_id=p_team_id) then raise exception 'tournament_pool_team_invalid'; end if;
  insert into public.tournament_manual_tiebreaks(organization_id,tournament_id,division_id,pool_id,team_id,priority,reason,decided_by_profile_id)
  values(v_org,v_pool.tournament_id,v_pool.division_id,v_pool.id,p_team_id,p_priority,btrim(p_reason),public.current_profile_id())
  on conflict(organization_id,pool_id,team_id) do update set priority=excluded.priority,reason=excluded.reason,decided_by_profile_id=excluded.decided_by_profile_id,created_at=now() returning * into v_row;
  insert into public.workspace_audit_events(organization_id,actor_auth_user_id,action,entity_type,entity_id,metadata) values(v_org,(select auth.uid()),'tournament.manual_tiebreak_recorded','tournament_pool',p_pool_id,jsonb_build_object('team_id',p_team_id,'priority',p_priority,'reason',p_reason));
  return v_row;
end $$;

create or replace function public.get_tournament_pool_standings(p_pool_id uuid)
returns jsonb language plpgsql security definer stable set search_path=pg_catalog,public,private as $$
declare v_org uuid:=public.current_organization_id(); v_pool public.tournament_pools%rowtype; v_rule public.tournament_scoring_rules%rowtype; v_result jsonb;
begin
  if v_org is null or not private.organization_module_enabled(v_org,'tournament') then raise exception using errcode='42501',message='tournament_module_not_enabled'; end if;
  select * into v_pool from public.tournament_pools where organization_id=v_org and id=p_pool_id;
  if v_pool.id is null then raise exception 'tournament_pool_not_found'; end if;
  select * into v_rule from public.tournament_scoring_rules where organization_id=v_org and division_id=v_pool.division_id;
  with teams as (
    select t.id team_id,t.name from public.tournament_pool_memberships m join public.tournament_teams t on t.organization_id=m.organization_id and t.id=m.team_id where m.organization_id=v_org and m.pool_id=p_pool_id and t.withdrawn_at is null
  ), played as (
    select g.id,r.home_score,r.away_score,r.winner_team_id,g.tournament_home_team_id home_id,g.tournament_away_team_id away_id,r.result_status
    from public.games g join public.tournament_game_results r on r.organization_id=g.organization_id and r.game_id=g.id
    where g.organization_id=v_org and g.tournament_pool_id=p_pool_id and r.result_status in ('final','forfeited')
  ), stats as (
    select t.team_id,t.name,count(p.id)::integer games_played,
      count(*) filter(where p.winner_team_id=t.team_id)::integer wins,
      count(*) filter(where p.winner_team_id is not null and p.winner_team_id<>t.team_id)::integer losses,
      count(*) filter(where p.winner_team_id is null and p.home_score=p.away_score)::integer ties,
      coalesce(sum(case when p.home_id=t.team_id then p.home_score else p.away_score end),0)::integer points_for,
      coalesce(sum(case when p.home_id=t.team_id then p.away_score else p.home_score end),0)::integer points_against,
      coalesce(sum(greatest(-coalesce(v_rule.differential_cap,2147483647),least(coalesce(v_rule.differential_cap,2147483647),(case when p.home_id=t.team_id then p.home_score-p.away_score else p.away_score-p.home_score end)))),0)::integer score_differential,
      (count(*) filter(where p.winner_team_id=t.team_id)*coalesce(v_rule.win_points,3)+count(*) filter(where p.winner_team_id is null and p.home_score=p.away_score)*coalesce(v_rule.tie_points,1)+count(*) filter(where p.winner_team_id is not null and p.winner_team_id<>t.team_id)*coalesce(v_rule.loss_points,0))::numeric standings_points
    from teams t left join played p on t.team_id in(p.home_id,p.away_id) group by t.team_id,t.name
  ), enriched_base as (
    select s.*,case when games_played=0 then 0 else (wins+ties*0.5)/games_played::numeric end win_percentage,mt.priority manual_priority,mt.reason manual_reason from stats s left join public.tournament_manual_tiebreaks mt on mt.organization_id=v_org and mt.pool_id=p_pool_id and mt.team_id=s.team_id
  ), peer_counts as (
    select e.*,count(*) over(partition by standings_points,win_percentage) peer_count from enriched_base e
  ), enriched as (
    select e.*,case when peer_count=2 then coalesce((select sum(case when p.winner_team_id=e.team_id then coalesce(v_rule.win_points,3) when p.winner_team_id is null then coalesce(v_rule.tie_points,1) else coalesce(v_rule.loss_points,0) end) from played p join peer_counts opponent on opponent.team_id<>e.team_id and opponent.standings_points=e.standings_points and opponent.win_percentage=e.win_percentage where e.team_id in(p.home_id,p.away_id) and opponent.team_id in(p.home_id,p.away_id)),0) end head_to_head_points from peer_counts e
  ), ranked as (
    select e.*,dense_rank() over(order by standings_points desc,win_percentage desc,head_to_head_points desc nulls last,score_differential desc,points_for desc,manual_priority asc nulls last) seed,
      count(*) over(partition by standings_points,win_percentage,head_to_head_points,score_differential,points_for,coalesce(manual_priority,2147483647))>1 unresolved_tie
    from enriched e
  )
  select jsonb_build_object('pool_id',p_pool_id,'tiebreak_order',coalesce(to_jsonb(v_rule.tiebreak_order),'["points","win_percentage","head_to_head","score_differential","points_for","manual"]'::jsonb),'differential_cap',v_rule.differential_cap,'rows',coalesce(jsonb_agg(to_jsonb(r) order by seed,name),'[]'::jsonb)) into v_result from ranked r;
  return v_result;
end $$;

create or replace function public.generate_tournament_bracket(p_division_id uuid,p_qualifiers jsonb,p_name text default 'Championship Bracket')
returns public.tournament_brackets language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_org uuid:=private.require_tournament_admin(); v_div public.tournament_divisions%rowtype; v_bracket public.tournament_brackets%rowtype; v_count integer; v_size integer; v_key text; v_rounds integer; r integer; g integer; v_round_id uuid; v_game_id uuid; v_seed_order integer[]; v_home jsonb; v_away jsonb;
begin
  select * into v_div from public.tournament_divisions where organization_id=v_org and id=p_division_id;
  if v_div.id is null then raise exception 'tournament_division_not_found'; end if;
  if jsonb_typeof(p_qualifiers)<>'array' then raise exception 'tournament_qualifiers_invalid'; end if;
  v_count:=jsonb_array_length(p_qualifiers); if v_count<3 or v_count>8 then raise exception 'tournament_bracket_size_invalid'; end if;
  v_size:=case when v_count<=4 then 4 else 8 end; v_rounds:=case when v_size=4 then 2 else 3 end;
  if exists(select 1 from public.games g left join public.tournament_game_results tr on tr.organization_id=g.organization_id and tr.game_id=g.id where g.organization_id=v_org and g.tournament_division_id=v_div.id and g.tournament_pool_id is not null and (tr.id is null or tr.result_status not in ('final','forfeited','cancelled'))) then raise exception 'tournament_pool_results_incomplete'; end if;
  if exists(select 1 from jsonb_array_elements(p_qualifiers) q where not exists(select 1 from public.tournament_teams t where t.organization_id=v_org and t.id=(q->>'team_id')::uuid and t.division_id=v_div.id and t.withdrawn_at is null)) then raise exception 'tournament_qualifier_invalid'; end if;
  if (select count(distinct (q->>'seed')::integer) from jsonb_array_elements(p_qualifiers) q)<>v_count or (select min((q->>'seed')::integer) from jsonb_array_elements(p_qualifiers) q)<>1 then raise exception 'tournament_seeds_invalid'; end if;
  v_key:=md5(p_division_id::text||':'||p_qualifiers::text);
  select * into v_bracket from public.tournament_brackets where organization_id=v_org and division_id=v_div.id and generation_key=v_key;
  if v_bracket.id is not null then return v_bracket; end if;
  if exists(select 1 from public.tournament_brackets b join public.tournament_bracket_games bg on bg.organization_id=b.organization_id and bg.bracket_id=b.id join public.tournament_game_results tr on tr.organization_id=bg.organization_id and tr.game_id=bg.canonical_game_id where b.organization_id=v_org and b.division_id=v_div.id and tr.result_status in ('final','forfeited')) then raise exception 'tournament_bracket_regeneration_locked'; end if;
  delete from public.tournament_brackets where organization_id=v_org and division_id=v_div.id;
  insert into public.tournament_brackets(organization_id,tournament_id,division_id,name,bracket_size,standings_snapshot,seeding_rule,generation_key,generated_by_profile_id) values(v_org,v_div.tournament_id,v_div.id,btrim(p_name),v_size,p_qualifiers,'Pool standings; points, win percentage, head-to-head when valid, capped differential, points for, manual decision',v_key,public.current_profile_id()) returning * into v_bracket;
  v_seed_order:=case when v_size=4 then array[1,4,2,3] else array[1,8,4,5,2,7,3,6] end;
  for r in 1..v_rounds loop
    insert into public.tournament_bracket_rounds(organization_id,bracket_id,round_number,name) values(v_org,v_bracket.id,r,case when r=v_rounds then 'Championship' when r=v_rounds-1 then 'Semifinal' else 'Quarterfinal' end) returning id into v_round_id;
    for g in 1..(v_size/(2^r)::integer) loop
      if r=1 then
        select q into v_home from jsonb_array_elements(p_qualifiers) q where (q->>'seed')::integer=v_seed_order[(g-1)*2+1];
        select q into v_away from jsonb_array_elements(p_qualifiers) q where (q->>'seed')::integer=v_seed_order[(g-1)*2+2];
      else v_home:=null; v_away:=null; end if;
      insert into public.tournament_bracket_games(organization_id,tournament_id,division_id,bracket_id,round_id,round_number,game_number,home_team_id,away_team_id,home_seed,away_seed)
      values(v_org,v_div.tournament_id,v_div.id,v_bracket.id,v_round_id,r,g,(v_home->>'team_id')::uuid,(v_away->>'team_id')::uuid,(v_home->>'seed')::integer,(v_away->>'seed')::integer) returning id into v_game_id;
    end loop;
  end loop;
  for r in 1..v_rounds-1 loop
    for g in 1..(v_size/(2^r)::integer) loop
      update public.tournament_bracket_games current_game set next_game_id=next_game.id,next_slot=case when g%2=1 then 'home' else 'away' end
      from public.tournament_bracket_games next_game where current_game.organization_id=v_org and current_game.bracket_id=v_bracket.id and current_game.round_number=r and current_game.game_number=g and next_game.organization_id=v_org and next_game.bracket_id=v_bracket.id and next_game.round_number=r+1 and next_game.game_number=ceil(g/2.0)::integer;
    end loop;
  end loop;
  insert into public.workspace_audit_events(organization_id,actor_auth_user_id,action,entity_type,entity_id,metadata) values(v_org,(select auth.uid()),'tournament.bracket_generated','tournament_bracket',v_bracket.id,jsonb_build_object('division_id',v_div.id,'bracket_size',v_size,'standings_snapshot',p_qualifiers));
  return v_bracket;
end $$;

create or replace function public.schedule_tournament_bracket_game(p_bracket_game_id uuid,p_game_date date,p_game_time time,p_location_id uuid,p_field_id uuid)
returns public.games language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_org uuid:=private.require_tournament_admin(); v_bg public.tournament_bracket_games%rowtype; v_div public.tournament_divisions%rowtype; v_t public.tournaments%rowtype; v_game public.games%rowtype; v_season uuid; v_starts timestamptz; v_ends timestamptz;
begin
  select * into v_bg from public.tournament_bracket_games where organization_id=v_org and id=p_bracket_game_id for update;
  if v_bg.id is null or v_bg.home_team_id is null or v_bg.away_team_id is null then raise exception 'tournament_bracket_matchup_incomplete'; end if;
  if v_bg.canonical_game_id is not null then select * into v_game from public.games where organization_id=v_org and id=v_bg.canonical_game_id; return v_game; end if;
  select * into v_div from public.tournament_divisions where organization_id=v_org and id=v_bg.division_id; select * into v_t from public.tournaments where organization_id=v_org and id=v_bg.tournament_id;
  select season_id into v_season from public.games where organization_id=v_org and tournament_id=v_bg.tournament_id order by created_at limit 1;
  if v_season is null then select id into v_season from public.seasons where organization_id=v_org order by starts_on desc limit 1; end if;
  if v_season is null then raise exception 'tournament_season_anchor_missing'; end if;
  v_starts:=make_timestamptz(extract(year from p_game_date)::int,extract(month from p_game_date)::int,extract(day from p_game_date)::int,extract(hour from p_game_time)::int,extract(minute from p_game_time)::int,0,v_t.timezone); v_ends:=v_starts+make_interval(mins=>v_div.game_duration_minutes);
  insert into public.games(organization_id,season_id,location_id,field_id,game_date,game_time,timezone,home_team,away_team,level,game_type,created_by_profile_id,game_domain,duration_minutes,tournament_id,tournament_division_id,tournament_home_team_id,tournament_away_team_id)
  select v_org,v_season,p_location_id,p_field_id,p_game_date,p_game_time,v_t.timezone,h.name,a.name,v_div.name,'tournament_elimination',public.current_profile_id(),'tournament',v_div.game_duration_minutes,v_t.id,v_div.id,h.id,a.id from public.tournament_teams h join public.tournament_teams a on a.organization_id=h.organization_id where h.organization_id=v_org and h.id=v_bg.home_team_id and a.id=v_bg.away_team_id returning * into v_game;
  insert into public.field_reservations(organization_id,field_id,game_id,reservation_type,title,starts_at,ends_at,notes,created_by_profile_id) values(v_org,p_field_id,v_game.id,'tournament',v_t.name||' elimination game',v_starts,v_ends,'Tournament bracket',public.current_profile_id());
  update public.tournament_bracket_games set canonical_game_id=v_game.id,updated_at=now() where id=v_bg.id;
  update public.tournament_brackets set status='in_progress',updated_at=now() where id=v_bg.bracket_id;
  insert into public.workspace_audit_events(organization_id,actor_auth_user_id,action,entity_type,entity_id,metadata) values(v_org,(select auth.uid()),'tournament.bracket_game_scheduled','tournament_bracket_game',v_bg.id,jsonb_build_object('game_id',v_game.id,'field_id',p_field_id)); return v_game;
exception when exclusion_violation or unique_violation then raise exception using errcode='23P01',message='tournament_field_conflict';
end $$;

do $$ declare p regprocedure; begin
  foreach p in array array[
    'public.save_tournament_scoring_rules(jsonb)'::regprocedure,
    'public.save_tournament_game_result(uuid,text,integer,integer,uuid,text)'::regprocedure,
    'public.save_tournament_manual_tiebreak(uuid,uuid,integer,text)'::regprocedure,
    'public.get_tournament_pool_standings(uuid)'::regprocedure,
    'public.generate_tournament_bracket(uuid,jsonb,text)'::regprocedure,
    'public.schedule_tournament_bracket_game(uuid,date,time,uuid,uuid)'::regprocedure
  ] loop execute format('revoke all on function %s from public,anon',p); execute format('grant execute on function %s to authenticated',p); end loop;
end $$;
