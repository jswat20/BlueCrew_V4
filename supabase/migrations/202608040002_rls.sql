-- Milestone 2A: organization-scoped authorization foundation.

create function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.profiles where auth_user_id = auth.uid() limit 1
$$;

create function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where auth_user_id = auth.uid() limit 1
$$;

create function public.current_account_role()
returns public.account_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles
  where auth_user_id = auth.uid() and status = 'approved'
  limit 1
$$;

create function public.current_crew_member_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select crew_members.id
  from public.crew_members
  join public.profiles on profiles.id = crew_members.profile_id
    and profiles.organization_id = crew_members.organization_id
  where profiles.auth_user_id = auth.uid()
  limit 1
$$;

create function public.is_administrator()
returns boolean language sql stable
as $$ select public.current_account_role() = 'administrator' $$;

create function public.is_assigner_or_administrator()
returns boolean language sql stable
as $$ select public.current_account_role() in ('administrator', 'assigner') $$;

create function public.is_approved_account()
returns boolean language sql stable
as $$ select public.current_account_role() is not null $$;

revoke all on function public.current_profile_id() from public;
revoke all on function public.current_organization_id() from public;
revoke all on function public.current_account_role() from public;
revoke all on function public.current_crew_member_id() from public;
grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.current_organization_id() to authenticated;
grant execute on function public.current_account_role() to authenticated;
grant execute on function public.current_crew_member_id() to authenticated;
revoke all on function public.is_administrator() from public;
revoke all on function public.is_assigner_or_administrator() from public;
revoke all on function public.is_approved_account() from public;
grant execute on function public.is_administrator() to authenticated;
grant execute on function public.is_assigner_or_administrator() to authenticated;
grant execute on function public.is_approved_account() to authenticated;

create function public.protect_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or public.is_administrator() then
    return new;
  end if;

  if old.auth_user_id <> auth.uid() then
    raise exception 'Profiles may only be updated by their owner or an administrator';
  end if;

  if new.id is distinct from old.id
    or new.organization_id is distinct from old.organization_id
    or new.auth_user_id is distinct from old.auth_user_id
    or new.legacy_account_id is distinct from old.legacy_account_id
    or new.role is distinct from old.role
    or new.status is distinct from old.status
    or new.first_name is distinct from old.first_name
    or new.last_name is distinct from old.last_name
    or new.birthdate is distinct from old.birthdate
    or new.crew_code is distinct from old.crew_code
    or new.crew_code_issued_at is distinct from old.crew_code_issued_at
    or new.official_history is distinct from old.official_history
    or new.years_of_service_override is distinct from old.years_of_service_override
    or new.admin_notes is distinct from old.admin_notes
    or new.approved_at is distinct from old.approved_at
    or new.rejected_at is distinct from old.rejected_at
    or new.created_at is distinct from old.created_at then
    raise exception 'One or more profile fields are administrator-managed';
  end if;

  return new;
end;
$$;

create trigger profiles_protect_update
before update on public.profiles
for each row execute function public.protect_profile_update();

create function public.protect_notification_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or public.is_assigner_or_administrator() then
    return new;
  end if;

  if new.id is distinct from old.id
    or new.organization_id is distinct from old.organization_id
    or new.legacy_notification_id is distinct from old.legacy_notification_id
    or new.type is distinct from old.type
    or new.audience is distinct from old.audience
    or new.recipient_profile_id is distinct from old.recipient_profile_id
    or new.title is distinct from old.title
    or new.message is distinct from old.message
    or new.related_legacy_id is distinct from old.related_legacy_id
    or new.destination_page is distinct from old.destination_page
    or new.destination_context is distinct from old.destination_context
    or new.reminder_key is distinct from old.reminder_key
    or new.created_at is distinct from old.created_at then
    raise exception 'Only notification read state may be changed';
  end if;

  return new;
end;
$$;

create trigger notifications_protect_update
before update on public.notifications
for each row execute function public.protect_notification_update();

create function public.protect_claim_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'pending' then
      raise exception 'New claims must start pending';
    end if;
    return new;
  end if;

  if old.status <> 'pending' or new.status not in ('pending', 'approved', 'rejected', 'withdrawn') then
    raise exception 'Invalid claim status transition from % to %', old.status, new.status;
  end if;

  if new.status in ('approved', 'rejected') and (new.decided_at is null or new.decision_by_profile_id is null) then
    raise exception 'Claim decisions require decision timestamp and actor';
  end if;

  return new;
