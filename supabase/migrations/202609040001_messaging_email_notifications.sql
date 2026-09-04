-- V1 messaging email notifications. Authoritative receipt rows enqueue email-only
-- communication deliveries; the existing trusted worker performs provider I/O.

alter table public.communication_events
  drop constraint if exists communication_events_type_check;

alter table public.communication_events
  add constraint communication_events_type_check check (type in (
    'account-pending-approval', 'account-approved', 'account-rejected',
    'claim-submitted', 'claim-approved', 'claim-rejected', 'claim-withdrawn',
    'assignment-created', 'assignment-removed', 'assignment-declined',
    'game-cancelled', 'game-restored', 'game-date-changed', 'game-time-changed',
    'game-location-changed', 'game-field-changed', 'game-reminder-24-hour',
    'game-reminder-2-hour', 'game-reminder-30-minute', 'game-reminder',
    'availability-reminder', 'birthday', 'message-received', 'announcement-received'
  ));

alter table public.communication_events
  drop constraint if exists communication_events_category_check;

alter table public.communication_events
  add constraint communication_events_category_check check (category in (
    'account', 'claims', 'assignments', 'game_changes', 'reminders', 'messaging'
  ));

create or replace function public.enqueue_message_receipt_email()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_message public.messages%rowtype;
  v_recipient_email text;
  v_event public.communication_events;
begin
  select * into v_message
  from public.messages
  where id = new.message_id and organization_id = new.organization_id;

  if not found or v_message.sender_profile_id = new.recipient_profile_id then
    return new;
  end if;

  select email into v_recipient_email
  from public.profiles
  where id = new.recipient_profile_id and organization_id = new.organization_id;

  begin
    select * into v_event from public.enqueue_communication_event(
      p_organization_id => new.organization_id,
      p_type => 'message-received',
      p_category => 'messaging',
      p_recipient_profile_id => new.recipient_profile_id,
      p_business_idempotency_key => concat('message-received:', new.message_id, ':', new.recipient_profile_id),
      p_actor_profile_id => v_message.sender_profile_id,
      p_subject_entity_type => 'message',
      p_subject_entity_id => new.message_id,
      p_occurred_at => v_message.created_at,
      p_metadata => jsonb_build_object('notificationKind', 'direct_message', 'actionPath', ''),
      p_channels => array['email']::public.communication_channel[]
    );

    if btrim(coalesce(v_recipient_email, '')) = ''
      or btrim(v_recipient_email) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      update public.communication_deliveries
      set status = 'skipped', retryable = false,
          failure_code = 'recipient_email_unavailable',
          failure_message = 'Recipient does not have a usable email address.'
      where communication_event_id = v_event.id and channel = 'email' and status = 'pending';
    end if;
  exception when others then
    -- The in-app message is authoritative and must survive notification faults.
    null;
  end;

  return new;
end;
$$;

create or replace function public.enqueue_announcement_recipient_email()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_announcement public.message_announcements%rowtype;
  v_recipient_email text;
  v_event public.communication_events;
begin
  select * into v_announcement
  from public.message_announcements
  where id = new.announcement_id and organization_id = new.organization_id;

  if not found or v_announcement.sender_profile_id = new.recipient_profile_id then
    return new;
  end if;

  select email into v_recipient_email
  from public.profiles
  where id = new.recipient_profile_id and organization_id = new.organization_id;

  begin
    select * into v_event from public.enqueue_communication_event(
      p_organization_id => new.organization_id,
      p_type => 'announcement-received',
      p_category => 'messaging',
      p_recipient_profile_id => new.recipient_profile_id,
      p_business_idempotency_key => concat('announcement-received:', new.announcement_id, ':', new.recipient_profile_id),
      p_actor_profile_id => v_announcement.sender_profile_id,
      p_subject_entity_type => 'message_announcement',
      p_subject_entity_id => new.announcement_id,
      p_occurred_at => v_announcement.created_at,
      p_metadata => jsonb_build_object(
        'notificationKind', 'announcement',
        'actionPath', '',
        'targetType', v_announcement.target_type,
        'targetValue', v_announcement.target_value
      ),
      p_channels => array['email']::public.communication_channel[]
    );

    if btrim(coalesce(v_recipient_email, '')) = ''
      or btrim(v_recipient_email) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      update public.communication_deliveries
      set status = 'skipped', retryable = false,
          failure_code = 'recipient_email_unavailable',
          failure_message = 'Recipient does not have a usable email address.'
      where communication_event_id = v_event.id and channel = 'email' and status = 'pending';
    end if;
  exception when others then
    -- Announcement creation and its recipient snapshot remain successful.
    null;
  end;

  return new;
end;
$$;

drop trigger if exists message_receipt_email_notification on public.message_receipts;
create trigger message_receipt_email_notification
after insert on public.message_receipts
for each row execute function public.enqueue_message_receipt_email();

drop trigger if exists announcement_recipient_email_notification on public.message_announcement_recipients;
create trigger announcement_recipient_email_notification
after insert on public.message_announcement_recipients
for each row execute function public.enqueue_announcement_recipient_email();

revoke all on function public.enqueue_message_receipt_email() from public, anon, authenticated;
revoke all on function public.enqueue_announcement_recipient_email() from public, anon, authenticated;
