-- Milestone 7.3B: atomic hosted direct-assignment and self-decline commands.

create or replace function public.assign_game_assignment_crew(
  p_assignment_id uuid,
  p_crew_member_id uuid
)
returns public.game_assignments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid := public.current_organization_id();
  v_actor uuid := public.current_profile_id();
  v_assignment public.game_assignments;
  v_game public.games;
  v_crew public.crew_members;
begin
  if v_org is null or v_actor is null or not public.is_assigner_or_administrator() then
    raise exception using errcode='P0001', message='assignment_direct_forbidden';
  end if;
  select * into v_assignment from public.game_assignments
   where id=p_assignment_id and organization_id=v_org for update;
  if v_assignment.id is null then raise exception using errcode='P0001',message='assignment_direct_not_found'; end if;
  select * into v_game from public.games where id=v_assignment.game_id and organization_id=v_org;
  if v_game.id is null then raise exception using errcode='P0001',message='assignment_direct_game_not_found'; end if;
  if v_assignment.locked or v_assignment.status='locked' then raise exception using errcode='P0001',message='assignment_direct_locked'; end if;
  if v_game.lifecycle_status in ('completed','submitted','approved','cancelled') then raise exception using errcode='P0001',message='assignment_direct_finalized'; end if;
  select * into v_crew from public.crew_members where id=p_crew_member_id and organization_id=v_org and active=true;
  if v_crew.id is null then raise exception using errcode='P0001',message='assignment_direct_crew_not_found'; end if;
  if v_assignment.assigned_crew_member_id=p_crew_member_id and v_assignment.status='assigned' then return v_assignment; end if;
  if v_assignment.assigned_crew_member_id is not null then raise exception using errcode='P0001',message='assignment_direct_already_assigned'; end if;

  update public.game_assignments set assigned_crew_member_id=p_crew_member_id,status='assigned',locked=false,
    declined_at=null,decline_reason=null,updated_at=now()
   where id=v_assignment.id and organization_id=v_org returning * into v_assignment;
  insert into public.activities(organization_id,actor_profile_id,type,action,subject,message,metadata)
  values(v_org,v_actor,'assignment','assignment_assigned',v_assignment.position,
    concat(v_assignment.position,' assigned.'),jsonb_build_object('gameId',v_game.id,'assignmentId',v_assignment.id,'crewMemberId',p_crew_member_id));
  return v_assignment;
end;
$$;

create or replace function public.decline_own_game_assignment(
  p_assignment_id uuid,
  p_reason text
)
returns public.game_assignments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid := public.current_organization_id();
  v_actor uuid := public.current_profile_id();
  v_crew uuid := public.current_crew_member_id();
  v_assignment public.game_assignments;
  v_game public.games;
  v_reason text := nullif(btrim(p_reason),'');
  v_reopen public.assignment_status;
begin
  if v_org is null or v_actor is null or v_crew is null or public.current_account_role()<>'umpire' or not public.is_approved_account() then
    raise exception using errcode='P0001',message='assignment_decline_identity_required';
  end if;
  if v_reason is null then raise exception using errcode='P0001',message='assignment_decline_reason_required'; end if;
  select * into v_assignment from public.game_assignments
   where id=p_assignment_id and organization_id=v_org for update;
  if v_assignment.id is null or v_assignment.assigned_crew_member_id<>v_crew or v_assignment.status not in ('assigned','locked') then
    raise exception using errcode='P0001',message='assignment_decline_not_assigned';
  end if;
  select * into v_game from public.games where id=v_assignment.game_id and organization_id=v_org;
  if v_game.id is null then raise exception using errcode='P0001',message='assignment_decline_game_not_found'; end if;
  if v_game.lifecycle_status in ('completed','submitted','approved','cancelled') then raise exception using errcode='P0001',message='assignment_decline_finalized'; end if;
  v_reopen := case when exists(select 1 from public.assignment_claims claim where claim.organization_id=v_org and claim.assignment_id=v_assignment.id)
    then 'open_for_claim'::public.assignment_status else 'needs_assignment'::public.assignment_status end;
  update public.game_assignments set assigned_crew_member_id=null,status=v_reopen,locked=false,accepted_at=null,
    declined_at=now(),decline_reason=v_reason,updated_at=now()
   where id=v_assignment.id and organization_id=v_org returning * into v_assignment;
  insert into public.activities(organization_id,actor_profile_id,type,action,subject,message,metadata)
  values(v_org,v_actor,'assignment','assignment_declined',v_assignment.position,
    concat(v_assignment.position,' assignment declined.'),jsonb_build_object('gameId',v_game.id,'assignmentId',v_assignment.id,'reason',v_reason,'resultingStatus',v_reopen));
  return v_assignment;
end;
$$;

revoke all on function public.assign_game_assignment_crew(uuid,uuid) from public,anon;
revoke all on function public.decline_own_game_assignment(uuid,text) from public,anon;
grant execute on function public.assign_game_assignment_crew(uuid,uuid) to authenticated;
grant execute on function public.decline_own_game_assignment(uuid,text) to authenticated;