end;
$$;

create trigger assignment_claims_protect_transition
before insert or update on public.assignment_claims
for each row execute function public.protect_claim_transition();

alter table public.organizations enable row level security;
alter table public.seasons enable row level security;
alter table public.profiles enable row level security;
alter table public.crew_members enable row level security;
alter table public.locations enable row level security;
alter table public.fields enable row level security;
alter table public.games enable row level security;
alter table public.game_assignments enable row level security;
alter table public.assignment_claims enable row level security;
alter table public.availability enable row level security;
alter table public.notifications enable row level security;
alter table public.activities enable row level security;
alter table public.report_presets enable row level security;
alter table public.migration_runs enable row level security;

create policy organizations_select_member on public.organizations for select to authenticated
  using (id = public.current_organization_id() and public.is_approved_account());
create policy organizations_update_admin on public.organizations for update to authenticated
  using (id = public.current_organization_id() and public.is_administrator())
  with check (id = public.current_organization_id() and public.is_administrator());

create policy seasons_select_member on public.seasons for select to authenticated
  using (organization_id = public.current_organization_id() and public.is_approved_account());
create policy seasons_manage_admin on public.seasons for all to authenticated
  using (organization_id = public.current_organization_id() and public.is_administrator())
  with check (organization_id = public.current_organization_id() and public.is_administrator());

create policy profiles_select_self on public.profiles for select to authenticated
  using (auth_user_id = auth.uid());
create policy profiles_select_admin on public.profiles for select to authenticated
  using (organization_id = public.current_organization_id() and public.is_administrator());
create policy profiles_insert_admin on public.profiles for insert to authenticated
  with check (organization_id = public.current_organization_id() and public.is_administrator());
create policy profiles_update_self on public.profiles for update to authenticated
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());
create policy profiles_update_admin on public.profiles for update to authenticated
  using (organization_id = public.current_organization_id() and public.is_administrator())
  with check (organization_id = public.current_organization_id() and public.is_administrator());
create policy profiles_delete_admin on public.profiles for delete to authenticated
  using (organization_id = public.current_organization_id() and public.is_administrator());

create policy crew_select_member on public.crew_members for select to authenticated
  using (organization_id = public.current_organization_id() and public.is_approved_account());
create policy crew_manage_admin on public.crew_members for all to authenticated
  using (organization_id = public.current_organization_id() and public.is_administrator())
  with check (organization_id = public.current_organization_id() and public.is_administrator());

create policy locations_select_member on public.locations for select to authenticated
  using (organization_id = public.current_organization_id() and public.is_approved_account());
create policy locations_manage_admin on public.locations for all to authenticated
  using (organization_id = public.current_organization_id() and public.is_administrator())
  with check (organization_id = public.current_organization_id() and public.is_administrator());
create policy fields_select_member on public.fields for select to authenticated
  using (organization_id = public.current_organization_id() and public.is_approved_account());
create policy fields_manage_admin on public.fields for all to authenticated
  using (organization_id = public.current_organization_id() and public.is_administrator())
  with check (organization_id = public.current_organization_id() and public.is_administrator());

create policy games_select_member on public.games for select to authenticated
  using (organization_id = public.current_organization_id() and public.is_approved_account());
create policy games_manage_assigners on public.games for all to authenticated
  using (organization_id = public.current_organization_id() and public.is_assigner_or_administrator())
  with check (organization_id = public.current_organization_id() and public.is_assigner_or_administrator());

create policy assignments_select_member on public.game_assignments for select to authenticated
  using (
    organization_id = public.current_organization_id()
    and (
      public.is_assigner_or_administrator()
      or (
        public.current_account_role() = 'umpire'
        and (
          assigned_crew_member_id = public.current_crew_member_id()
          or status = 'open_for_claim'
          or exists (
            select 1 from public.assignment_claims claim
            where claim.organization_id = game_assignments.organization_id
              and claim.assignment_id = game_assignments.id
              and claim.claimant_crew_member_id = public.current_crew_member_id()
          )
        )
      )
    )
  );
