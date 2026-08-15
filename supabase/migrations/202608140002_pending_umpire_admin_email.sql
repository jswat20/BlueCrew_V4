-- Queue one operational email to each approved administrator when a verified
-- public umpire reaches the pending-approval state. The existing in-app
-- registration-submitted notification remains unchanged.

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
    'availability-reminder'
  ));

create or replace function public.enqueue_pending_umpire_admin_email()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  pending_profile public.profiles%rowtype;
  administrator_profile public.profiles%rowtype;
begin
  if new.type <> 'account'
    or new.action <> 'account_registered'
    or new.metadata ->> 'registrationWorkflow' <> 'public-umpire'
    or new.actor_profile_id is null then
    return new;
  end if;

  select * into pending_profile
  from public.profiles
  where id = new.actor_profile_id
    and organization_id = new.organization_id
    and role = 'umpire'
    and status = 'pending';
  if not found then return new; end if;

  for administrator_profile in
    select profile.*
    from public.profiles profile
    where profile.organization_id = pending_profile.organization_id
      and profile.role = 'administrator'
      and profile.status = 'approved'
      and btrim(coalesce(profile.email, '')) <> ''
    order by profile.id
  loop
    perform public.enqueue_communication_event(
      p_organization_id => pending_profile.organization_id,
      p_type => 'account-pending-approval',
      p_category => 'account',
      p_recipient_profile_id => administrator_profile.id,
      p_business_idempotency_key => concat(
        'account-pending-approval:', pending_profile.id, ':', administrator_profile.id
      ),
      p_actor_profile_id => pending_profile.id,
      p_subject_entity_type => 'profile',
      p_subject_entity_id => pending_profile.id,
      p_occurred_at => new.created_at,
      p_metadata => jsonb_build_object(
        'pendingName', concat_ws(' ', pending_profile.first_name, pending_profile.last_name),
        'pendingEmail', pending_profile.email,
        'actionPath', 'accounts'
      ),
      p_channels => array['email']::public.communication_channel[]
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists pending_umpire_admin_email on public.activities;
create trigger pending_umpire_admin_email
after insert on public.activities
for each row execute function public.enqueue_pending_umpire_admin_email();

revoke all on function public.enqueue_pending_umpire_admin_email()
from public, anon, authenticated;
