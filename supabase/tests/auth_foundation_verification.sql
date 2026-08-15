-- Run after all three migrations in an empty disposable Supabase database.
-- The transaction always rolls back.
begin;

insert into auth.users (id, email, email_confirmed_at) values
  ('a1000000-0000-0000-0000-000000000001', 'bootstrap-admin@test.invalid', now()),
  ('a1000000-0000-0000-0000-000000000002', 'verified-umpire@test.invalid', now()),
  ('a1000000-0000-0000-0000-000000000003', 'unverified-umpire@test.invalid', null),
  ('a1000000-0000-0000-0000-000000000004', 'second-umpire@test.invalid', now());

select set_config('request.jwt.claim.role', 'service_role', true);
set local role service_role;
select public.bootstrap_organization(
  'Milestone 2B Test Organization',
  'milestone-2b-test',
  'a1000000-0000-0000-0000-000000000001',
  'Bootstrap',
  'Administrator',
  'Fall Test',
  current_date,
  current_date + 90
);
reset role;

do $$
declare
  test_organization_id uuid;
begin
  select id into test_organization_id
  from public.organizations
  where slug = 'milestone-2b-test';

  if test_organization_id is null then
    raise exception 'trusted bootstrap did not create the organization';
  end if;

  if (select count(*) from public.profiles where organization_id = test_organization_id and role = 'administrator' and status = 'approved') <> 1 then
    raise exception 'trusted bootstrap did not create one approved administrator';
  end if;

  if (select count(*) from public.seasons where organization_id = test_organization_id and active) <> 1 then
    raise exception 'trusted bootstrap did not create one active season';
  end if;
end $$;

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select public.create_umpire_invitation(
  'M2B-TEST-CODE-1234567890',
  now() + interval '1 day',
  1
);
reset role;

-- An authenticated but unverified user cannot provision a profile.
select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-000000000003', true);
set local role authenticated;
do $$
begin
  begin
    perform public.provision_pending_umpire('M2B-TEST-CODE-1234567890', 'Unverified', 'Umpire', '');
    raise exception 'unverified registration unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm = 'unverified registration unexpectedly succeeded' then raise; end if;
  end;
end $$;
reset role;

-- A verified user receives exactly one pending umpire profile; retry is idempotent.
select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-000000000002', true);
set local role authenticated;
select public.provision_pending_umpire('M2B-TEST-CODE-1234567890', 'Verified', 'Umpire', '5550102000');
select public.provision_pending_umpire('M2B-TEST-CODE-1234567890', 'Ignored', 'Retry', '');
do $$
begin
  if (select count(*) from public.profiles where auth_user_id = auth.uid() and role = 'umpire' and status = 'pending') <> 1 then
    raise exception 'pending profile provisioning was not idempotent';
  end if;
end $$;
reset role;

-- The single-use invitation cannot provision a different Auth user.
select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-000000000004', true);
set local role authenticated;
do $$
begin
  begin
    perform public.provision_pending_umpire('M2B-TEST-CODE-1234567890', 'Second', 'Umpire', '');
    raise exception 'fully used invitation unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm = 'fully used invitation unexpectedly succeeded' then raise; end if;
  end;
end $$;
reset role;

-- Administrator approval and crew linkage are one transaction.
reset role;
insert into public.crew_members (
  id,
  organization_id,
  legacy_crew_id,
  first_name,
  last_name
)
select
  'a5000000-0000-0000-0000-000000000001',
  id,
  'm2b-test-crew',
  'Verified',
  'Umpire'
from public.organizations
where slug = 'milestone-2b-test';

select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select public.approve_umpire_profile(
  (select id from public.profiles where auth_user_id = 'a1000000-0000-0000-0000-000000000002'),
  'a5000000-0000-0000-0000-000000000001'
);
reset role;

do $$
declare
  approved_profile_id uuid;
begin
  select id into approved_profile_id
  from public.profiles
  where auth_user_id = 'a1000000-0000-0000-0000-000000000002'
    and status = 'approved';

  if approved_profile_id is null then
    raise exception 'profile approval failed';
  end if;

  if (select profile_id from public.crew_members where id = 'a5000000-0000-0000-0000-000000000001') <> approved_profile_id then
    raise exception 'crew linkage failed';
  end if;

  if (select count(*) from public.notifications where recipient_profile_id = approved_profile_id and type = 'account-approved') <> 1 then
    raise exception 'approval notification was not created';
  end if;

  if (select count(*) from public.activities where action = 'account_approved' and metadata ->> 'profileId' = approved_profile_id::text) <> 1 then
    raise exception 'approval activity was not created';
  end if;
end $$;

rollback;
