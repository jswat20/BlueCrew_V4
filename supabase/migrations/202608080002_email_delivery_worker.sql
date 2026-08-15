-- Milestone 7.2: atomic email delivery leasing and retry audit.

alter table public.communication_deliveries
  add column retryable boolean not null default true,
  add column next_attempt_at timestamptz,
  add column lease_token uuid,
  add column lease_expires_at timestamptz,
  add column attempt_started_for_lease uuid;

create index communication_deliveries_email_worker_idx
on public.communication_deliveries (next_attempt_at, created_at)
where channel = 'email' and status in ('pending', 'failed', 'processing');

create or replace function public.claim_communication_email_deliveries(
  p_limit integer default 10,
  p_lease_seconds integer default 120
)
returns table (
  delivery_id uuid,
  lease_token uuid,
  idempotency_key text,
  attempt_count integer,
  event_id uuid,
  event_type text,
  organization_id uuid,
  recipient_profile_id uuid,
  recipient_email text,
  recipient_display_name text,
  occurred_at timestamptz,
  game_id uuid,
  assignment_id uuid,
  claim_id uuid,
  metadata jsonb,
  organization_settings jsonb
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'email_worker_forbidden'; end if;
  return query
  with candidates as (
    select delivery.id
    from public.communication_deliveries delivery
    join public.communication_events event
      on event.id = delivery.communication_event_id
     and event.organization_id = delivery.organization_id
     and event.recipient_profile_id = delivery.recipient_profile_id
    join public.profiles profile
      on profile.id = delivery.recipient_profile_id
     and profile.organization_id = delivery.organization_id
    where delivery.channel = 'email'
      and delivery.attempt_count < 3
      and btrim(coalesce(profile.email, '')) <> ''
      and (
        delivery.status = 'pending'
        or (delivery.status = 'failed' and delivery.retryable and coalesce(delivery.next_attempt_at, now()) <= now())
        or (delivery.status = 'processing' and delivery.lease_expires_at < now())
      )
    order by delivery.created_at, delivery.id
    for update of delivery skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 50))
  ), leased as (
    update public.communication_deliveries delivery
       set status = 'processing',
           lease_token = gen_random_uuid(),
           lease_expires_at = now() + make_interval(secs => greatest(30, least(coalesce(p_lease_seconds, 120), 600))),
           attempt_started_for_lease = null,
           next_attempt_at = null,
           failure_code = null,
           failure_message = null
      from candidates
     where delivery.id = candidates.id
    returning delivery.*
  )
  select leased.id, leased.lease_token, leased.idempotency_key, leased.attempt_count,
         event.id, event.type, event.organization_id, event.recipient_profile_id,
         profile.email, concat_ws(' ', profile.first_name, profile.last_name), event.occurred_at,
         event.game_id, event.assignment_id, event.claim_id, event.metadata, coalesce(organization.settings, '{}'::jsonb)
  from leased
  join public.communication_events event on event.id = leased.communication_event_id and event.organization_id = leased.organization_id
  join public.profiles profile on profile.id = leased.recipient_profile_id and profile.organization_id = leased.organization_id
  join public.organizations organization on organization.id = leased.organization_id;
end;
$$;

