-- Read-only, organization/division-scoped access for league leadership.

alter table public.personnel_id_counters
  drop constraint if exists personnel_id_counters_role_prefix_check;
alter table public.personnel_id_counters
  add constraint personnel_id_counters_role_prefix_check
  check (role_prefix in ('UMP', 'ADM', 'ASN', 'LVW'));

create or replace function public.personnel_role_prefix(p_role public.account_role)
returns text language sql immutable parallel safe set search_path = pg_catalog
as $$
  select case p_role
    when 'administrator' then 'ADM'
    when 'assigner' then 'ASN'
    when 'league_viewer' then 'LVW'
    else 'UMP'
  end
$$;

create table public.league_viewer_scopes (
  profile_id uuid primary key,
  organization_id uuid not null,
  all_divisions boolean not null default false,
  division_levels text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, profile_id)
    references public.profiles (organization_id, id) on delete cascade,
  check (all_divisions or cardinality(division_levels) > 0),
  check (not all_divisions or cardinality(division_levels) = 0)
);

create index league_viewer_scopes_organization_idx
  on public.league_viewer_scopes (organization_id);

alter table public.league_viewer_scopes enable row level security;

create policy league_viewer_scopes_select_self_or_admin
  on public.league_viewer_scopes for select to authenticated
  using (
    organization_id = public.current_organization_id()
    and (profile_id = public.current_profile_id() or public.is_administrator())
  );

create policy league_viewer_scopes_manage_admin
  on public.league_viewer_scopes for all to authenticated
  using (organization_id = public.current_organization_id() and public.is_administrator())
  with check (
    organization_id = public.current_organization_id()
    and public.is_administrator()
    and exists (
      select 1 from public.profiles profile
      where profile.id = profile_id
        and profile.organization_id = organization_id
        and profile.role = 'league_viewer'
        and profile.status = 'approved'
    )
  );

create or replace function public.is_league_viewer()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where auth_user_id = auth.uid()
      and role = 'league_viewer'
      and status = 'approved'
  )
$$;

create or replace function public.league_viewer_can_view_level(p_level text)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles viewer
    join public.league_viewer_scopes scope
      on scope.profile_id = viewer.id
     and scope.organization_id = viewer.organization_id
    where viewer.auth_user_id = auth.uid()
      and viewer.role = 'league_viewer'
      and viewer.status = 'approved'
      and (scope.all_divisions or p_level = any(scope.division_levels))
  )
$$;

create or replace function public.league_viewer_can_view_crew(p_crew_member_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles viewer
    join public.league_viewer_scopes scope
      on scope.profile_id = viewer.id
     and scope.organization_id = viewer.organization_id
    join public.crew_members crew
      on crew.id = p_crew_member_id
     and crew.organization_id = viewer.organization_id
    where viewer.auth_user_id = auth.uid()
      and viewer.role = 'league_viewer'
      and viewer.status = 'approved'
      and (
        scope.all_divisions
        or crew.eligible_levels && scope.division_levels
        or exists (
          select 1
          from public.game_assignments assignment
          join public.games game
            on game.id = assignment.game_id
           and game.organization_id = assignment.organization_id
          where assignment.organization_id = viewer.organization_id
            and assignment.assigned_crew_member_id = crew.id
            and (scope.all_divisions or game.level = any(scope.division_levels))
        )
      )
  )
$$;

create or replace function public.league_viewer_can_view_profile(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles viewer
    join public.league_viewer_scopes scope
      on scope.profile_id = viewer.id
     and scope.organization_id = viewer.organization_id
    join public.profiles target
      on target.id = p_profile_id
     and target.organization_id = viewer.organization_id
    left join public.crew_members crew
      on crew.profile_id = target.id
     and crew.organization_id = target.organization_id
    where viewer.auth_user_id = auth.uid()
      and viewer.role = 'league_viewer'
      and viewer.status = 'approved'
      and target.role = 'umpire'
      and (
        (scope.all_divisions and (crew.id is not null or target.status = 'approved'))
        or (crew.id is not null and public.league_viewer_can_view_crew(crew.id))
      )
  )
$$;

create or replace function public.league_viewer_can_view_auth_user(p_auth_user_id text)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles target
    where target.auth_user_id::text = p_auth_user_id
      and public.league_viewer_can_view_profile(target.id)
  )
