-- Run after both migrations in a disposable database. The transaction always rolls back.
begin;

insert into auth.users (id, email) values
  ('30000000-0000-0000-0000-000000000001', 'admin-a@test.invalid'),
  ('30000000-0000-0000-0000-000000000002', 'assigner-a@test.invalid'),
  ('30000000-0000-0000-0000-000000000003', 'pending-a@test.invalid'),
  ('30000000-0000-0000-0000-000000000004', 'umpire-a@test.invalid'),
  ('30000000-0000-0000-0000-000000000005', 'other-a@test.invalid'),
  ('30000000-0000-0000-0000-000000000006', 'umpire-b@test.invalid'),
  ('30000000-0000-0000-0000-000000000007', 'admin-b@test.invalid');

insert into public.organizations (id, legacy_organization_id, name, slug) values
  ('10000000-0000-0000-0000-000000000001', 'legacy-org-a', 'Organization A', 'organization-a'),
  ('10000000-0000-0000-0000-000000000002', 'legacy-org-b', 'Organization B', 'organization-b');

insert into public.seasons (id, organization_id, legacy_season_id, name, starts_on, ends_on, active) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'legacy-season-a', 'Fall A', current_date, current_date + 90, true),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'legacy-season-b', 'Fall B', current_date, current_date + 90, true);