create or replace function public.begin_communication_email_attempt(p_delivery_id uuid, p_lease_token uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.role() <> 'service_role' then raise exception 'email_worker_forbidden'; end if;
  update public.communication_deliveries
     set attempt_count = attempt_count + 1, last_attempt_at = now(), attempt_started_for_lease = p_lease_token
   where id = p_delivery_id and channel = 'email' and status = 'processing'
     and lease_token = p_lease_token and lease_expires_at > now() and attempt_count < 3
     and attempt_started_for_lease is null;
  return found;
end;
$$;

create or replace function public.complete_communication_email_delivery(
  p_delivery_id uuid,
  p_lease_token uuid,
  p_sent boolean,
  p_provider_message_id text default null,
  p_retryable boolean default false,
  p_failure_code text default null,
  p_failure_message text default null
)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_attempt_count integer;
begin
  if auth.role() <> 'service_role' then raise exception 'email_worker_forbidden'; end if;
  select attempt_count into v_attempt_count from public.communication_deliveries
   where id = p_delivery_id and channel = 'email' and status = 'processing'
     and lease_token = p_lease_token and attempt_started_for_lease = p_lease_token for update;
  if not found then return false; end if;
  update public.communication_deliveries
     set status = case when p_sent then 'sent'::public.communication_delivery_status else 'failed'::public.communication_delivery_status end,
         sent_at = case when p_sent then now() else null end,
         provider_message_id = case when p_sent then left(nullif(p_provider_message_id, ''), 255) else null end,
         retryable = case when p_sent then false else coalesce(p_retryable, false) and v_attempt_count < 3 end,
         next_attempt_at = case when not p_sent and coalesce(p_retryable, false) and v_attempt_count < 3
           then now() + make_interval(secs => case v_attempt_count when 1 then 60 when 2 then 300 else 900 end) else null end,
         failure_code = case when p_sent then null else left(coalesce(p_failure_code, 'provider_error'), 80) end,
         failure_message = case when p_sent then null else left(coalesce(p_failure_message, 'Email provider request failed.'), 500) end,
         lease_token = null, lease_expires_at = null, attempt_started_for_lease = null
   where id = p_delivery_id and lease_token = p_lease_token;
  return found;
end;
$$;

revoke all on function public.claim_communication_email_deliveries(integer, integer) from public, anon, authenticated;
revoke all on function public.begin_communication_email_attempt(uuid, uuid) from public, anon, authenticated;
revoke all on function public.complete_communication_email_delivery(uuid, uuid, boolean, text, boolean, text, text) from public, anon, authenticated;
grant execute on function public.claim_communication_email_deliveries(integer, integer) to service_role;
grant execute on function public.begin_communication_email_attempt(uuid, uuid) to service_role;
grant execute on function public.complete_communication_email_delivery(uuid, uuid, boolean, text, boolean, text, text) to service_role;

-- Initial live producer: the authoritative hosted claim transition enqueues one
-- normalized communication event. Existing in-app notification creation remains
-- in its proven transaction while email delivery is processed independently.
create or replace function public.enqueue_approved_claim_communication()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assignment public.game_assignments;
  v_game public.games;
  v_profile public.profiles;
  v_location public.locations;
  v_field public.fields;
  v_organization public.organizations;
  v_event public.communication_events;
  v_email_enabled boolean := true;
begin
  if new.status <> 'approved' or old.status = 'approved' then return new; end if;
  select * into v_assignment from public.game_assignments
   where id = new.assignment_id and organization_id = new.organization_id;
  select game.* into v_game from public.games game
   where game.id = v_assignment.game_id and game.organization_id = new.organization_id;
  select profile.* into v_profile
    from public.crew_members crew join public.profiles profile
      on profile.id = crew.profile_id and profile.organization_id = crew.organization_id
   where crew.id = new.claimant_crew_member_id and crew.organization_id = new.organization_id;
  select * into v_location from public.locations where id = v_game.location_id and organization_id = new.organization_id;
  select * into v_field from public.fields where id = v_game.field_id and organization_id = new.organization_id;
  select * into v_organization from public.organizations where id = new.organization_id;
  if v_assignment.id is null or v_game.id is null or v_profile.id is null then return new; end if;

  v_email_enabled := lower(coalesce(v_profile.communication_preferences ->> 'emailEnabled', 'true')) <> 'false'
    and lower(coalesce(v_profile.communication_preferences #>> '{communicationEvents,claim-approved,email}', 'true')) <> 'false';

  select * into v_event from public.enqueue_communication_event(
    new.organization_id, 'claim-approved', 'claims', v_profile.id,
    concat('claim-approved:', new.id, ':', v_profile.id), new.decision_by_profile_id,
    'claim', new.id, v_game.id, v_assignment.id, new.id, coalesce(new.decided_at, now()),
    jsonb_strip_nulls(jsonb_build_object(
      'year', extract(year from v_game.game_date)::integer,
      'seasonCode', coalesce(v_game.source_metadata ->> 'seasonCode', v_game.source_metadata ->> 'season_code'),
      'organizationCode', coalesce(v_game.source_metadata ->> 'organizationCode', v_organization.settings ->> 'organization_code'),
      'level', v_game.level,
      'sequence', coalesce(v_game.source_metadata ->> 'sequence', v_game.source_metadata ->> 'gameNumber'),
      'gameDisplay', coalesce(v_game.legacy_game_id, v_game.id::text),
      'date', v_game.game_date::text,
      'time', to_char(v_game.game_time, 'HH24:MI'),
      'location', v_location.name,
      'field', v_field.name,
      'position', v_assignment.position,
      'actionPath', 'my-schedule'
    )), array['email']::public.communication_channel[]
  );
  if not v_email_enabled then
    update public.communication_deliveries set status = 'skipped', retryable = false,
      failure_code = 'preference_disabled', failure_message = 'Email disabled by communication preference.'
    where communication_event_id = v_event.id and channel = 'email' and status = 'pending';
  end if;
  return new;
exception when others then
  -- Provider delivery never occurs in this transaction. Preserve the approved
  -- claim even if communication enqueue encounters an operational fault.
  return new;
end;
$$;

drop trigger if exists assignment_claim_approved_communication on public.assignment_claims;
create trigger assignment_claim_approved_communication
after update of status on public.assignment_claims
for each row execute function public.enqueue_approved_claim_communication();

revoke all on function public.enqueue_approved_claim_communication() from public, anon, authenticated;