$$;

revoke all on function public.is_league_viewer() from public;
revoke all on function public.league_viewer_can_view_level(text) from public;
revoke all on function public.league_viewer_can_view_crew(uuid) from public;
revoke all on function public.league_viewer_can_view_profile(uuid) from public;
revoke all on function public.league_viewer_can_view_auth_user(text) from public;
grant execute on function public.is_league_viewer() to authenticated;
grant execute on function public.league_viewer_can_view_level(text) to authenticated;
grant execute on function public.league_viewer_can_view_crew(uuid) to authenticated;
grant execute on function public.league_viewer_can_view_profile(uuid) to authenticated;
grant execute on function public.league_viewer_can_view_auth_user(text) to authenticated;

drop policy if exists games_select_member on public.games;
create policy games_select_member on public.games for select to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.is_approved_account()
    and (
      public.current_account_role() <> 'league_viewer'
      or public.league_viewer_can_view_level(level)
    )
  );

drop policy if exists crew_select_member on public.crew_members;
create policy crew_select_member on public.crew_members for select to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.is_approved_account()
    and (
      public.current_account_role() <> 'league_viewer'
      or public.league_viewer_can_view_crew(id)
    )
  );

drop policy if exists assignments_select_member on public.game_assignments;
create policy assignments_select_member on public.game_assignments for select to authenticated
  using (
    organization_id = public.current_organization_id()
    and (
      public.is_assigner_or_administrator()
      or (
        public.current_account_role() = 'league_viewer'
        and exists (
          select 1 from public.games game
          where game.id = game_assignments.game_id
            and game.organization_id = game_assignments.organization_id
            and public.league_viewer_can_view_level(game.level)
        )
      )
      or (
        public.current_account_role() = 'umpire'
        and (
          assigned_crew_member_id = public.current_crew_member_id()
          or status = 'open_for_claim'
          or (status = 'needs_assignment' and exists (
            select 1 from public.assignment_claims claim
            where claim.organization_id = game_assignments.organization_id
              and claim.assignment_id = game_assignments.id
              and claim.status = 'withdrawn'
          ))
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

create policy profiles_select_league_viewer
  on public.profiles for select to authenticated
  using (public.league_viewer_can_view_profile(id));

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
  using (auth_user_id = auth.uid() and public.current_account_role() <> 'league_viewer')
  with check (auth_user_id = auth.uid() and public.current_account_role() <> 'league_viewer');

drop policy if exists notifications_update_recipient on public.notifications;
create policy notifications_update_recipient on public.notifications for update to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.current_account_role() <> 'league_viewer'
    and (recipient_profile_id = public.current_profile_id() or public.is_assigner_or_administrator())
  )
  with check (
    organization_id = public.current_organization_id()
    and public.current_account_role() <> 'league_viewer'
  );

drop policy if exists activities_insert_member on public.activities;
create policy activities_insert_member on public.activities for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.is_approved_account()
    and public.current_account_role() <> 'league_viewer'
    and (actor_profile_id is null or actor_profile_id = public.current_profile_id())
  );

create policy profile_photos_select_league_viewer
  on storage.objects for select to authenticated
  using (
    bucket_id = 'profile-photos'
    and public.is_league_viewer()
    and name = split_part(name, '/', 1) || '/profile'
    and public.league_viewer_can_view_auth_user(split_part(name, '/', 1))
  );

drop policy if exists profile_photos_insert_own on storage.objects;
create policy profile_photos_insert_own on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-photos'
    and public.current_account_role() <> 'league_viewer'
    and name = auth.uid()::text || '/profile'
  );

drop policy if exists profile_photos_update_own on storage.objects;
create policy profile_photos_update_own on storage.objects for update to authenticated
  using (
    bucket_id = 'profile-photos'
    and public.current_account_role() <> 'league_viewer'
    and name = auth.uid()::text || '/profile'
  )
  with check (
    bucket_id = 'profile-photos'
    and public.current_account_role() <> 'league_viewer'
    and name = auth.uid()::text || '/profile'
  );

drop policy if exists profile_photos_delete_own on storage.objects;
create policy profile_photos_delete_own on storage.objects for delete to authenticated
  using (
    bucket_id = 'profile-photos'
    and public.current_account_role() <> 'league_viewer'
    and name = auth.uid()::text || '/profile'
  );
