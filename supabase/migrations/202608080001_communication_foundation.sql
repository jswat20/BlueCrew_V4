-- Milestone 7.1: provider-neutral communication events and channel delivery audit.
-- Business RPCs will enqueue one event; trusted server workers own email delivery.

create type public.communication_channel as enum ('in_app', 'email', 'sms', 'push');
create type public.communication_delivery_status as enum ('pending', 'processing', 'sent', 'failed', 'skipped');

create table public.communication_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  type text not null check (type in (
    'account-approved', 'account-rejected', 'claim-submitted', 'claim-approved', 'claim-rejected', 'claim-withdrawn',
    'assignment-created', 'assignment-removed', 'assignment-declined', 'game-cancelled', 'game-date-changed',
    'game-time-changed', 'game-location-changed', 'game-field-changed', 'game-reminder', 'availability-reminder'
  )),
  category text not null check (category in ('account', 'claims', 'assignments', 'game_changes', 'reminders')),
  actor_profile_id uuid references public.profiles(id) on delete set null,
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  subject_entity_type text,
  subject_entity_id uuid,
  game_id uuid references public.games(id) on delete set null,
  assignment_id uuid references public.game_assignments(id) on delete set null,
  claim_id uuid references public.assignment_claims(id) on delete set null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  business_idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, business_idempotency_key),
  check (actor_profile_id is null or actor_profile_id <> recipient_profile_id or type <> 'claim-submitted')
);

create table public.communication_deliveries (
  id uuid primary key default gen_random_uuid(),
  communication_event_id uuid not null references public.communication_events(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  channel public.communication_channel not null,
  status public.communication_delivery_status not null default 'pending',
  attempt_count integer not null default 0 check (attempt_count >= 0),
  created_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  sent_at timestamptz,
  failure_code text,
  failure_message text,
  provider_message_id text,
  idempotency_key text not null unique,
  unique (communication_event_id, recipient_profile_id, channel),
  check (channel not in ('sms', 'push') or status = 'skipped')
);

create index communication_events_recipient_idx on public.communication_events (organization_id, recipient_profile_id, occurred_at desc);
create index communication_deliveries_pending_idx on public.communication_deliveries (status, channel, created_at) where status in ('pending', 'failed');

alter table public.communication_events enable row level security;
alter table public.communication_deliveries enable row level security;

-- Recipients may inspect their own audit trail. Browser roles receive no insert,
-- update, or delete policy and therefore cannot choose another recipient/email.
create policy communication_events_select_own
on public.communication_events for select to authenticated
using (
  organization_id = public.current_organization_id()
  and recipient_profile_id = public.current_profile_id()
);

create policy communication_deliveries_select_own
on public.communication_deliveries for select to authenticated
using (
  organization_id = public.current_organization_id()
  and recipient_profile_id = public.current_profile_id()
);

revoke all on public.communication_events from anon, authenticated;
revoke all on public.communication_deliveries from anon, authenticated;
grant select on public.communication_events to authenticated;
grant select on public.communication_deliveries to authenticated;

-- Used only from security-definer business RPCs or a trusted backend worker.
create or replace function public.enqueue_communication_event(
  p_organization_id uuid,
  p_type text,
  p_category text,
  p_recipient_profile_id uuid,
  p_business_idempotency_key text,
  p_actor_profile_id uuid default null,
  p_subject_entity_type text default null,
  p_subject_entity_id uuid default null,
  p_game_id uuid default null,
  p_assignment_id uuid default null,
  p_claim_id uuid default null,
  p_occurred_at timestamptz default now(),
  p_metadata jsonb default '{}'::jsonb,
  p_channels public.communication_channel[] default array['in_app']::public.communication_channel[]
)
returns public.communication_events
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event public.communication_events;
  v_channel public.communication_channel;
begin
  if p_organization_id is null or p_recipient_profile_id is null or btrim(coalesce(p_business_idempotency_key, '')) = '' then
    raise exception 'communication_identity_required';
  end if;
  if not exists (select 1 from public.profiles where id = p_recipient_profile_id and organization_id = p_organization_id) then
    raise exception 'communication_recipient_outside_organization';
  end if;
  insert into public.communication_events (
    organization_id, type, category, actor_profile_id, recipient_profile_id, subject_entity_type, subject_entity_id,
    game_id, assignment_id, claim_id, occurred_at, metadata, business_idempotency_key
  ) values (
    p_organization_id, p_type, p_category, p_actor_profile_id, p_recipient_profile_id, nullif(btrim(p_subject_entity_type), ''),
    p_subject_entity_id, p_game_id, p_assignment_id, p_claim_id, coalesce(p_occurred_at, now()), coalesce(p_metadata, '{}'::jsonb),
    btrim(p_business_idempotency_key)
  ) on conflict (organization_id, business_idempotency_key) do update set business_idempotency_key = excluded.business_idempotency_key
  returning * into v_event;

  foreach v_channel in array coalesce(p_channels, array[]::public.communication_channel[]) loop
    insert into public.communication_deliveries (
      communication_event_id, organization_id, recipient_profile_id, channel, status, idempotency_key
    ) values (
      v_event.id, p_organization_id, p_recipient_profile_id, v_channel,
      case when v_channel in ('sms', 'push') then 'skipped'::public.communication_delivery_status else 'pending'::public.communication_delivery_status end,
      concat(p_organization_id, ':', p_business_idempotency_key, ':', p_recipient_profile_id, ':', v_channel)
    ) on conflict (idempotency_key) do nothing;
  end loop;
  return v_event;
end;
$$;

revoke all on function public.enqueue_communication_event(uuid, text, text, uuid, text, uuid, text, uuid, uuid, uuid, uuid, timestamptz, jsonb, public.communication_channel[]) from public, anon, authenticated;
grant execute on function public.enqueue_communication_event(uuid, text, text, uuid, text, uuid, text, uuid, uuid, uuid, uuid, timestamptz, jsonb, public.communication_channel[]) to service_role;
