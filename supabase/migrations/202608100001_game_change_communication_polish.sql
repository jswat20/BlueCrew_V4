-- Milestone 7.4B: rich game-change notifications and true no-op saves.

create or replace function public.update_game_operational_details(
  p_game_id uuid,
  p_game_date date default null,
  p_game_time time default null,
  p_location_id uuid default null,
  p_field_id uuid default null,
  p_lifecycle_status public.game_lifecycle_status default null
)
returns public.games
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_organization_id uuid := public.current_organization_id();
  v_game public.games;
  v_next_status public.game_lifecycle_status;
begin
  if v_organization_id is null or public.current_profile_id() is null
     or not public.is_assigner_or_administrator() then
    raise exception using errcode='P0001', message='game_update_forbidden';
  end if;

  select * into v_game from public.games
   where id=p_game_id and organization_id=v_organization_id for update;
  if v_game.id is null then
    raise exception using errcode='P0001', message='game_update_not_found';
  end if;

  if p_location_id is not null and not exists (
    select 1 from public.locations where id=p_location_id and organization_id=v_organization_id and active
  ) then raise exception using errcode='P0001', message='game_update_location_invalid'; end if;
  if p_field_id is not null and not exists (
    select 1 from public.fields where id=p_field_id and organization_id=v_organization_id
      and location_id=coalesce(p_location_id,v_game.location_id) and active
  ) then raise exception using errcode='P0001', message='game_update_field_invalid'; end if;

  v_next_status := coalesce(p_lifecycle_status,v_game.lifecycle_status);
  if v_next_status is distinct from v_game.lifecycle_status and not (
    (v_game.lifecycle_status in ('scheduled','postponed') and v_next_status='cancelled')
    or (v_game.lifecycle_status='cancelled' and v_next_status='scheduled')
    or (v_game.lifecycle_status='scheduled' and v_next_status='postponed')
    or (v_game.lifecycle_status='postponed' and v_next_status='scheduled')
  ) then raise exception using errcode='P0001', message='game_update_status_invalid'; end if;

  -- Returning before UPDATE is required because the table-wide updated_at
  -- trigger correctly timestamps every UPDATE statement, including no-op ones.
  if row(
    coalesce(p_game_date,v_game.game_date),coalesce(p_game_time,v_game.game_time),
    coalesce(p_location_id,v_game.location_id),coalesce(p_field_id,v_game.field_id),v_next_status
  ) is not distinct from row(
    v_game.game_date,v_game.game_time,v_game.location_id,v_game.field_id,v_game.lifecycle_status
  ) then
    return v_game;
  end if;

  update public.games set
    game_date=coalesce(p_game_date,game_date),
    game_time=coalesce(p_game_time,game_time),
    location_id=coalesce(p_location_id,location_id),
    field_id=coalesce(p_field_id,field_id),
    lifecycle_status=v_next_status,
    updated_at=clock_timestamp()
  where id=v_game.id and organization_id=v_organization_id
  returning * into v_game;
  return v_game;
end;
$$;

create or replace function public.enqueue_game_change_communications()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assignment public.game_assignments;
  v_recipient_profile_id uuid;
  v_event public.communication_events;
  v_type text;
  v_title text;
  v_label text;
  v_old_value text;
  v_new_value text;
  v_old_location text;
  v_new_location text;
  v_old_field text;
  v_new_field text;
  v_division_alias text;
  v_position_label text;
  v_lead text;
  v_notification_message text;
  v_metadata jsonb;
  v_change_key text;
  v_changed_at timestamptz := coalesce(new.updated_at,clock_timestamp());
