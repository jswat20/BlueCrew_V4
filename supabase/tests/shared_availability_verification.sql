-- Run after all migrations in a disposable database. The transaction always rolls back.
begin;

insert into auth.users (id, email, email_confirmed_at)
values ('b1000000-0000-4000-8000-000000000001', 'm3a-umpire@test.invalid', now());

insert into public.organizations (id, name, slug)
values ('b2000000-0000-4000-8000-000000000001', 'Milestone 3A Test', 'milestone-3a-test');

insert into public.profiles (
  id, organization_id, auth_user_id, role, status, first_name, last_name, email, approved_at
) values (
  'b3000000-0000-4000-8000-000000000001',
  'b2000000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000001',
  'umpire', 'approved', 'Milestone', 'Umpire', 'm3a-umpire@test.invalid', now()
);

insert into public.crew_members (
  id, organization_id, profile_id, first_name, last_name
) values (
  'b4000000-0000-4000-8000-000000000001',
  'b2000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000001',
  'Milestone', 'Umpire'
);

insert into public.availability (
  organization_id, crew_member_id, availability_date, status
) values
  ('b2000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000001', date '2026-08-01', 'available'),
  ('b2000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000001', date '2026-08-02', 'maybe'),
  ('b2000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000001', date '2026-08-08', 'unavailable');

create function public.m3a_force_availability_failure()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if new.availability_date = date '2026-08-09' then
    raise exception 'forced atomic verification failure';
  end if;
  return new;
end;
$$;

create trigger m3a_force_availability_failure
before insert or update on public.availability
for each row execute function public.m3a_force_availability_failure();

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000001', true);
set local role authenticated;

do $$
begin
  begin
    perform public.set_own_availability_range(date '2026-08-08', date '2026-08-10', 'available');
    raise exception 'range unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm = 'range unexpectedly succeeded' then raise; end if;
  end;
  if (select count(*) from public.availability where availability_date between date '2026-08-08' and date '2026-08-10') <> 1
    or (select status from public.availability where availability_date = date '2026-08-08') <> 'unavailable' then
    raise exception 'failed range operation left partial writes';
  end if;

  begin
    perform public.copy_own_availability_week(date '2026-08-01', date '2026-08-08');
    raise exception 'copy unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm = 'copy unexpectedly succeeded' then raise; end if;
  end;
  if (select count(*) from public.availability where availability_date between date '2026-08-08' and date '2026-08-14') <> 1
    or (select status from public.availability where availability_date = date '2026-08-08') <> 'unavailable' then
    raise exception 'failed copy operation did not restore the target week';
  end if;
end $$;

reset role;
drop trigger m3a_force_availability_failure on public.availability;
drop function public.m3a_force_availability_failure();

select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select public.set_own_availability_range(date '2026-08-15', date '2026-08-17', 'available');
select public.copy_own_availability_week(date '2026-08-01', date '2026-08-22');

do $$
begin
  if (select count(*) from public.availability where availability_date between date '2026-08-15' and date '2026-08-17' and status = 'available') <> 3 then
    raise exception 'successful range operation did not write every day';
  end if;
  if (select count(*) from public.availability where availability_date between date '2026-08-22' and date '2026-08-28') <> 2 then
    raise exception 'successful copy operation did not copy the source week';
  end if;
end $$;
reset role;

rollback;
