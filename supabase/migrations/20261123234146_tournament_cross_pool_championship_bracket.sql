-- Permit one tournament-wide championship bracket to seed qualifiers from
-- multiple pools/divisions while retaining a division as its scheduling anchor.
create or replace function public.generate_tournament_bracket(p_division_id uuid,p_qualifiers jsonb,p_name text default 'Championship Bracket')
returns public.tournament_brackets language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_org uuid:=private.require_tournament_admin(); v_div public.tournament_divisions%rowtype; v_bracket public.tournament_brackets%rowtype; v_count integer; v_size integer; v_key text; v_rounds integer; r integer; g integer; v_round_id uuid; v_game_id uuid; v_seed_order integer[]; v_home jsonb; v_away jsonb;
begin
  select * into v_div from public.tournament_divisions where organization_id=v_org and id=p_division_id;
  if v_div.id is null then raise exception 'tournament_division_not_found'; end if;
  if jsonb_typeof(p_qualifiers)<>'array' then raise exception 'tournament_qualifiers_invalid'; end if;
  v_count:=jsonb_array_length(p_qualifiers); if v_count<3 or v_count>8 then raise exception 'tournament_bracket_size_invalid'; end if;
  v_size:=case when v_count<=4 then 4 else 8 end; v_rounds:=case when v_size=4 then 2 else 3 end;
  if exists(select 1 from public.games g left join public.tournament_game_results tr on tr.organization_id=g.organization_id and tr.game_id=g.id where g.organization_id=v_org and g.tournament_id=v_div.tournament_id and g.tournament_pool_id is not null and (tr.id is null or tr.result_status not in ('final','forfeited','cancelled'))) then raise exception 'tournament_pool_results_incomplete'; end if;
  if exists(select 1 from jsonb_array_elements(p_qualifiers) q where not exists(select 1 from public.tournament_teams t where t.organization_id=v_org and t.id=(q->>'team_id')::uuid and t.tournament_id=v_div.tournament_id and t.withdrawn_at is null)) then raise exception 'tournament_qualifier_invalid'; end if;
  if (select count(distinct (q->>'seed')::integer) from jsonb_array_elements(p_qualifiers) q)<>v_count or (select min((q->>'seed')::integer) from jsonb_array_elements(p_qualifiers) q)<>1 then raise exception 'tournament_seeds_invalid'; end if;
  v_key:=md5(p_division_id::text||':'||p_qualifiers::text);
  select * into v_bracket from public.tournament_brackets where organization_id=v_org and division_id=v_div.id and generation_key=v_key;
  if v_bracket.id is not null then return v_bracket; end if;
  if exists(select 1 from public.tournament_brackets b join public.tournament_bracket_games bg on bg.organization_id=b.organization_id and bg.bracket_id=b.id join public.tournament_game_results tr on tr.organization_id=bg.organization_id and tr.game_id=bg.canonical_game_id where b.organization_id=v_org and b.division_id=v_div.id and tr.result_status in ('final','forfeited')) then raise exception 'tournament_bracket_regeneration_locked'; end if;
  delete from public.tournament_brackets where organization_id=v_org and division_id=v_div.id;
  insert into public.tournament_brackets(organization_id,tournament_id,division_id,name,bracket_size,standings_snapshot,seeding_rule,generation_key,generated_by_profile_id) values(v_org,v_div.tournament_id,v_div.id,btrim(p_name),v_size,p_qualifiers,'Tournament pool standings; points, win percentage, head-to-head when valid, capped differential, points for, manual decision',v_key,public.current_profile_id()) returning * into v_bracket;
  v_seed_order:=case when v_size=4 then array[1,4,2,3] else array[1,8,4,5,2,7,3,6] end;
  for r in 1..v_rounds loop
    insert into public.tournament_bracket_rounds(organization_id,bracket_id,round_number,name) values(v_org,v_bracket.id,r,case when r=v_rounds then 'Championship' when r=v_rounds-1 then 'Semifinal' else 'Quarterfinal' end) returning id into v_round_id;
    for g in 1..(v_size/(2^r)::integer) loop
      if r=1 then select q into v_home from jsonb_array_elements(p_qualifiers) q where (q->>'seed')::integer=v_seed_order[(g-1)*2+1]; select q into v_away from jsonb_array_elements(p_qualifiers) q where (q->>'seed')::integer=v_seed_order[(g-1)*2+2]; else v_home:=null; v_away:=null; end if;
      insert into public.tournament_bracket_games(organization_id,tournament_id,division_id,bracket_id,round_id,round_number,game_number,home_team_id,away_team_id,home_seed,away_seed)
      values(v_org,v_div.tournament_id,v_div.id,v_bracket.id,v_round_id,r,g,(v_home->>'team_id')::uuid,(v_away->>'team_id')::uuid,(v_home->>'seed')::integer,(v_away->>'seed')::integer) returning id into v_game_id;
    end loop;
  end loop;
  for r in 1..v_rounds-1 loop for g in 1..(v_size/(2^r)::integer) loop
    update public.tournament_bracket_games current_game set next_game_id=next_game.id,next_slot=case when g%2=1 then 'home' else 'away' end from public.tournament_bracket_games next_game where current_game.organization_id=v_org and current_game.bracket_id=v_bracket.id and current_game.round_number=r and current_game.game_number=g and next_game.organization_id=v_org and next_game.bracket_id=v_bracket.id and next_game.round_number=r+1 and next_game.game_number=ceil(g/2.0)::integer;
  end loop; end loop;
  insert into public.workspace_audit_events(organization_id,actor_auth_user_id,action,entity_type,entity_id,metadata) values(v_org,(select auth.uid()),'tournament.bracket_generated','tournament_bracket',v_bracket.id,jsonb_build_object('division_id',v_div.id,'bracket_size',v_size,'standings_snapshot',p_qualifiers));
  return v_bracket;
end $$;
revoke all on function public.generate_tournament_bracket(uuid,jsonb,text) from public,anon;
grant execute on function public.generate_tournament_bracket(uuid,jsonb,text) to authenticated;