create policy assignments_manage_assigners on public.game_assignments for all to authenticated
  using (organization_id = public.current_organization_id() and public.is_assigner_or_administrator())
  with check (organization_id = public.current_organization_id() and public.is_assigner_or_administrator());

create policy claims_select_own on public.assignment_claims for select to authenticated
  using (organization_id = public.current_organization_id() and claimant_crew_member_id = public.current_crew_member_id() and public.is_approved_account());
create policy claims_insert_own on public.assignment_claims for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.is_approved_account()
    and claimant_crew_member_id = public.current_crew_member_id()
    and status = 'pending'
    and exists (
      select 1 from public.game_assignments assignment
      where assignment.id = assignment_claims.assignment_id
        and assignment.organization_id = assignment_claims.organization_id
        and assignment.status = 'open_for_claim'
        and assignment.locked = false
    )
  );
create policy claims_manage_assigners on public.assignment_claims for all to authenticated
  using (organization_id = public.current_organization_id() and public.is_assigner_or_administrator())
  with check (organization_id = public.current_organization_id() and public.is_assigner_or_administrator());

create policy availability_select_own_or_manager on public.availability for select to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.is_approved_account()
    and (crew_member_id = public.current_crew_member_id() or public.is_assigner_or_administrator())
  );
create policy availability_insert_own on public.availability for insert to authenticated
  with check (organization_id = public.current_organization_id() and crew_member_id = public.current_crew_member_id() and public.is_approved_account());
create policy availability_update_own on public.availability for update to authenticated
  using (organization_id = public.current_organization_id() and crew_member_id = public.current_crew_member_id() and public.is_approved_account())
  with check (organization_id = public.current_organization_id() and crew_member_id = public.current_crew_member_id() and public.is_approved_account());
create policy availability_delete_own on public.availability for delete to authenticated
  using (organization_id = public.current_organization_id() and crew_member_id = public.current_crew_member_id() and public.is_approved_account());

create policy notifications_select_recipient_or_audience on public.notifications for select to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.is_approved_account()
    and (
      recipient_profile_id = public.current_profile_id()
      or (recipient_profile_id is null and audience = 'admin' and public.is_administrator())
      or (recipient_profile_id is null and audience = 'assigner' and public.is_assigner_or_administrator())
      or (recipient_profile_id is null and audience = 'umpire' and public.current_account_role() = 'umpire')
    )
  );
create policy notifications_insert_manager on public.notifications for insert to authenticated
  with check (organization_id = public.current_organization_id() and public.is_assigner_or_administrator());
create policy notifications_update_recipient on public.notifications for update to authenticated
  using (
    organization_id = public.current_organization_id()
    and (recipient_profile_id = public.current_profile_id() or public.is_assigner_or_administrator())
  )
  with check (organization_id = public.current_organization_id());
create policy notifications_delete_manager on public.notifications for delete to authenticated
  using (organization_id = public.current_organization_id() and public.is_assigner_or_administrator());

create policy activities_select_manager on public.activities for select to authenticated
  using (organization_id = public.current_organization_id() and public.is_assigner_or_administrator());
create policy activities_insert_member on public.activities for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.is_approved_account()
    and (actor_profile_id is null or actor_profile_id = public.current_profile_id())
  );

create policy presets_manage_owner on public.report_presets for all to authenticated
  using (organization_id = public.current_organization_id() and owner_profile_id = public.current_profile_id() and public.is_approved_account())
  with check (organization_id = public.current_organization_id() and owner_profile_id = public.current_profile_id() and public.is_approved_account());

create policy migration_runs_select_admin on public.migration_runs for select to authenticated
  using (organization_id = public.current_organization_id() and public.is_administrator());
create policy migration_runs_insert_admin on public.migration_runs for insert to authenticated
  with check (organization_id = public.current_organization_id() and public.is_administrator());

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.organizations, public.seasons, public.profiles,
  public.crew_members, public.locations, public.fields, public.games, public.game_assignments,
  public.assignment_claims, public.availability, public.notifications, public.activities,
  public.report_presets, public.migration_runs to authenticated;

revoke all on public.organizations, public.seasons, public.profiles, public.crew_members,
  public.locations, public.fields, public.games, public.game_assignments, public.assignment_claims,
  public.availability, public.notifications, public.activities, public.report_presets,
  public.migration_runs from anon;
