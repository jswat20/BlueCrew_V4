-- Increment 7E: a fail-closed application-email sink for isolated staging.
-- This path has no provider/network capability and can only process newly
-- marked deliveries to the reserved slate.invalid domain. Production delivery
-- functions and the historical queue are deliberately unchanged.

create table private.staging_email_captures (
  id uuid primary key default extensions.gen_random_uuid(),
  delivery_id uuid not null references public.communication_deliveries(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  attempt_number integer not null check (attempt_number between 1 and 3),
  recipient_email text not null check (lower(recipient_email) like '%@slate.invalid'),
  subject text not null check (length(subject) between 1 and 240),
  outcome text not null check (outcome in ('accepted','controlled_failure')),
  provider_message_id text,
  failure_code text,
  captured_at timestamptz not null default clock_timestamp(),
  unique (delivery_id,attempt_number)
);

revoke all on table private.staging_email_captures from public,anon,authenticated;

create or replace function private.assert_staging_email_administrator()
returns uuid
language plpgsql stable security definer
set search_path=pg_catalog,public
as $$
declare v_organization_id uuid:=public.current_organization_id();
begin
  if (select auth.uid()) is null or v_organization_id is null then
    raise exception using errcode='42501',message='workspace_context_required';
  end if;
  if not private.has_membership_role(v_organization_id,array['administrator']) then
    raise exception using errcode='42501',message='workspace_administrator_required';
  end if;
  return v_organization_id;
end;
$$;

create or replace function public.authorize_staging_email_sink()
returns uuid
language sql stable security definer
set search_path=pg_catalog,public
as $$ select private.assert_staging_email_administrator() $$;

create or replace function public.enqueue_staging_email_test(
  p_recipient_profile_id uuid,
  p_event_type text,
  p_simulate_transient_failure boolean default false
) returns jsonb
language plpgsql security definer
set search_path=pg_catalog,extensions,public
as $$
declare
  v_organization_id uuid:=private.assert_staging_email_administrator();
  v_actor_profile_id uuid;
  v_recipient public.profiles%rowtype;
  v_event public.communication_events%rowtype;
  v_delivery public.communication_deliveries%rowtype;
  v_key text;
begin
  if p_event_type not in ('assignment-created','game-time-changed','account-approved') then
    raise exception using errcode='P0001',message='staging_email_event_not_allowed';
  end if;
  select * into v_recipient from public.profiles
   where id=p_recipient_profile_id and organization_id=v_organization_id and status='approved';
  if not found or lower(v_recipient.email) not like '%@slate.invalid' then
    raise exception using errcode='42501',message='staging_email_recipient_not_allowed';
  end if;
  select id into v_actor_profile_id from public.profiles
   where organization_id=v_organization_id and auth_user_id=(select auth.uid()) and status='approved'
   order by created_at,id limit 1;
  v_key:=concat('staging-email-test:',v_organization_id,':',extensions.gen_random_uuid());
  select * into v_event from public.enqueue_communication_event(
    v_organization_id,p_event_type,'system',v_recipient.id,v_key,v_actor_profile_id,
    'staging_email_test',null,null,null,null,clock_timestamp(),
    jsonb_build_object(
      'staging_email_test',true,
      'simulate_transient_failure',coalesce(p_simulate_transient_failure,false),
      'gameDisplay','STAGING-EMAIL-TEST',
      'date',current_date::text,
      'time',to_char(localtime,'HH24:MI'),
      'location','Isolated staging sink',
      'actionPath','settings'
    ),array['email']::public.communication_channel[]
  );
  select * into strict v_delivery from public.communication_deliveries
   where communication_event_id=v_event.id and channel='email';
  return jsonb_build_object('delivery_id',v_delivery.id,'event_id',v_event.id,'status',v_delivery.status);
end;
$$;

create or replace function public.claim_staging_email_deliveries(
  p_organization_id uuid,p_limit integer default 10,p_lease_seconds integer default 120
) returns table(
  delivery_id uuid,lease_token uuid,idempotency_key text,attempt_count integer,
  event_id uuid,event_type text,organization_id uuid,recipient_profile_id uuid,
  recipient_email text,recipient_display_name text,occurred_at timestamptz,
  game_id uuid,assignment_id uuid,claim_id uuid,metadata jsonb,organization_settings jsonb
)
language plpgsql security definer
set search_path=pg_catalog,public
as $$
begin
  if (select auth.role())<>'service_role' then raise exception using errcode='42501',message='staging_email_worker_forbidden'; end if;
  return query
  with candidates as (
    select d.id from public.communication_deliveries d
    join public.communication_events e on e.id=d.communication_event_id and e.organization_id=d.organization_id
    join public.profiles p on p.id=d.recipient_profile_id and p.organization_id=d.organization_id
    where d.organization_id=p_organization_id and d.channel='email' and d.attempt_count<3
      and e.metadata @> '{"staging_email_test":true}'::jsonb
      and lower(p.email) like '%@slate.invalid'
      and (
        d.status='pending'
        or (d.status='failed' and d.retryable and coalesce(d.next_attempt_at,now())<=now())
        or (d.status='processing' and d.lease_expires_at<now())
      )
    order by d.created_at,d.id for update of d skip locked
    limit greatest(1,least(coalesce(p_limit,10),25))
  ), leased as (
    update public.communication_deliveries d set
      status='processing',lease_token=extensions.gen_random_uuid(),
      lease_expires_at=now()+make_interval(secs=>greatest(30,least(coalesce(p_lease_seconds,120),600))),
      attempt_started_for_lease=null,next_attempt_at=null,failure_code=null,failure_message=null
    from candidates where d.id=candidates.id returning d.*
  )
  select l.id,l.lease_token,l.idempotency_key,l.attempt_count,
    e.id,e.type,e.organization_id,e.recipient_profile_id,p.email,
    concat_ws(' ',p.first_name,p.last_name),e.occurred_at,e.game_id,e.assignment_id,e.claim_id,
    e.metadata,coalesce(o.settings,'{}'::jsonb)
  from leased l
  join public.communication_events e on e.id=l.communication_event_id and e.organization_id=l.organization_id
  join public.profiles p on p.id=l.recipient_profile_id and p.organization_id=l.organization_id
  join public.organizations o on o.id=l.organization_id;
end;
$$;

create or replace function public.record_staging_email_capture(
  p_idempotency_key text,p_subject text
) returns jsonb
language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_delivery public.communication_deliveries%rowtype;
  v_event public.communication_events%rowtype;
  v_email text;
  v_failure boolean;
  v_provider_id text;
begin
  if (select auth.role())<>'service_role' then raise exception using errcode='42501',message='staging_email_worker_forbidden'; end if;
  select d.* into v_delivery
  from public.communication_deliveries d
  join public.communication_events e on e.id=d.communication_event_id
  where d.idempotency_key=p_idempotency_key and d.status='processing'
    and d.attempt_started_for_lease=d.lease_token and e.metadata @> '{"staging_email_test":true}'::jsonb;
  if not found then raise exception using errcode='P0001',message='staging_email_delivery_not_claimed'; end if;
  select * into strict v_event from public.communication_events where id=v_delivery.communication_event_id;
  select email into v_email from public.profiles
   where id=v_delivery.recipient_profile_id and organization_id=v_delivery.organization_id;
  if lower(coalesce(v_email,'')) not like '%@slate.invalid' then
    raise exception using errcode='42501',message='staging_email_recipient_not_allowed';
  end if;
  v_failure:=coalesce((v_event.metadata->>'simulate_transient_failure')::boolean,false) and v_delivery.attempt_count=1;
  v_provider_id:=concat('staging-sink:',v_delivery.id);
  insert into private.staging_email_captures(
    delivery_id,organization_id,attempt_number,recipient_email,subject,outcome,
    provider_message_id,failure_code
  ) values (
    v_delivery.id,v_delivery.organization_id,v_delivery.attempt_count,lower(v_email),left(p_subject,240),
    case when v_failure then 'controlled_failure' else 'accepted' end,
    case when v_failure then null else v_provider_id end,
    case when v_failure then 'staging_controlled_failure' else null end
  ) on conflict(delivery_id,attempt_number) do nothing;
  if v_failure then
    return jsonb_build_object('success',false,'retryable',true,
      'failureCode','staging_controlled_failure','failureMessage','Controlled staging sink failure.');
  end if;
  return jsonb_build_object('success',true,'providerMessageId',v_provider_id);
end;
$$;

create or replace function public.get_staging_email_captures()
returns table(
  delivery_id uuid,event_type text,recipient_email text,subject text,outcome text,
  attempt_number integer,delivery_status public.communication_delivery_status,
  attempt_count integer,captured_at timestamptz
)
language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
declare v_organization_id uuid:=private.assert_staging_email_administrator();
begin
  return query select c.delivery_id,e.type,c.recipient_email,c.subject,c.outcome,
    c.attempt_number,d.status,d.attempt_count,c.captured_at
  from private.staging_email_captures c
  join public.communication_deliveries d on d.id=c.delivery_id and d.organization_id=c.organization_id
  join public.communication_events e on e.id=d.communication_event_id and e.organization_id=d.organization_id
  where c.organization_id=v_organization_id
  order by c.captured_at desc,c.id desc limit 100;
end;
$$;

revoke all on function private.assert_staging_email_administrator() from public,anon,authenticated;
revoke all on function public.authorize_staging_email_sink() from public,anon,authenticated;
revoke all on function public.enqueue_staging_email_test(uuid,text,boolean) from public,anon,authenticated;
revoke all on function public.claim_staging_email_deliveries(uuid,integer,integer) from public,anon,authenticated;
revoke all on function public.record_staging_email_capture(text,text) from public,anon,authenticated;
revoke all on function public.get_staging_email_captures() from public,anon,authenticated;
grant execute on function public.authorize_staging_email_sink() to authenticated;
grant execute on function public.enqueue_staging_email_test(uuid,text,boolean) to authenticated;
grant execute on function public.get_staging_email_captures() to authenticated;
grant execute on function public.claim_staging_email_deliveries(uuid,integer,integer) to service_role;
grant execute on function public.record_staging_email_capture(text,text) to service_role;

comment on table private.staging_email_captures is
  'Non-network staging-only delivery evidence. Never stores message bodies or authentication tokens.';
