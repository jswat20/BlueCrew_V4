-- Milestone 7.3: assignment and claim communication coverage.
-- Authoritative table transitions derive organization, actor, recipient, and
-- business identifiers server-side. Provider delivery remains asynchronous.

create or replace function public.communication_assignment_metadata(
  p_assignment public.game_assignments,
  p_action_path text
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'year', extract(year from game.game_date)::integer,
    'seasonCode', coalesce(game.source_metadata ->> 'seasonCode', game.source_metadata ->> 'season_code'),
    'organizationCode', coalesce(game.source_metadata ->> 'organizationCode', organization.settings ->> 'organization_code'),
    'level', game.level,
    'sequence', coalesce(game.source_metadata ->> 'sequence', game.source_metadata ->> 'gameNumber'),
    'gameDisplay', coalesce(game.legacy_game_id, game.id::text),
    'date', game.game_date::text,
    'time', to_char(game.game_time, 'HH24:MI'),
    'location', location.name,
    'field', field.name,
    'position', p_assignment.position,
    'actionPath', p_action_path
  ))
  from public.games game
  join public.organizations organization on organization.id = game.organization_id
  left join public.locations location on location.id = game.location_id and location.organization_id = game.organization_id
  left join public.fields field on field.id = game.field_id and field.organization_id = game.organization_id
  where game.id = p_assignment.game_id and game.organization_id = p_assignment.organization_id;
$$;

create or replace function public.enqueue_profile_communication(
  p_organization_id uuid, p_type text, p_category text, p_recipient_profile_id uuid,
  p_business_key text, p_actor_profile_id uuid, p_subject_type text, p_subject_id uuid,
  p_game_id uuid, p_assignment_id uuid, p_claim_id uuid, p_occurred_at timestamptz,
  p_metadata jsonb, p_default_email boolean
)
returns public.communication_events
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles;
  v_event public.communication_events;
  v_in_app boolean;
  v_email boolean;