insert into public.profiles (id, organization_id, auth_user_id, legacy_account_id, role, status, first_name, last_name, email) values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'legacy-admin-a', 'administrator', 'approved', 'Admin', 'A', 'admin-a@test.invalid'),
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 'legacy-assigner-a', 'assigner', 'approved', 'Assigner', 'A', 'assigner-a@test.invalid'),
  ('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'legacy-pending-a', 'umpire', 'pending', 'Pending', 'A', 'pending-a@test.invalid'),
  ('40000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000004', 'legacy-umpire-a', 'umpire', 'approved', 'Umpire', 'A', 'umpire-a@test.invalid'),
  ('40000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000005', 'legacy-other-a', 'umpire', 'approved', 'Other', 'A', 'other-a@test.invalid'),
  ('40000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000006', 'legacy-umpire-b', 'umpire', 'approved', 'Umpire', 'B', 'umpire-b@test.invalid'),
  ('40000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000007', 'legacy-admin-b', 'administrator', 'approved', 'Admin', 'B', 'admin-b@test.invalid');

insert into public.crew_members (id, organization_id, profile_id, legacy_crew_id, first_name, last_name) values
  ('50000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', 'legacy-pending-crew-a', 'Pending', 'A'),
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000004', 'legacy-crew-a', 'Umpire', 'A'),
  ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000005', 'legacy-other-crew-a', 'Other', 'A'),
  ('50000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000006', 'legacy-crew-b', 'Umpire', 'B');

insert into public.locations (id, organization_id, legacy_location_id, name) values
  ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'legacy-location-a', 'Complex A'),
  ('60000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'legacy-location-b', 'Complex B');
insert into public.fields (id, organization_id, location_id, legacy_field_id, name) values
  ('61000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'legacy-field-a', 'Field A'),
  ('61000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000002', 'legacy-field-b', 'Field B');

insert into public.games (id, organization_id, season_id, location_id, field_id, legacy_game_id, game_date, game_time, home_team, away_team) values
  ('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000001', 'legacy-game-a', current_date + 7, '18:00', 'Home A', 'Away A'),
  ('70000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000002', 'legacy-game-b', current_date + 7, '18:00', 'Home B', 'Away B');

insert into public.game_assignments (id, organization_id, game_id, legacy_assignment_id, position, status, assigned_crew_member_id, locked) values
  ('80000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'legacy-open-a', 'Plate', 'open_for_claim', null, false),
  ('80000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'legacy-locked-a', 'Base', 'open_for_claim', null, true),
  ('80000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'legacy-needs-a', 'U3', 'needs_assignment', null, false),
  ('80000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'legacy-own-a', 'U4', 'assigned', '50000000-0000-0000-0000-000000000001', false),
  ('80000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'legacy-other-a', 'Observer', 'assigned', '50000000-0000-0000-0000-000000000002', false),
  ('80000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000002', 'legacy-open-b', 'Plate', 'open_for_claim', null, false);

insert into public.notifications (id, organization_id, legacy_notification_id, audience, recipient_profile_id, title, message, reminder_key) values
  ('90000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'legacy-notification-own', 'account', '40000000-0000-0000-0000-000000000004', 'Own', 'Own recipient', 'target-reminder'),
  ('90000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'legacy-notification-other', 'account', '40000000-0000-0000-0000-000000000005', 'Other', 'Other recipient', null),
  ('90000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'legacy-notification-admin', 'admin', null, 'Admin', 'Admin audience', null),
  ('90000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'legacy-notification-umpire', 'umpire', null, 'Umpire', 'Umpire audience', 'broadcast-reminder'),
  ('90000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', 'legacy-notification-b', 'umpire', null, 'B', 'Organization B', null);

-- Anonymous has no application-table privileges.
set local role anon;
do $$
begin
  begin perform count(*) from public.organizations; raise exception 'anonymous read unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
  begin insert into public.organizations (name, slug) values ('Bad', 'bad'); raise exception 'anonymous write unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Pending umpire sees and edits only their profile.
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000003', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.profiles) <> 1 then raise exception 'pending profile visibility failed'; end if;
  if (select count(*) from public.games) <> 0 then raise exception 'pending game isolation failed'; end if;
  update public.profiles set phone = '5550100003', communication_preferences = '{"assignments":false}' where auth_user_id = auth.uid();
  begin update public.profiles set role = 'administrator' where auth_user_id = auth.uid(); raise exception 'pending role update unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm = 'pending role update unexpectedly succeeded' then raise; end if;
  end;
  begin update public.profiles set status = 'approved' where auth_user_id = auth.uid(); raise exception 'pending status update unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm = 'pending status update unexpectedly succeeded' then raise; end if;
  end;
  begin update public.profiles set organization_id = '10000000-0000-0000-0000-000000000002' where auth_user_id = auth.uid(); raise exception 'pending organization update unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm = 'pending organization update unexpectedly succeeded' then raise; end if;
  end;
  begin update public.profiles set official_history = '[{"level":"unauthorized"}]' where auth_user_id = auth.uid(); raise exception 'pending history update unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm = 'pending history update unexpectedly succeeded' then raise; end if;
  end;
  begin update public.profiles set admin_notes = 'unauthorized' where auth_user_id = auth.uid(); raise exception 'pending administrator-field update unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm = 'pending administrator-field update unexpectedly succeeded' then raise; end if;
  end;
  if (select count(*) from public.game_assignments) <> 0 then raise exception 'pending assignment visibility failed'; end if;
  if (select count(*) from public.assignment_claims) <> 0 then raise exception 'pending claim visibility failed'; end if;
  if (select count(*) from public.crew_members) <> 0 then raise exception 'pending crew-link visibility failed'; end if;
  update public.crew_members set profile_id = null where id = '50000000-0000-0000-0000-000000000004';
  if found then raise exception 'pending crew-link update unexpectedly succeeded'; end if;
  update public.games set game_time = '20:00';
  if found then raise exception 'pending game update unexpectedly succeeded'; end if;
  update public.locations set name = 'Unauthorized';
  if found then raise exception 'pending location update unexpectedly succeeded'; end if;
  update public.seasons set name = 'Unauthorized';
  if found then raise exception 'pending season update unexpectedly succeeded'; end if;
  begin
    insert into public.availability (organization_id, crew_member_id, availability_date, status)
      values ('10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000004', current_date + 8, 'available');
    raise exception 'pending availability insert unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Approved linked umpire boundaries.
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000004', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.games) <> 1 then raise exception 'umpire game organization scope failed'; end if;
  if (select count(*) from public.profiles) <> 1 then raise exception 'umpire private profile isolation failed'; end if;
  if (select count(*) from public.game_assignments) <> 3 then raise exception 'umpire assignment visibility failed'; end if;
  insert into public.availability (organization_id, crew_member_id, availability_date, status)
    values ('10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', current_date + 8, 'available');
  if (select count(*) from public.availability) <> 1 then raise exception 'umpire private availability isolation failed'; end if;
  begin
    insert into public.availability (organization_id, crew_member_id, availability_date, status)
      values ('10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', current_date + 8, 'available');
    raise exception 'other availability insert unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
  perform public.submit_assignment_claim('80000000-0000-0000-0000-000000000001');
  begin
    perform public.submit_assignment_claim('80000000-0000-0000-0000-000000000001');
    raise exception 'duplicate pending claim unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm = 'duplicate pending claim unexpectedly succeeded' then raise; end if;
  end;
  begin
    perform public.submit_assignment_claim('80000000-0000-0000-0000-000000000002');
    raise exception 'locked assignment claim unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm = 'locked assignment claim unexpectedly succeeded' then raise; end if;
  end;
  begin
    perform public.submit_assignment_claim('80000000-0000-0000-0000-000000000003');
    raise exception 'non-open assignment claim unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm = 'non-open assignment claim unexpectedly succeeded' then raise; end if;
  end;
  update public.game_assignments set status = 'assigned' where id = '80000000-0000-0000-0000-000000000001';
  if found then raise exception 'umpire assignment update unexpectedly succeeded'; end if;
  if (select count(*) from public.notifications) <> 2 then raise exception 'umpire notification visibility failed'; end if;
  update public.notifications set read_at = now() where id = '90000000-0000-0000-0000-000000000001';
  begin
    update public.notifications set title = 'Tampered' where id = '90000000-0000-0000-0000-000000000001';
    raise exception 'notification content update unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm = 'notification content update unexpectedly succeeded' then raise; end if;
  end;
  insert into public.activities (organization_id, actor_profile_id, type, action)
    values ('10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000004', 'test', 'append');
  update public.activities set action = 'tampered';
  if found then raise exception 'activity update unexpectedly succeeded'; end if;
  delete from public.activities;
  if found then raise exception 'activity delete unexpectedly succeeded'; end if;
end $$;
reset role;

-- Assigner can manage scheduling but not configuration or profiles.
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000002', true);
set local role authenticated;
do $$
begin
  update public.games set game_time = '19:00' where id = '70000000-0000-0000-0000-000000000001';
  if not found then raise exception 'assigner game update failed'; end if;
  update public.games set game_time = '20:00' where id = '70000000-0000-0000-0000-000000000002';
  if found then raise exception 'assigner cross-organization game update unexpectedly succeeded'; end if;
  update public.game_assignments set status = 'pending_approval' where id = '80000000-0000-0000-0000-000000000001';
  if not found then raise exception 'assigner assignment update failed'; end if;
  perform public.decide_assignment_claim('80000000-0000-0000-0000-000000000001', 'approved', null);
  if (select status from public.game_assignments where id = '80000000-0000-0000-0000-000000000001') <> 'assigned' then
    raise exception 'assigner claim decision failed';
  end if;
  begin
    insert into public.assignment_claims (organization_id, assignment_id, claimant_crew_member_id)
      values ('10000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000002');
    raise exception 'direct claim insert unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
  if (select count(*) from public.profiles where id = '40000000-0000-0000-0000-000000000004') <> 0 then raise exception 'assigner private profile leak'; end if;
  update public.seasons set name = 'Unauthorized' where id = '20000000-0000-0000-0000-000000000001';
  if found then raise exception 'assigner season update unexpectedly succeeded'; end if;
  update public.locations set name = 'Unauthorized' where id = '60000000-0000-0000-0000-000000000001';
  if found then raise exception 'assigner location update unexpectedly succeeded'; end if;
  update public.organizations set name = 'Unauthorized';
  if found then raise exception 'assigner organization update unexpectedly succeeded'; end if;
  begin
    update public.assignment_claims set status = 'rejected' where assignment_id = '80000000-0000-0000-0000-000000000001';
    raise exception 'terminal claim transition unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Administrator manages organization A and cannot cross into B.
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000001', true);
set local role authenticated;
do $$
begin
  update public.profiles set admin_notes = 'Approved locally' where id = '40000000-0000-0000-0000-000000000004';
  if not found then raise exception 'administrator profile update failed'; end if;
  update public.crew_members set notes = 'Configured' where id = '50000000-0000-0000-0000-000000000001';
  update public.seasons set name = 'Fall A Updated' where id = '20000000-0000-0000-0000-000000000001';
  update public.locations set address = '1 Main Street' where id = '60000000-0000-0000-0000-000000000001';
  update public.fields set name = 'Field A Updated' where id = '61000000-0000-0000-0000-000000000001';
  update public.organizations set name = 'Organization A Updated' where id = '10000000-0000-0000-0000-000000000001';
  update public.organizations set name = 'Cross-org violation' where id = '10000000-0000-0000-0000-000000000002';
  if found then raise exception 'administrator cross-organization update unexpectedly succeeded'; end if;
  update public.profiles set admin_notes = 'Cross-org violation' where id = '40000000-0000-0000-0000-000000000006';
  if found then raise exception 'administrator cross-organization profile update unexpectedly succeeded'; end if;
  if (select count(*) from public.games where organization_id = '10000000-0000-0000-0000-000000000002') <> 0 then raise exception 'administrator cross-organization read leak'; end if;
end $$;
reset role;

-- Owner-level relationship, uniqueness, legacy ID, reminder, and delete checks.
do $$
begin
  if not exists (select 1 from public.games where legacy_game_id = 'legacy-game-a') then raise exception 'legacy ID compatibility failed'; end if;
  begin
    insert into public.fields (organization_id, location_id, name)
      values ('10000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000001', 'Cross-org field');
    raise exception 'cross-organization location/field FK unexpectedly succeeded';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.crew_members (organization_id, profile_id, first_name)
      values ('10000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000004', 'Cross-org');
    raise exception 'cross-organization profile/crew FK unexpectedly succeeded';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.seasons (organization_id, name, starts_on, ends_on, active)
      values ('10000000-0000-0000-0000-000000000001', 'Second Active', current_date, current_date + 10, true);
    raise exception 'second active season unexpectedly succeeded';
  exception when unique_violation then null; end;
  begin
    insert into public.notifications (organization_id, audience, recipient_profile_id, title, message, reminder_key)
      values ('10000000-0000-0000-0000-000000000001', 'account', '40000000-0000-0000-0000-000000000004', 'Duplicate', 'Duplicate', 'target-reminder');
    raise exception 'target reminder duplicate unexpectedly succeeded';
  exception when unique_violation then null; end;
  begin
    insert into public.notifications (organization_id, audience, title, message, reminder_key)
      values ('10000000-0000-0000-0000-000000000001', 'umpire', 'Duplicate', 'Duplicate', 'broadcast-reminder');
    raise exception 'broadcast reminder duplicate unexpectedly succeeded';
  exception when unique_violation then null; end;
  begin
    delete from public.organizations where id = '10000000-0000-0000-0000-000000000001';
    raise exception 'organization restrictive delete unexpectedly succeeded';
  exception when restrict_violation or foreign_key_violation then null; end;
end $$;

-- Cascading game deletion removes assignments and claims.
delete from public.games where id = '70000000-0000-0000-0000-000000000001';
do $$
begin
  if exists (select 1 from public.game_assignments where game_id = '70000000-0000-0000-0000-000000000001') then raise exception 'assignment cascade failed'; end if;
  if exists (select 1 from public.assignment_claims where organization_id = '10000000-0000-0000-0000-000000000001') then raise exception 'claim cascade failed'; end if;
end $$;

rollback;
