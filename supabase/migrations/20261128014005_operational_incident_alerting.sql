-- Increment 7J: internal alert lifecycle and isolated monitoring retention.
-- This migration never invokes communication delivery or external networking.

create table public.operational_incidents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  fingerprint text not null check (fingerprint ~ '^[a-z0-9_.:-]{3,160}$'),
  module_code text not null check (module_code in (
    'platform', 'auth', 'security', 'league', 'umpire', 'tournament',
    'facility', 'email', 'edge_function'
  )),
  operation text not null check (operation ~ '^[a-z0-9_.-]{3,80}$'),
  severity text not null check (severity in ('warning', 'error', 'critical')),
  status text not null default 'open' check (status in ('open', 'acknowledged', 'recovered')),
  safe_summary text not null check (length(safe_summary) between 3 and 200),
  correlation_id text not null check (correlation_id ~ '^slate-[a-z0-9-]{8,80}$'),
  source_event_count integer not null default 1 check (source_event_count > 0),
  first_detected_at timestamptz not null default now(),
  last_detected_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by_profile_id uuid references public.profiles(id) on delete set null,
  recovered_at timestamptz,
  recovered_by_profile_id uuid references public.profiles(id) on delete set null,
  delivery_state text not null default 'disabled' check (delivery_state = 'disabled'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index operational_incidents_active_fingerprint_uidx
  on public.operational_incidents (organization_id, fingerprint)
  where status in ('open', 'acknowledged');
create index operational_incidents_org_status_idx
  on public.operational_incidents (organization_id, status, last_detected_at desc);
create index operational_incidents_recovered_idx
  on public.operational_incidents (recovered_at)
  where status = 'recovered';

alter table public.operational_incidents enable row level security;
revoke all on public.operational_incidents from public, anon, authenticated;

create policy operational_incidents_admin_read on public.operational_incidents
for select to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (select public.is_administrator())
);

grant select on public.operational_incidents to authenticated;

create or replace function public.evaluate_operational_incidents()
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_org uuid := public.current_organization_id();
  v_profile uuid := public.current_profile_id();
  v_event public.operational_events%rowtype;
  v_count integer;
  v_severity text;
  v_fingerprint text;
  v_summary text;
  v_incident uuid;
begin
  if v_org is null or v_profile is null or not public.is_administrator() then
    raise exception using errcode = '42501', message = 'workspace_administrator_required';
  end if;

  select e.* into v_event
  from public.operational_events e
  where e.organization_id = v_org
    and e.occurred_at >= now() - interval '15 minutes'
    and e.expires_at > now()
    and e.classification in ('operational_failure', 'security_signal')
  order by case when e.classification = 'security_signal' then 0 else 1 end,
           case e.severity when 'critical' then 0 when 'error' then 1 else 2 end,
           e.occurred_at desc
  limit 1;

  if v_event.id is null then return null; end if;

  select count(*) into v_count
  from public.operational_events e
  where e.organization_id = v_org
    and e.module_code = v_event.module_code
    and e.operation = v_event.operation
    and e.classification in ('operational_failure', 'security_signal')
    and e.occurred_at >= now() - interval '15 minutes'
    and e.expires_at > now();

  v_severity := case
    when v_event.classification = 'security_signal' or v_event.severity = 'critical' then 'critical'
    when v_count >= 5 then 'critical'
    when v_event.severity = 'error' then 'error'
    else 'warning'
  end;
  v_fingerprint := lower(v_event.module_code || ':' || v_event.operation || ':' || coalesce(v_event.error_code, 'no_code'));
  v_summary := left(initcap(replace(v_event.module_code, '_', ' ')) || ' operational signal requires review: ' || replace(v_event.operation, '_', ' '), 200);

  select i.id into v_incident
  from public.operational_incidents i
  where i.organization_id = v_org and i.fingerprint = v_fingerprint
    and i.status in ('open', 'acknowledged')
  for update;

  if v_incident is null then
    insert into public.operational_incidents (
      organization_id, fingerprint, module_code, operation, severity,
      safe_summary, correlation_id, source_event_count
    ) values (
      v_org, v_fingerprint, v_event.module_code, v_event.operation, v_severity,
      v_summary, v_event.correlation_id, v_count
    ) returning id into v_incident;
  else
    update public.operational_incidents
    set severity = v_severity,
        source_event_count = greatest(source_event_count, v_count),
        last_detected_at = now(), updated_at = now()
    where id = v_incident;
  end if;
  return v_incident;
end;
$$;

create or replace function public.get_operational_incidents(p_limit integer default 50)
returns setof public.operational_incidents
language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
declare v_org uuid := public.current_organization_id();
begin
  if v_org is null or not public.is_administrator() then
    raise exception using errcode = '42501', message = 'workspace_administrator_required';
  end if;
  return query select i.* from public.operational_incidents i
    where i.organization_id = v_org
    order by case i.status when 'open' then 0 when 'acknowledged' then 1 else 2 end,
             i.last_detected_at desc
    limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$$;

create or replace function public.acknowledge_operational_incident(p_incident_id uuid)
returns boolean language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare v_org uuid := public.current_organization_id(); v_profile uuid := public.current_profile_id();
begin
  if v_org is null or v_profile is null or not public.is_administrator() then
    raise exception using errcode = '42501', message = 'workspace_administrator_required';
  end if;
  update public.operational_incidents set status = 'acknowledged', acknowledged_at = now(),
    acknowledged_by_profile_id = v_profile, updated_at = now()
  where id = p_incident_id and organization_id = v_org and status = 'open';
  return found;
end;
$$;

create or replace function public.recover_operational_incident(p_incident_id uuid)
returns boolean language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare v_org uuid := public.current_organization_id(); v_profile uuid := public.current_profile_id();
begin
  if v_org is null or v_profile is null or not public.is_administrator() then
    raise exception using errcode = '42501', message = 'workspace_administrator_required';
  end if;
  update public.operational_incidents set status = 'recovered', recovered_at = now(),
    recovered_by_profile_id = v_profile, updated_at = now()
  where id = p_incident_id and organization_id = v_org and status in ('open', 'acknowledged');
  return found;
end;
$$;

create or replace function private.run_operational_retention()
returns table (events_deleted integer, incidents_deleted integer)
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare v_events integer; v_incidents integer;
begin
  delete from public.operational_events where expires_at <= now();
  get diagnostics v_events = row_count;
  delete from public.operational_incidents
    where status = 'recovered' and recovered_at <= now() - interval '30 days';
  get diagnostics v_incidents = row_count;
  return query select v_events, v_incidents;
end;
$$;

revoke all on function public.evaluate_operational_incidents() from public, anon, authenticated;
revoke all on function public.get_operational_incidents(integer) from public, anon, authenticated;
revoke all on function public.acknowledge_operational_incident(uuid) from public, anon, authenticated;
revoke all on function public.recover_operational_incident(uuid) from public, anon, authenticated;
revoke all on function private.run_operational_retention() from public, anon, authenticated;
grant execute on function public.evaluate_operational_incidents() to authenticated;
grant execute on function public.get_operational_incidents(integer) to authenticated;
grant execute on function public.acknowledge_operational_incident(uuid) to authenticated;
grant execute on function public.recover_operational_incident(uuid) to authenticated;
grant execute on function private.run_operational_retention() to service_role;

comment on table public.operational_incidents is
  'Tenant-scoped internal alerts. External delivery is structurally disabled.';
comment on function private.run_operational_retention() is
  'Deletes only expired operational events and recovered incidents older than 30 days.';
