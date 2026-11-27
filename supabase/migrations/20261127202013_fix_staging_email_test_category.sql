-- Use a communication category accepted by the established queue schema for
-- each synthetic event type. The staging sink must exercise the real queue
-- contract instead of introducing a staging-only category.
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
  v_category text;
begin
  if p_event_type not in ('assignment-created','game-time-changed','account-approved') then
    raise exception using errcode='P0001',message='staging_email_event_not_allowed';
  end if;
  v_category:=case p_event_type
    when 'assignment-created' then 'assignments'
    when 'game-time-changed' then 'game_changes'
    when 'account-approved' then 'account'
  end;
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
    v_organization_id,p_event_type,v_category,v_recipient.id,v_key,v_actor_profile_id,
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

revoke all on function public.enqueue_staging_email_test(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.enqueue_staging_email_test(uuid,text,boolean) to authenticated;
