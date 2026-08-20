-- Run after all migrations in a disposable database. The transaction always rolls back.
begin;

insert into auth.users (id, email, email_confirmed_at) values
  ('a1000000-0000-4000-8000-000000000001', 'm4a-admin@test.invalid', now()),
  ('a1000000-0000-4000-8000-000000000002', 'm4a-umpire-one@test.invalid', now()),
  ('a1000000-0000-4000-8000-000000000003', 'm4a-umpire-two@test.invalid', now());

insert into public.organizations (id, name, slug)
values ('a2000000-0000-4000-8000-000000000001', 'Milestone 4A Test', 'milestone-4a-test');
insert into public.seasons (id, organization_id, name, starts_on, ends_on, active)
values ('a3000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'Fall', current_date, current_date + 90, true);
insert into public.profiles (id, organization_id, auth_user_id, role, status, first_name, last_name, email, approved_at) values
  ('a4000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'administrator', 'approved', 'Milestone', 'Admin', 'm4a-admin@test.invalid', now()),
  ('a4000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', 'umpire', 'approved', 'Umpire', 'One', 'm4a-umpire-one@test.invalid', now()),
  ('a4000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000003', 'umpire', 'approved', 'Umpire', 'Two', 'm4a-umpire-two@test.invalid', now());
insert into public.crew_members (id, organization_id, profile_id, first_name, last_name) values
  ('a5000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000002', 'Umpire', 'One'),
  ('a5000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000003', 'Umpire', 'Two');
insert into public.locations (id, organization_id, name)
values ('a6000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'Test Complex');
insert into public.fields (id, organization_id, location_id, name)
values ('a6100000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000001', 'Field 1');
insert into public.games (id, organization_id, season_id, location_id, field_id, game_date, game_time, home_team, away_team)
values ('a7000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000001', 'a6100000-0000-4000-8000-000000000001', current_date + 7, '18:00', 'Home', 'Away');
insert into public.game_assignments (id, organization_id, game_id, position, status, locked) values
  ('a8000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000001', 'Plate', 'open_for_claim', false),
  ('a8000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000001', 'Base', 'open_for_claim', false);

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select public.submit_assignment_claim('a8000000-0000-4000-8000-000000000001');
reset role;

do $$
begin
  if (select status from public.game_assignments where id = 'a8000000-0000-4000-8000-000000000001') <> 'pending_approval'
    or (select count(*) from public.assignment_claims where assignment_id = 'a8000000-0000-4000-8000-000000000001' and status = 'pending') <> 1 then
    raise exception 'claim submission did not persist atomically';
  end if;
end $$;

select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000003', true);
set local role authenticated;
do $$
begin
  begin
    perform public.submit_assignment_claim('a8000000-0000-4000-8000-000000000001');
    raise exception 'competing claim unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm = 'competing claim unexpectedly succeeded' then raise; end if;
    if sqlerrm <> 'assignment_already_claimed' then raise; end if;
  end;
end $$;
reset role;

select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select public.decide_assignment_claim('a8000000-0000-4000-8000-000000000001', 'approved', null);
reset role;

do $$
begin
  if (select status from public.game_assignments where id = 'a8000000-0000-4000-8000-000000000001') <> 'assigned'
    or (select assigned_crew_member_id from public.game_assignments where id = 'a8000000-0000-4000-8000-000000000001') <> 'a5000000-0000-4000-8000-000000000002'
    or (select status from public.assignment_claims where assignment_id = 'a8000000-0000-4000-8000-000000000001') <> 'approved' then
    raise exception 'claim approval did not persist consistently';
  end if;
end $$;

select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000002', true);
set local role authenticated;
do $$
begin
  begin
    perform public.submit_assignment_claim('a8000000-0000-4000-8000-000000000002');
    raise exception 'already assigned claimant unexpectedly claimed another position';
  exception when raise_exception then
    if sqlerrm = 'already assigned claimant unexpectedly claimed another position' then raise; end if;
    if sqlerrm <> 'claimant_already_assigned_to_game' then raise; end if;
  end;
end $$;
reset role;

select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000003', true);
set local role authenticated;
select public.submit_assignment_claim('a8000000-0000-4000-8000-000000000002');
reset role;

create function public.m4a_force_assignment_failure()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if new.id = 'a8000000-0000-4000-8000-000000000002' and new.status = 'assigned' then
    raise exception 'forced approval failure';
  end if;
  return new;
end;
$$;
create trigger m4a_force_assignment_failure before update on public.game_assignments
for each row execute function public.m4a_force_assignment_failure();

select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
set local role authenticated;
do $$
begin
  begin
    perform public.decide_assignment_claim('a8000000-0000-4000-8000-000000000002', 'approved', null);
    raise exception 'forced approval unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm = 'forced approval unexpectedly succeeded' then raise; end if;
  end;
end $$;
reset role;

do $$
begin
  if (select status from public.game_assignments where id = 'a8000000-0000-4000-8000-000000000002') <> 'pending_approval'
    or (select status from public.assignment_claims where assignment_id = 'a8000000-0000-4000-8000-000000000002') <> 'pending' then
    raise exception 'failed approval left partial writes';
  end if;
end $$;

drop trigger m4a_force_assignment_failure on public.game_assignments;
drop function public.m4a_force_assignment_failure();

select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select public.decide_assignment_claim('a8000000-0000-4000-8000-000000000002', 'rejected', 'Not selected');
reset role;

do $$
begin
  if (select status from public.game_assignments where id = 'a8000000-0000-4000-8000-000000000002') <> 'open_for_claim'
    or (select status from public.assignment_claims where assignment_id = 'a8000000-0000-4000-8000-000000000002') <> 'rejected' then
    raise exception 'claim rejection did not reopen consistently';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from public.assignment_claims
    where status = 'pending'
    group by organization_id, assignment_id
    having count(*) > 1
  ) then raise exception 'multiple active reservations exist for one position'; end if;
  if to_regclass('public.assignment_claims_one_pending_per_assignment') is null then
    raise exception 'exclusive pending reservation index is missing';
  end if;
end $$;

rollback;
