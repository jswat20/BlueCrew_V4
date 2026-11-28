-- Serialize evaluator calls per workspace and prevent a recovered source event
-- from reopening until a genuinely new correlation is recorded.
alter function public.evaluate_operational_incidents()
  rename to evaluate_operational_incidents_unlocked;

revoke all on function public.evaluate_operational_incidents_unlocked()
  from public, anon, authenticated;

create or replace function public.evaluate_operational_incidents()
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_org uuid := public.current_organization_id();
  v_profile uuid := public.current_profile_id();
  v_correlation text;
  v_recovered_id uuid;
begin
  if v_org is null or v_profile is null or not public.is_administrator() then
    raise exception using errcode = '42501', message = 'workspace_administrator_required';
  end if;

  -- One evaluator per workspace at a time, including concurrent browser tabs.
  perform pg_advisory_xact_lock(hashtextextended(v_org::text || ':operational-alert-evaluation', 0));

  select e.correlation_id into v_correlation
  from public.operational_events e
  where e.organization_id = v_org
    and e.occurred_at >= now() - interval '15 minutes'
    and e.expires_at > now()
    and e.classification in ('operational_failure', 'security_signal')
  order by case when e.classification = 'security_signal' then 0 else 1 end,
           case e.severity when 'critical' then 0 when 'error' then 1 else 2 end,
           e.occurred_at desc
  limit 1;

  if v_correlation is null then return null; end if;

  select i.id into v_recovered_id
  from public.operational_incidents i
  where i.organization_id = v_org
    and i.status = 'recovered'
    and i.correlation_id = v_correlation
  order by i.recovered_at desc
  limit 1;

  if v_recovered_id is not null then return v_recovered_id; end if;
  return public.evaluate_operational_incidents_unlocked();
end;
$$;

revoke all on function public.evaluate_operational_incidents()
  from public, anon, authenticated;
grant execute on function public.evaluate_operational_incidents() to authenticated;

comment on function public.evaluate_operational_incidents() is
  'Admin-only serialized evaluator; a recovered source correlation cannot reopen.';
comment on function public.evaluate_operational_incidents_unlocked() is
  'Internal evaluator implementation. No browser role may execute it directly.';
