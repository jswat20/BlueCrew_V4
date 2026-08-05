-- Milestone 5A.4: hosted game completion persistence

create or replace function public.save_own_game_completion(
  p_game_id uuid,
  p_away_score integer,
  p_home_score integer,
  p_notes text
)
returns public.games
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_organization_id uuid := public.current_organization_id();
  v_profile_id uuid := public.current_profile_id();
  v_crew_member_id uuid := public.current_crew_member_id();
  v_game public.games;
  v_assignment public.game_assignments;
  v_now timestamptz := now();
  v_scheduled_start timestamptz;
  v_completion jsonb;
  v_report jsonb;
  v_review jsonb;
begin
  if auth.uid() is null
    or v_organization_id is null
    or v_profile_id is null
    or v_crew_member_id is null
    or public.current_account_role() <> 'umpire'
    or not public.is_approved_account() then
    raise exception using
      errcode = 'P0001',
      message = 'game_completion_identity_required';
  end if;

  if p_game_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'game_completion_game_required';
  end if;

  if p_away_score is null
    or p_home_score is null
    or p_away_score < 0
    or p_home_score < 0 then
    raise exception using
      errcode = 'P0001',
      message = 'game_completion_invalid_score';
  end if;

  select *
  into v_game
  from public.games
  where id = p_game_id
    and organization_id = v_organization_id
  for update;

  if v_game.id is null then
    raise exception using
      errcode = 'P0001',
      message = 'game_completion_not_found';
  end if;

  select *
  into v_assignment
  from public.game_assignments
  where game_id = v_game.id
    and organization_id = v_organization_id
    and assigned_crew_member_id = v_crew_member_id
    and status in ('assigned', 'locked')
  order by id
  limit 1
  for update;

  if v_assignment.id is null then
    raise exception using
      errcode = 'P0001',
      message = 'game_completion_not_assigned';
  end if;

  if v_game.lifecycle_status = 'cancelled' then
    raise exception using
      errcode = 'P0001',
      message = 'game_completion_cancelled';
  end if;

  if v_game.lifecycle_status = 'approved'
    or coalesce(v_game.review ->> 'status', '') = 'approved'
    or coalesce((v_game.review ->> 'finalized')::boolean, false) then
    raise exception using
      errcode = 'P0001',
      message = 'game_completion_finalized';
  end if;

  if v_game.lifecycle_status not in ('scheduled', 'returned') then
    raise exception using
      errcode = 'P0001',
      message = 'game_completion_not_editable';
  end if;

  begin
    v_scheduled_start :=
      (
        v_game.game_date::text ||
        ' ' ||
        v_game.game_time::text
      )::timestamp
      at time zone coalesce(
        nullif(v_game.timezone, ''),
        'America/New_York'
      );
  exception
    when others then
      raise exception using
        errcode = 'P0001',
        message = 'game_completion_start_unavailable';
  end;

  if v_now <= v_scheduled_start then
    raise exception using
      errcode = 'P0001',
      message = 'game_completion_too_early';
  end if;

  v_completion := jsonb_build_object(
    'completed', true,
    'completionTime', coalesce(
      v_game.report #>> '{completion,completionTime}',
      v_now::text
    ),
    'completedByProfileId', v_profile_id,
    'completedByCrewMemberId', v_crew_member_id,
    'completionStatus', 'completed',
    'awayScore', p_away_score,
    'homeScore', p_home_score,
    'notes', btrim(coalesce(p_notes, ''))
  );

  v_report :=
    coalesce(v_game.report, '{}'::jsonb)
    || jsonb_build_object(
      'completion', v_completion,
      'notes', btrim(coalesce(p_notes, ''))
    );

  -- Saving a returned correction keeps it in returned state until the umpire
  -- explicitly resubmits through the existing review workflow.
  v_review :=
    case
      when v_game.lifecycle_status = 'returned'
        then coalesce(v_game.review, '{}'::jsonb)
      else
        coalesce(v_game.review, '{}'::jsonb)
        - 'returnedAt'
        - 'returnedBy'
        - 'returnReason'
    end;

  update public.games
  set
    lifecycle_status = case
      when v_game.lifecycle_status = 'returned' then 'returned'
      else 'completed'
    end,
    report = v_report,
    review = v_review,
    updated_at = v_now
  where id = v_game.id
    and organization_id = v_organization_id
  returning * into v_game;

  return v_game;
end;
$$;

revoke all on function public.save_own_game_completion(
  uuid,
  integer,
  integer,
  text
) from public;

grant execute on function public.save_own_game_completion(
  uuid,
  integer,
  integer,
  text
) to authenticated;
