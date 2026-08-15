-- Milestone 7.7: authoritative reminder producer for the existing communication worker.

alter table public.communication_events
  drop constraint if exists communication_events_type_check;

alter table public.communication_events
  add constraint communication_events_type_check check (type in (
    'account-approved', 'account-rejected', 'claim-submitted', 'claim-approved', 'claim-rejected', 'claim-withdrawn',
    'assignment-created', 'assignment-removed', 'assignment-declined', 'game-cancelled', 'game-restored',
    'game-date-changed', 'game-time-changed', 'game-location-changed', 'game-field-changed',
    'game-reminder-24-hour', 'game-reminder-2-hour', 'game-reminder-30-minute',
    'game-reminder', 'availability-reminder'
  ));

create or replace function public.enqueue_due_game_reminders(p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_due record;
  v_event public.communication_events;
  v_business_key text;
  v_metadata jsonb;
  v_notification_id uuid;
  v_created integer := 0;
  v_duplicates integer := 0;
begin
  if auth.role() <> 'service_role' then raise exception 'reminder_worker_forbidden'; end if;

  for v_due in
    select organization.id as organization_id, organization.settings as organization_settings,
      game.id as game_id, game.legacy_game_id, game.game_date, game.game_time, game.level, game.source_metadata,
      assignment.id as assignment_id, assignment.position,
      crew.id as crew_member_id, profile.id as recipient_profile_id, profile.communication_preferences as recipient_preferences,
      location.name as location_name, field.name as field_name,
      reminder.event_type, reminder.title, reminder.lead
    from public.organizations organization
    join public.games game on game.organization_id=organization.id
    join public.game_assignments assignment on assignment.organization_id=game.organization_id and assignment.game_id=game.id
    join public.crew_members crew on crew.organization_id=assignment.organization_id and crew.id=assignment.assigned_crew_member_id
    join public.profiles profile on profile.organization_id=crew.organization_id and profile.id=crew.profile_id
    left join public.locations location on location.organization_id=game.organization_id and location.id=game.location_id
    left join public.fields field on field.organization_id=game.organization_id and field.id=game.field_id
    cross join lateral (
      select * from (values
        ('game-reminder-24-hour','Game Tomorrow','Your game begins in approximately 24 hours.',interval '24 hours',interval '2 hours'),
        ('game-reminder-2-hour','Game in 2 Hours','Your game begins in approximately two hours.',interval '2 hours',interval '30 minutes'),
        ('game-reminder-30-minute','Game Starts Soon','Your game begins in approximately 30 minutes.',interval '30 minutes',interval '0 seconds')
      ) as reminder_window(event_type,title,lead,upper_bound,lower_bound)
    ) reminder
    where organization.active
      and game.lifecycle_status='scheduled'
      and assignment.status in ('assigned','locked')
      and assignment.assigned_crew_member_id is not null
      and crew.active and profile.status='approved' and profile.role='umpire'
      and ((game.game_date + game.game_time) at time zone coalesce(nullif(game.timezone,''),nullif(organization.timezone,''),'America/New_York')) > p_now
      and ((game.game_date + game.game_time) at time zone coalesce(nullif(game.timezone,''),nullif(organization.timezone,''),'America/New_York')) - p_now <= reminder.upper_bound
      and ((game.game_date + game.game_time) at time zone coalesce(nullif(game.timezone,''),nullif(organization.timezone,''),'America/New_York')) - p_now > reminder.lower_bound
    order by game.game_date,game.game_time,assignment.id,reminder.upper_bound desc
  loop
    v_business_key := concat(v_due.event_type,':',v_due.game_id,':',v_due.assignment_id,':',v_due.recipient_profile_id);
    if exists(select 1 from public.communication_events where organization_id=v_due.organization_id and business_idempotency_key=v_business_key) then
      v_duplicates := v_duplicates + 1;
      continue;
    end if;

    v_metadata := jsonb_strip_nulls(jsonb_build_object(
      'year',extract(year from v_due.game_date)::integer,
      'seasonCode',coalesce(v_due.source_metadata->>'seasonCode',v_due.source_metadata->>'season_code'),
      'organizationCode',coalesce(v_due.source_metadata->>'organizationCode',v_due.organization_settings->>'organization_code'),
      'level',v_due.level,
      'divisionAlias',coalesce(v_due.organization_settings #>> array['level_aliases',v_due.level],v_due.level),
      'sequence',coalesce(v_due.source_metadata->>'sequence',v_due.source_metadata->>'gameNumber'),
      'gameDisplay',coalesce(v_due.legacy_game_id,v_due.game_id::text),
      'date',v_due.game_date::text,'time',to_char(v_due.game_time,'HH24:MI'),
      'location',v_due.location_name,'field',v_due.field_name,'position',v_due.position,
      'actionPath','my-schedule','reminderWindow',v_due.event_type
    ));

    select * into v_event from public.enqueue_profile_communication(
      v_due.organization_id,v_due.event_type,'reminders',v_due.recipient_profile_id,v_business_key,
      null,'assignment',v_due.assignment_id,v_due.game_id,v_due.assignment_id,null,p_now,v_metadata,true
    );

    update public.communication_deliveries set status='skipped',retryable=false,
      failure_code='preference_disabled',failure_message='Channel disabled by communication preference.'
    where communication_event_id=v_event.id and status='pending' and (
      (channel='in_app' and coalesce(
        (v_due.recipient_preferences #>> array['communicationEvents',v_due.event_type,'in_app'])::boolean,
        (v_due.recipient_preferences #>> '{channels,in_app}')::boolean,
        (v_due.recipient_preferences->>'availability')::boolean,true)=false)
      or (channel='email' and coalesce(
        (v_due.recipient_preferences #>> array['communicationEvents',v_due.event_type,'email'])::boolean,
        (v_due.recipient_preferences #>> '{channels,email}')::boolean,
        (v_due.recipient_preferences->>'emailEnabled')::boolean,true)=false)
    );

    if exists(select 1 from public.communication_deliveries where communication_event_id=v_event.id and channel='in_app' and status='pending') then
      insert into public.notifications(organization_id,type,audience,recipient_profile_id,title,message,related_legacy_id,destination_page,destination_context,reminder_key)
      values(v_due.organization_id,v_due.event_type,'account',v_due.recipient_profile_id,v_due.title,
        concat_ws(E'\n\n',v_due.lead,concat_ws(E'\n',
          concat('Game: ',coalesce(v_due.legacy_game_id,v_due.game_id::text)),
          concat('Division: ',coalesce(v_due.organization_settings #>> array['level_aliases',v_due.level],v_due.level,'Division unavailable')),
          concat('Date: ',to_char(v_due.game_date,'FMMonth FMDD, YYYY')),
          concat('Time: ',to_char(v_due.game_time,'FMHH12:MI AM')),
          concat('Complex: ',coalesce(v_due.location_name,'Complex unavailable')),
          concat('Field: ',coalesce(v_due.field_name,'Field unavailable')),
          concat('Assigned Position: ',case v_due.position when 'Plate' then 'U1' when 'Base' then 'U2' else v_due.position end))),
        coalesce(v_due.legacy_game_id,v_due.game_id::text),'my-schedule',jsonb_build_object('gameId',v_due.game_id),v_business_key)
      on conflict do nothing returning id into v_notification_id;
      update public.communication_deliveries set status='sent',sent_at=coalesce(sent_at,p_now),failure_code=null,failure_message=null
       where communication_event_id=v_event.id and channel='in_app' and status='pending'
         and exists(select 1 from public.notifications where organization_id=v_due.organization_id and recipient_profile_id=v_due.recipient_profile_id and reminder_key=v_business_key);
    end if;
    v_created := v_created + 1;
  end loop;
  return jsonb_build_object('created',v_created,'duplicates',v_duplicates);
end;
$$;

revoke all on function public.enqueue_due_game_reminders(timestamptz) from public,anon,authenticated;
grant execute on function public.enqueue_due_game_reminders(timestamptz) to service_role;