begin
  select name into v_old_location from public.locations where id=old.location_id and organization_id=old.organization_id;
  select name into v_new_location from public.locations where id=new.location_id and organization_id=new.organization_id;
  select name into v_old_field from public.fields where id=old.field_id and organization_id=old.organization_id;
  select name into v_new_field from public.fields where id=new.field_id and organization_id=new.organization_id;
  select coalesce(settings #>> array['level_aliases',new.level],new.level)
    into v_division_alias from public.organizations where id=new.organization_id;

  for v_type,v_title,v_label,v_old_value,v_new_value,v_change_key in
    select * from (values
      ('game-date-changed','Game Date Changed','Date',to_char(old.game_date,'FMMonth FMDD, YYYY'),to_char(new.game_date,'FMMonth FMDD, YYYY'),'date'),
      ('game-time-changed','Game Time Changed','Time',to_char(old.game_time,'FMHH12:MI AM'),to_char(new.game_time,'FMHH12:MI AM'),'time'),
      ('game-location-changed','Location Changed','Location',coalesce(v_old_location,''),coalesce(v_new_location,''),'location'),
      ('game-field-changed','Field Changed','Field',coalesce(v_old_field,''),coalesce(v_new_field,''),'field'),
      ('game-cancelled','Game Cancelled','Status',old.lifecycle_status::text,new.lifecycle_status::text,'cancelled'),
      ('game-restored','Game Restored','Status',old.lifecycle_status::text,new.lifecycle_status::text,'restored')
    ) as change(type,title,label,old_value,new_value,change_key)
    where (change_key='date' and old.game_date is distinct from new.game_date)
       or (change_key='time' and old.game_time is distinct from new.game_time)
       or (change_key='location' and old.location_id is distinct from new.location_id)
       or (change_key='field' and old.field_id is distinct from new.field_id)
       or (change_key='cancelled' and old.lifecycle_status is distinct from 'cancelled' and new.lifecycle_status='cancelled')
       or (change_key='restored' and old.lifecycle_status='cancelled' and new.lifecycle_status is distinct from 'cancelled')
  loop
    for v_assignment in select * from public.game_assignments
      where organization_id=new.organization_id and game_id=new.id
        and assigned_crew_member_id is not null and status in ('assigned','locked')
    loop
      select profile_id into v_recipient_profile_id from public.crew_members
       where id=v_assignment.assigned_crew_member_id and organization_id=new.organization_id;
      if v_recipient_profile_id is null then continue; end if;

      v_position_label := case v_assignment.position
        when 'Plate' then 'U1' when 'Base' then 'U2' else v_assignment.position end;
      v_lead := case when v_type='game-cancelled' then 'Your assigned game has been cancelled.'
        when v_type='game-restored' then 'Your assigned game has been restored.'
        else 'The game below has been updated.' end;
      v_notification_message := concat_ws(E'\n\n',
        v_lead,
        concat_ws(E'\n',
          concat('Game: ',coalesce(new.legacy_game_id,new.id::text)),
          concat('Division: ',coalesce(v_division_alias,new.level,'Division unavailable')),
          concat('Date: ',to_char(new.game_date,'FMMonth FMDD, YYYY')),
          concat('Time: ',to_char(new.game_time,'FMHH12:MI AM')),
          concat('Complex: ',coalesce(v_new_location,'Complex unavailable')),
          concat('Field: ',coalesce(v_new_field,'Field unavailable')),
          concat('Assignment: ',coalesce(v_position_label,'Position unavailable'))
        ),
        concat(v_label,' changed',E'\n',coalesce(nullif(v_old_value,''),'not set'),' → ',coalesce(nullif(v_new_value,''),'not set'))
      );

      v_metadata := public.communication_assignment_metadata(v_assignment,'my-schedule') || jsonb_build_object(
        'divisionAlias',v_division_alias,'changeLabel',v_label,'oldValue',v_old_value,'newValue',v_new_value,
        'changedFields',jsonb_build_array(v_change_key)
      );
      select * into v_event from public.enqueue_profile_communication(
        new.organization_id,v_type,'game_changes',v_recipient_profile_id,
        concat(v_type,':',new.id,':',v_assignment.id,':',v_recipient_profile_id,':',
          to_char(v_changed_at,'YYYYMMDDHH24MISSUS')),
        public.current_profile_id(),'game',new.id,new.id,v_assignment.id,null,v_changed_at,v_metadata,true
      );
      if exists(select 1 from public.communication_deliveries
        where communication_event_id=v_event.id and channel='in_app' and status='pending') then
        perform public.create_notification(
          new.organization_id,v_type,'account'::public.notification_audience,v_recipient_profile_id,
          v_title,v_notification_message,'my-schedule'
        );
      end if;
    end loop;
  end loop;
  return new;
exception when others then return new;
end;
$$;

revoke all on function public.update_game_operational_details(uuid,date,time,uuid,uuid,public.game_lifecycle_status) from public,anon,authenticated;
grant execute on function public.update_game_operational_details(uuid,date,time,uuid,uuid,public.game_lifecycle_status) to authenticated;
revoke all on function public.enqueue_game_change_communications() from public,anon,authenticated;
