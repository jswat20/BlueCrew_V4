-- Qualify validation aliases in the proposal RPC after staging smoke testing.
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
      and d.season_id=(p_payload->>'season_id')::uuid and d.active and l.active) then raise exception using message='league_catalog_selection_invalid'; end if;
  if exists(select 1 from unnest(v_team_ids) as selected(team_id) where not exists(select 1 from public.teams t where t.organization_id=v_org and t.id=selected.team_id
    and t.division_id=(p_payload->>'division_id')::uuid and t.season_id=(p_payload->>'season_id')::uuid and t.active)) then raise exception using message='proposal_team_invalid'; end if;
  if exists(select 1 from unnest(coalesce(v_field_ids,'{}'::uuid[])) as selected(field_id) where not exists(select 1 from public.fields f join public.locations l
    on l.organization_id=f.organization_id and l.id=f.location_id where f.organization_id=v_org and f.id=selected.field_id and f.active and l.active)) then raise exception using message='proposal_field_invalid'; end if;
  insert into public.league_schedule_proposals(organization_id,sport,season_id,league_id,division_id,name,configuration,generation_summary,created_by_profile_id)
  values(v_org,btrim(p_payload->>'sport'),(p_payload->>'season_id')::uuid,(p_payload->>'league_id')::uuid,(p_payload->>'division_id')::uuid,
    coalesce(nullif(btrim(p_payload->>'name'),''),'League schedule proposal'),p_payload-'games',coalesce(p_payload->'summary','{}'::jsonb),v_actor) returning * into v_proposal;
  for v_item in select value from jsonb_array_elements(p_payload->'games') loop
    v_ordinal:=v_ordinal+1;
    if not ((v_item->>'home_team_id')::uuid=any(v_team_ids) and (v_item->>'away_team_id')::uuid=any(v_team_ids)) then raise exception using message='proposal_team_invalid'; end if;
    if v_item->>'state'='scheduled' and not ((v_item->>'field_id')::uuid=any(v_field_ids)) then raise exception using message='proposal_field_invalid'; end if;
    insert into public.league_schedule_proposal_games(organization_id,proposal_id,ordinal,home_team_id,away_team_id,game_date,game_time,duration_minutes,location_id,field_id,state,issue,notes)
    values(v_org,v_proposal.id,v_ordinal,(v_item->>'home_team_id')::uuid,(v_item->>'away_team_id')::uuid,
      nullif(v_item->>'game_date','')::date,nullif(v_item->>'game_time','')::time,coalesce((v_item->>'duration_minutes')::integer,90),
      nullif(v_item->>'location_id','')::uuid,nullif(v_item->>'field_id','')::uuid,coalesce(v_item->>'state','unscheduled'),coalesce(v_item->>'issue',''),coalesce(v_item->>'notes',''));
  end loop;
  insert into public.workspace_audit_events(organization_id,actor_auth_user_id,action,entity_type,entity_id,metadata)
  values(v_org,(select auth.uid()),'league_schedule_proposal.created','league_schedule_proposal',v_proposal.id,jsonb_build_object('games',v_ordinal,'scheduled',coalesce((p_payload->'summary'->>'scheduled')::integer,0)));
  return v_proposal;
end; $$;
revoke all on function public.save_league_schedule_proposal(jsonb) from public,anon;
grant execute on function public.save_league_schedule_proposal(jsonb) to authenticated;