begin
  select * into v_profile from public.profiles
   where id = p_recipient_profile_id and organization_id = p_organization_id;
  if v_profile.id is null then raise exception 'communication_recipient_outside_organization'; end if;
  v_in_app := lower(coalesce(v_profile.communication_preferences #>> array['communicationEvents',p_type,'in_app'], 'true')) <> 'false';
  v_email := lower(coalesce(v_profile.communication_preferences #>> array['communicationEvents',p_type,'email'], p_default_email::text)) <> 'false'
    and lower(coalesce(v_profile.communication_preferences ->> 'emailEnabled', 'true')) <> 'false';
  select * into v_event from public.enqueue_communication_event(
    p_organization_id, p_type, p_category, p_recipient_profile_id, p_business_key,
    p_actor_profile_id, p_subject_type, p_subject_id, p_game_id, p_assignment_id,
    p_claim_id, p_occurred_at, p_metadata, array['in_app','email']::public.communication_channel[]
  );
  update public.communication_deliveries
     set status='skipped', retryable=false, failure_code='preference_disabled',
         failure_message='Channel disabled by communication preference.'
   where communication_event_id=v_event.id and status='pending'
     and ((channel='in_app' and not v_in_app) or (channel='email' and not v_email));
  -- Legacy RPCs already create claim-submitted, claim-approved, and
  -- assignment-removed notifications. The remaining transitions materialize
  -- their in-app channel here from the same normalized event boundary.
  if v_in_app and p_type in ('claim-rejected','claim-withdrawn','assignment-created','assignment-declined')
     and not exists (
       select 1 from public.notifications notification
       where notification.organization_id=p_organization_id
         and notification.recipient_profile_id=p_recipient_profile_id
         and notification.type=p_type
         and notification.created_at >= v_event.created_at - interval '1 second'
     ) then
    perform public.create_notification(
      p_organization_id,p_type,'account'::public.notification_audience,p_recipient_profile_id,
      case p_type when 'claim-rejected' then 'Claim Rejected' when 'claim-withdrawn' then 'Claim Withdrawn'
        when 'assignment-created' then 'Assignment Confirmed' else 'Assignment Declined' end,
      case p_type when 'claim-rejected' then 'Your claim was not approved.'
        when 'claim-withdrawn' then 'A claim was withdrawn.'
        when 'assignment-created' then 'You have been assigned a game.'
        else 'An assignment was declined.' end,
      coalesce(p_metadata->>'actionPath','')
    );
  end if;
  return v_event;
end;
$$;

create or replace function public.enqueue_claim_communication()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assignment public.game_assignments;
  v_claimant_profile uuid;
  v_admin public.profiles;
  v_metadata jsonb;
  v_actor uuid;
begin
  if tg_op='UPDATE' and new.status=old.status then return new; end if;
  select * into v_assignment from public.game_assignments
   where id=new.assignment_id and organization_id=new.organization_id;
  if v_assignment.id is null then return new; end if;
  v_metadata := public.communication_assignment_metadata(v_assignment,
    case when new.status='approved' then 'my-schedule' else 'claim-games' end);
  v_actor := coalesce(new.decision_by_profile_id, public.current_profile_id());
  select profile_id into v_claimant_profile from public.crew_members
   where id=new.claimant_crew_member_id and organization_id=new.organization_id;

  if new.status in ('approved','rejected') and v_claimant_profile is not null then
    perform public.enqueue_profile_communication(
      new.organization_id, concat('claim-',new.status), 'claims', v_claimant_profile,
      concat('claim-',new.status,':',new.id,':',v_claimant_profile), v_actor,
      'claim',new.id,v_assignment.game_id,v_assignment.id,new.id,coalesce(new.decided_at,now()),
      v_metadata,true
    );
  elsif new.status in ('pending','withdrawn') then
    for v_admin in select * from public.profiles
      where organization_id=new.organization_id and role in ('administrator','assigner') and status='approved'
    loop
      perform public.enqueue_profile_communication(
        new.organization_id, case when new.status='pending' then 'claim-submitted' else 'claim-withdrawn' end,
        'claims',v_admin.id,
        concat('claim-',new.status,':',new.id,':',v_admin.id),v_actor,'claim',new.id,
        v_assignment.game_id,v_assignment.id,new.id,coalesce(new.decided_at,new.claimed_at,now()),
        v_metadata,false
      );
    end loop;
  end if;
  return new;
exception when others then return new;
end;
$$;

drop trigger if exists assignment_claim_approved_communication on public.assignment_claims;
drop trigger if exists assignment_claim_communication on public.assignment_claims;
create trigger assignment_claim_communication
after insert or update of status on public.assignment_claims
for each row execute function public.enqueue_claim_communication();

create or replace function public.enqueue_assignment_communication()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile uuid;
  v_admin public.profiles;
  v_metadata jsonb;
  v_actor uuid := public.current_profile_id();
  v_is_decline boolean := new.declined_at is not null and new.declined_at is distinct from old.declined_at;
begin
  v_metadata := public.communication_assignment_metadata(new,'my-schedule');
  if old.assigned_crew_member_id is null and new.assigned_crew_member_id is not null
     and not exists(select 1 from public.assignment_claims claim where claim.organization_id=new.organization_id and claim.assignment_id=new.id and claim.status='approved') then
    select profile_id into v_profile from public.crew_members where id=new.assigned_crew_member_id and organization_id=new.organization_id;
    if v_profile is not null then
      perform public.enqueue_profile_communication(new.organization_id,'assignment-created','assignments',v_profile,
        concat('assignment-created:',new.id,':',new.assigned_crew_member_id,':',v_profile),v_actor,'assignment',new.id,
        new.game_id,new.id,null,coalesce(new.updated_at,now()),v_metadata,true);
    end if;
  end if;
  if old.assigned_crew_member_id is not null and new.assigned_crew_member_id is null and not v_is_decline then
    select profile_id into v_profile from public.crew_members where id=old.assigned_crew_member_id and organization_id=new.organization_id;
    if v_profile is not null then
      perform public.enqueue_profile_communication(new.organization_id,'assignment-removed','assignments',v_profile,
        concat('assignment-removed:',new.id,':',old.assigned_crew_member_id,':',v_profile),v_actor,'assignment',new.id,
        new.game_id,new.id,null,coalesce(new.updated_at,now()),v_metadata,true);
    end if;
  end if;
  if v_is_decline then
    for v_admin in select * from public.profiles where organization_id=new.organization_id and role in ('administrator','assigner') and status='approved'
    loop
      perform public.enqueue_profile_communication(new.organization_id,'assignment-declined','assignments',v_admin.id,
        concat('assignment-declined:',new.id,':',old.assigned_crew_member_id,':',v_admin.id),v_actor,'assignment',new.id,
        new.game_id,new.id,null,coalesce(new.declined_at,now()),v_metadata || jsonb_build_object('reason',new.decline_reason),false);
    end loop;
  end if;
  return new;
exception when others then return new;
end;
$$;

drop trigger if exists game_assignment_communication on public.game_assignments;
create trigger game_assignment_communication
after update of assigned_crew_member_id, declined_at on public.game_assignments
for each row execute function public.enqueue_assignment_communication();

revoke all on function public.communication_assignment_metadata(public.game_assignments,text) from public,anon,authenticated;
revoke all on function public.enqueue_profile_communication(uuid,text,text,uuid,text,uuid,text,uuid,uuid,uuid,uuid,timestamptz,jsonb,boolean) from public,anon,authenticated;
revoke all on function public.enqueue_claim_communication() from public,anon,authenticated;
revoke all on function public.enqueue_assignment_communication() from public,anon,authenticated;
