-- Increment 7I: privacy-safe, tenant-scoped operational diagnostics.
-- Monitoring is deliberately best-effort at the application boundary and has
-- no trigger or foreign-key dependency from customer scheduling records.

create table public.operational_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  correlation_id text not null,
  module_code text not null check (module_code in (
    'platform', 'auth', 'security', 'league', 'umpire', 'tournament',
    'facility', 'email', 'edge_function'
  )),
  operation text not null check (operation ~ '^[a-z0-9_.-]{3,80}$'),
  classification text not null check (classification in (
    'expected_rejection', 'operational_failure', 'security_signal', 'health_check'
  )),
  severity text not null check (severity in ('info', 'warning', 'error', 'critical')),
  error_code text check (error_code is null or error_code ~ '^[a-zA-Z0-9_.:-]{1,80}$'),
  http_status integer check (http_status is null or http_status between 100 and 599),
  retryable boolean not null default false,
  diagnostic_context jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  constraint operational_events_correlation_format check (
    correlation_id ~ '^slate-[a-z0-9-]{8,80}$'
  ),
  constraint operational_events_context_object check (
    jsonb_typeof(diagnostic_context) = 'object'
  )
);

create index operational_events_org_occurred_idx
  on public.operational_events (organization_id, occurred_at desc);
create index operational_events_expiry_idx on public.operational_events (expires_at);
create index operational_events_classification_idx
  on public.operational_events (organization_id, classification, severity, occurred_at desc);

alter table public.operational_events enable row level security;
revoke all on public.operational_events from public, anon, authenticated;

create policy operational_events_admin_read on public.operational_events
for select to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (select public.is_administrator())
);

grant select on public.operational_events to authenticated;

create or replace function public.record_operational_event(
  p_correlation_id text,
  p_module_code text,
  p_operation text,
  p_classification text,
  p_severity text,
  p_error_code text default null,
  p_http_status integer default null,
  p_retryable boolean default false,
  p_context jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_organization_id uuid := public.current_organization_id();
  v_profile_id uuid := public.current_profile_id();
  v_id uuid;
  v_safe_context jsonb;
begin
  if (select auth.uid()) is null or v_organization_id is null or v_profile_id is null then
    raise exception using errcode = '42501', message = 'approved_workspace_context_required';
  end if;

  -- Only non-sensitive, bounded diagnostic fields are retained. Arbitrary keys,
  -- token-bearing URLs, request bodies, email content, and user-entered values
  -- are discarded server-side even if a client attempts to submit them.
  v_safe_context := jsonb_strip_nulls(jsonb_build_object(
    'page', left(nullif(p_context ->> 'page', ''), 60),
    'runtime', left(nullif(p_context ->> 'runtime', ''), 20),
    'workflow', left(nullif(p_context ->> 'workflow', ''), 60),
    'record_kind', left(nullif(p_context ->> 'record_kind', ''), 40),
    'attempt', case when (p_context ->> 'attempt') ~ '^[0-9]{1,4}$' then (p_context ->> 'attempt')::integer end,
    'duration_ms', case when (p_context ->> 'duration_ms') ~ '^[0-9]{1,9}$' then (p_context ->> 'duration_ms')::integer end,
    'source', left(nullif(p_context ->> 'source', ''), 40)
  ));

  insert into public.operational_events (
    organization_id, actor_profile_id, correlation_id, module_code, operation,
    classification, severity, error_code, http_status, retryable,
    diagnostic_context
  ) values (
    v_organization_id, v_profile_id, lower(btrim(p_correlation_id)),
    lower(btrim(p_module_code)), lower(btrim(p_operation)),
    lower(btrim(p_classification)), lower(btrim(p_severity)),
    nullif(left(btrim(p_error_code), 80), ''), p_http_status,
    coalesce(p_retryable, false), v_safe_context
  ) returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.get_operational_health(
  p_since timestamptz default (now() - interval '24 hours'),
  p_limit integer default 100
)
returns table (
  id uuid,
  correlation_id text,
  module_code text,
  operation text,
  classification text,
  severity text,
  error_code text,
  http_status integer,
  retryable boolean,
  diagnostic_context jsonb,
  occurred_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_organization_id uuid := public.current_organization_id();
begin
  if v_organization_id is null or not public.is_administrator() then
    raise exception using errcode = '42501', message = 'workspace_administrator_required';
  end if;

  return query
  select e.id, e.correlation_id, e.module_code, e.operation,
         e.classification, e.severity, e.error_code, e.http_status,
         e.retryable, e.diagnostic_context, e.occurred_at
  from public.operational_events e
  where e.organization_id = v_organization_id
    and e.occurred_at >= greatest(coalesce(p_since, now() - interval '24 hours'), now() - interval '30 days')
    and e.expires_at > now()
  order by e.occurred_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 250);
end;
$$;

create or replace function private.purge_expired_operational_events()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_count integer;
begin
  delete from public.operational_events where expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.get_communication_delivery_health()
returns table (
  pending_count bigint,
  processing_count bigint,
  failed_count bigint,
  retrying_count bigint,
  oldest_pending_at timestamptz,
  last_attempt_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare v_organization_id uuid := public.current_organization_id();
begin
  if v_organization_id is null or not public.is_administrator() then
    raise exception using errcode = '42501', message = 'workspace_administrator_required';
  end if;

  return query
  select
    count(*) filter (where d.status = 'pending'),
    count(*) filter (where d.status = 'processing'),
    count(*) filter (where d.status = 'failed'),
    count(*) filter (where d.status in ('pending','failed') and d.attempt_count > 0),
    min(d.created_at) filter (where d.status = 'pending'),
    max(d.last_attempt_at)
  from public.communication_deliveries d
  where d.organization_id = v_organization_id
    and d.channel = 'email';
end;
$$;

revoke all on function public.record_operational_event(text,text,text,text,text,text,integer,boolean,jsonb)
  from public, anon, authenticated;
revoke all on function public.get_operational_health(timestamptz,integer)
  from public, anon, authenticated;
revoke all on function private.purge_expired_operational_events()
  from public, anon, authenticated;
revoke all on function public.get_communication_delivery_health()
  from public, anon, authenticated;

grant execute on function public.record_operational_event(text,text,text,text,text,text,integer,boolean,jsonb)
  to authenticated;
grant execute on function public.get_operational_health(timestamptz,integer)
  to authenticated;
grant execute on function public.get_communication_delivery_health() to authenticated;
grant execute on function private.purge_expired_operational_events() to service_role;

comment on table public.operational_events is
  'Thirty-day, tenant-scoped operational signals containing only allowlisted diagnostic metadata.';
comment on function public.record_operational_event(text,text,text,text,text,text,integer,boolean,jsonb) is
  'Records a privacy-safe signal for the caller active workspace; arbitrary context keys are discarded.';
comment on function public.get_operational_health(timestamptz,integer) is
  'Returns recent operational signals only to an administrator of the active workspace.';
