create function public.reject_umpire_profile(
  p_target_profile_id uuid,
  p_reason text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := public.current_profile_id();
  v_org uuid := public.current_organization_id();
  v_profile public.profiles%rowtype;
begin
  if not public.is_administrator() then raise exception 'account_rejection_unauthorized'; end if;
  select * into v_profile from public.profiles
    where id = p_target_profile_id and organization_id = v_org for update;
  if not found then raise exception 'account_rejection_not_found'; end if;
  if v_profile.role <> 'umpire' or v_profile.status <> 'pending' then raise exception 'account_rejection_not_pending'; end if;

  update public.profiles set status = 'rejected', rejected_at = now(), approved_at = null
    where id = v_profile.id returning * into v_profile;
  insert into public.notifications (organization_id,type,audience,recipient_profile_id,title,message,destination_page)
    values (v_org,'account-rejected','account',v_profile.id,'Account Rejected','Your account for The Slate was not approved.','login');
  insert into public.activities (organization_id,actor_profile_id,type,action,subject,message,metadata)
    values (v_org,v_actor,'account','account_rejected',concat_ws(' ',v_profile.first_name,v_profile.last_name),'Pending umpire account rejected.',jsonb_build_object('profileId',v_profile.id,'reason',nullif(btrim(p_reason),'')));
  return v_profile;
end;
$$;

create function public.remove_game_assignment_crew(p_assignment_id uuid)
returns public.game_assignments
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := public.current_profile_id();
  v_org uuid := public.current_organization_id();
  v_assignment public.game_assignments%rowtype;
  v_game public.games%rowtype;
  v_removed_profile uuid;
begin
  if not public.is_assigner_or_administrator() then raise exception 'assignment_removal_unauthorized'; end if;
  select * into v_assignment from public.game_assignments
    where id = p_assignment_id and organization_id = v_org for update;
  if not found then raise exception 'assignment_removal_not_found'; end if;
  select * into v_game from public.games where id = v_assignment.game_id and organization_id = v_org for update;
  if v_assignment.locked or v_assignment.status = 'locked' then raise exception 'assignment_removal_locked'; end if;
  if v_game.lifecycle_status in ('completed','submitted','approved','cancelled') then raise exception 'assignment_removal_finalized'; end if;
  if v_assignment.assigned_crew_member_id is null then raise exception 'assignment_removal_unassigned'; end if;
  select profile_id into v_removed_profile from public.crew_members
    where id = v_assignment.assigned_crew_member_id and organization_id = v_org;

  update public.game_assignments set assigned_crew_member_id = null,status = 'needs_assignment',locked = false,accepted_at = null
    where id = v_assignment.id returning * into v_assignment;
  if v_removed_profile is not null then
    insert into public.notifications (organization_id,type,audience,recipient_profile_id,title,message,destination_page,destination_context)
      values (v_org,'assignment-removed','account',v_removed_profile,'Assignment Removed',concat(v_game.away_team,' @ ',v_game.home_team,' assignment was removed.'),'my-schedule',jsonb_build_object('gameId',v_game.id));
  end if;
  insert into public.activities (organization_id,actor_profile_id,type,action,subject,message,metadata)
    values (v_org,v_actor,'assignment','assignment_removed',v_assignment.position,concat(v_assignment.position,' removed from ',v_game.away_team,' @ ',v_game.home_team,'.'),jsonb_build_object('gameId',v_game.id,'assignmentId',v_assignment.id));
  return v_assignment;
end;
$$;

revoke all on function public.reject_umpire_profile(uuid,text) from public;
revoke all on function public.remove_game_assignment_crew(uuid) from public;
grant execute on function public.reject_umpire_profile(uuid,text) to authenticated;
grant execute on function public.remove_game_assignment_crew(uuid) to authenticated;
