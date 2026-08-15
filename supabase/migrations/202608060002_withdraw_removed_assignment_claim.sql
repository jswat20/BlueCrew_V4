-- Preserve an approved claim as non-blocking history when an administrator
-- removes its assigned crew member. "withdrawn" already exists in claim_status.

create or replace function public.protect_claim_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then return new; end if;
  if tg_op = 'INSERT' then
    if new.status <> 'pending' then raise exception 'New claims must start pending'; end if;
    return new;
  end if;
  if old.status = 'pending' and new.status in ('pending','approved','rejected','withdrawn') then
    if new.status in ('approved','rejected','withdrawn') and (new.decided_at is null or new.decision_by_profile_id is null) then
      raise exception 'Claim decisions require decision timestamp and actor';
    end if;
    return new;
  end if;
  if old.status = 'approved' and new.status = 'withdrawn'
    and new.decided_at is not null and new.decision_by_profile_id is not null
    and nullif(btrim(new.decision_reason), '') is not null then
    return new;
  end if;
  raise exception 'Invalid claim status transition from % to %', old.status, new.status;
end;
$$;

create or replace function public.remove_game_assignment_crew(p_assignment_id uuid)
returns public.game_assignments
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := public.current_profile_id(); v_org uuid := public.current_organization_id();
  v_assignment public.game_assignments%rowtype; v_game public.games%rowtype; v_removed_profile uuid;
begin
  if not public.is_assigner_or_administrator() then raise exception 'assignment_removal_unauthorized'; end if;
  select * into v_assignment from public.game_assignments where id=p_assignment_id and organization_id=v_org for update;
  if not found then raise exception 'assignment_removal_not_found'; end if;
  select * into v_game from public.games where id=v_assignment.game_id and organization_id=v_org for update;
  if v_assignment.locked or v_assignment.status='locked' then raise exception 'assignment_removal_locked'; end if;
  if v_game.lifecycle_status in ('completed','submitted','approved','cancelled') then raise exception 'assignment_removal_finalized'; end if;
  if v_assignment.assigned_crew_member_id is null then raise exception 'assignment_removal_unassigned'; end if;
  select profile_id into v_removed_profile from public.crew_members where id=v_assignment.assigned_crew_member_id and organization_id=v_org;

  update public.assignment_claims
    set status='withdrawn', decision_by_profile_id=v_actor, decided_at=now(),
        decision_reason='Administrative assignment removal', updated_at=now()
    where organization_id=v_org and assignment_id=v_assignment.id and status='approved';
  update public.game_assignments set assigned_crew_member_id=null,status='needs_assignment',locked=false,accepted_at=null,updated_at=now()
    where id=v_assignment.id returning * into v_assignment;
  if v_removed_profile is not null then
    insert into public.notifications (organization_id,type,audience,recipient_profile_id,title,message,destination_page,destination_context)
      values (v_org,'assignment-removed','account',v_removed_profile,'Assignment Removed',concat(v_game.away_team,' @ ',v_game.home_team,' assignment was removed.'),'claim-games',jsonb_build_object('gameId',v_game.id));
  end if;
  insert into public.activities (organization_id,actor_profile_id,type,action,subject,message,metadata)
    values (v_org,v_actor,'assignment','assignment_removed',v_assignment.position,concat(v_assignment.position,' removed from ',v_game.away_team,' @ ',v_game.home_team,'.'),jsonb_build_object('gameId',v_game.id,'assignmentId',v_assignment.id,'claimStatus','withdrawn'));
  return v_assignment;
end;
$$;

drop policy if exists assignments_select_member on public.game_assignments;
create policy assignments_select_member on public.game_assignments for select to authenticated using (
  organization_id=public.current_organization_id() and (
    public.is_assigner_or_administrator() or (
      public.current_account_role()='umpire' and (
        assigned_crew_member_id=public.current_crew_member_id() or status='open_for_claim'
        or (status='needs_assignment' and exists (select 1 from public.assignment_claims c where c.organization_id=game_assignments.organization_id and c.assignment_id=game_assignments.id and c.status='withdrawn'))
        or exists (select 1 from public.assignment_claims c where c.organization_id=game_assignments.organization_id and c.assignment_id=game_assignments.id and c.claimant_crew_member_id=public.current_crew_member_id())
      )
    )
  )
);

create or replace function public.submit_assignment_claim(p_assignment_id uuid)
returns public.assignment_claims language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_org uuid:=public.current_organization_id(); v_crew uuid:=public.current_crew_member_id();
  v_assignment public.game_assignments; v_claim public.assignment_claims; v_game public.games; v_claimant public.crew_members;
begin
  if v_org is null or v_crew is null or public.current_account_role()<>'umpire' or not public.is_approved_account() then raise exception using errcode='P0001',message='claim_identity_required'; end if;
  select * into v_assignment from public.game_assignments where id=p_assignment_id and organization_id=v_org for update;
  if v_assignment.id is null or v_assignment.locked or not (
    v_assignment.status='open_for_claim' or (
      v_assignment.status='needs_assignment' and exists(select 1 from public.assignment_claims c where c.organization_id=v_org and c.assignment_id=v_assignment.id and c.status='withdrawn')
    )
  ) then raise exception using errcode='P0001',message='assignment_already_claimed'; end if;
  select * into v_game from public.games where id=v_assignment.game_id and organization_id=v_org;
  select * into v_claimant from public.crew_members where id=v_crew and organization_id=v_org;
  if v_game.id is null then raise exception using errcode='P0001',message='claim_game_not_found'; end if;
  if v_claimant.id is null then raise exception using errcode='P0001',message='claimant_not_found'; end if;
  insert into public.assignment_claims(organization_id,assignment_id,claimant_crew_member_id,status) values(v_org,v_assignment.id,v_crew,'pending') returning * into v_claim;
  update public.game_assignments set status='pending_approval',updated_at=now() where id=v_assignment.id and organization_id=v_org;
  perform public.notify_organization_administrators(v_org,'claim-submitted','Game Claimed',concat(concat_ws(' ',v_claimant.first_name,v_claimant.last_name),' claimed ',v_assignment.position,' for ',v_game.away_team,' @ ',v_game.home_team,'.'),'claims');
  return v_claim;
end;
$$;

revoke all on function public.submit_assignment_claim(uuid) from public;
grant execute on function public.submit_assignment_claim(uuid) to authenticated;
