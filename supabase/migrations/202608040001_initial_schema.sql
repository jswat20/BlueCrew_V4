-- Milestone 2A: shared BlueCrew schema. No production data migration.

create extension if not exists pgcrypto;

create type public.account_role as enum ('administrator', 'assigner', 'umpire');
create type public.account_status as enum ('pending', 'approved', 'rejected');
create type public.game_lifecycle_status as enum ('scheduled', 'completed', 'submitted', 'returned', 'approved', 'postponed', 'cancelled');
create type public.assignment_status as enum ('needs_assignment', 'open_for_claim', 'pending_approval', 'assigned', 'locked');
create type public.claim_status as enum ('pending', 'approved', 'rejected', 'withdrawn');
create type public.availability_status as enum ('available', 'unavailable', 'maybe');
create type public.notification_audience as enum ('admin', 'assigner', 'umpire', 'account');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  legacy_organization_id text,
  name text not null check (btrim(name) <> ''),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  timezone text not null default 'America/New_York',
  active boolean not null default true,
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slug),
  unique (legacy_organization_id)
);

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  legacy_season_id text,
  name text not null check (btrim(name) <> ''),
  starts_on date not null,
  ends_on date not null,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  unique (organization_id, id),
  unique (organization_id, legacy_season_id),
  unique (organization_id, name)
);

create unique index seasons_one_active_per_organization
  on public.seasons (organization_id) where active = true;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  auth_user_id uuid not null references auth.users(id) on delete restrict,
  legacy_account_id text,
  role public.account_role not null default 'umpire',
  status public.account_status not null default 'pending',
  first_name text not null default '',
  last_name text not null default '',
  email text not null check (btrim(email) <> ''),
  phone text not null default '',
  home_phone text not null default '',
  address text not null default '',
  contact_preference text not null default 'text' check (contact_preference in ('text', 'call')),
  birthdate date,
  emergency_contact text not null default '',
  emergency_contact_phone text not null default '',
  photo_path text,
  crew_code text,
  crew_code_issued_at timestamptz,
  official_history jsonb not null default '[]'::jsonb check (jsonb_typeof(official_history) = 'array'),
  years_of_service_override smallint check (years_of_service_override between 0 and 80),
  admin_notes text not null default '',
  communication_preferences jsonb not null default '{}'::jsonb check (jsonb_typeof(communication_preferences) = 'object'),
  approved_at timestamptz,
  rejected_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (auth_user_id),
  unique (organization_id, id),
  unique (organization_id, legacy_account_id),
  unique (organization_id, crew_code)
);

create unique index profiles_organization_email_key
  on public.profiles (organization_id, lower(email));

create table public.crew_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  profile_id uuid,
  legacy_crew_id text,
  first_name text not null default '',
  last_name text not null default '',
  email text not null default '',
  phone text not null default '',
  active boolean not null default true,
  eligible_levels text[] not null default '{}',
  preferences jsonb not null default '{}'::jsonb check (jsonb_typeof(preferences) = 'object'),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, profile_id),
  unique (organization_id, legacy_crew_id),
  foreign key (organization_id, profile_id) references public.profiles(organization_id, id) on delete restrict
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  legacy_location_id text,
  name text not null check (btrim(name) <> ''),
  address text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, legacy_location_id),
  unique (organization_id, name)
);

create table public.fields (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  location_id uuid not null,
  legacy_field_id text,
  name text not null check (btrim(name) <> ''),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, location_id, id),
  unique (organization_id, legacy_field_id),
  unique (organization_id, location_id, name),
  foreign key (organization_id, location_id) references public.locations(organization_id, id) on delete restrict
);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  season_id uuid not null,
  location_id uuid not null,
  field_id uuid not null,
  legacy_game_id text,
  game_date date not null,
  game_time time not null,
  timezone text not null default 'America/New_York',
  home_team text not null check (btrim(home_team) <> ''),
  away_team text not null check (btrim(away_team) <> ''),
  level text not null default '',
  game_type text not null default 'single',
  lifecycle_status public.game_lifecycle_status not null default 'scheduled',
  review jsonb not null default '{}'::jsonb check (jsonb_typeof(review) = 'object'),
  report jsonb not null default '{}'::jsonb check (jsonb_typeof(report) = 'object'),
  source_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(source_metadata) = 'object'),
  created_by_profile_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, legacy_game_id),
  foreign key (organization_id, season_id) references public.seasons(organization_id, id) on delete restrict,
  foreign key (organization_id, location_id, field_id) references public.fields(organization_id, location_id, id) on delete restrict,
  foreign key (organization_id, created_by_profile_id) references public.profiles(organization_id, id) on delete restrict,
  check (home_team <> away_team)
);

create table public.game_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  game_id uuid not null,
  legacy_assignment_id text,
  position text not null check (btrim(position) <> ''),
  status public.assignment_status not null default 'needs_assignment',
  assigned_crew_member_id uuid,
  locked boolean not null default false,
  accepted_at timestamptz,
  declined_at timestamptz,
  decline_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, legacy_assignment_id),
  unique (organization_id, game_id, position),
  foreign key (organization_id, game_id) references public.games(organization_id, id) on delete cascade,
  foreign key (organization_id, assigned_crew_member_id) references public.crew_members(organization_id, id) on delete restrict,
  check (declined_at is null or nullif(btrim(decline_reason), '') is not null)
);

create table public.assignment_claims (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  assignment_id uuid not null,
  claimant_crew_member_id uuid not null,
  legacy_claim_id text,
  status public.claim_status not null default 'pending',
  decision_by_profile_id uuid,
  decision_reason text,
  claimed_at timestamptz not null default now(),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, legacy_claim_id),
  foreign key (organization_id, assignment_id) references public.game_assignments(organization_id, id) on delete cascade,
  foreign key (organization_id, claimant_crew_member_id) references public.crew_members(organization_id, id) on delete restrict,
  foreign key (organization_id, decision_by_profile_id) references public.profiles(organization_id, id) on delete restrict
);

create unique index assignment_claims_one_pending_per_crew
  on public.assignment_claims (organization_id, assignment_id, claimant_crew_member_id)
  where status = 'pending';

create unique index assignment_claims_one_approved_per_assignment
  on public.assignment_claims (organization_id, assignment_id)
  where status = 'approved';

create table public.availability (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  crew_member_id uuid not null,
  availability_date date not null,
  status public.availability_status not null,
  starts_at time,
  ends_at time,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique nulls not distinct (organization_id, crew_member_id, availability_date, starts_at, ends_at),
  foreign key (organization_id, crew_member_id) references public.crew_members(organization_id, id) on delete cascade,
  check ((starts_at is null and ends_at is null) or (starts_at is not null and ends_at is not null and ends_at > starts_at))
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  legacy_notification_id text,
  type text not null default 'general',
  audience public.notification_audience not null,
  recipient_profile_id uuid,
  title text not null check (btrim(title) <> ''),
  message text not null check (btrim(message) <> ''),
  related_legacy_id text,
  destination_page text not null default '',
  destination_context jsonb not null default '{}'::jsonb check (jsonb_typeof(destination_context) = 'object'),
  reminder_key text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, legacy_notification_id),
  unique (organization_id, recipient_profile_id, reminder_key),
  foreign key (organization_id, recipient_profile_id) references public.profiles(organization_id, id) on delete cascade,
  check ((audience = 'account' and recipient_profile_id is not null) or audience <> 'account')
);

create unique index notifications_broadcast_reminder_key
  on public.notifications (organization_id, audience, reminder_key)
  where recipient_profile_id is null and reminder_key is not null;

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  legacy_activity_id text,
  actor_profile_id uuid,
  type text not null check (btrim(type) <> ''),
  action text not null check (btrim(action) <> ''),
  subject text not null default '',
  object text not null default '',
  message text not null default '',
  related_legacy_id text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, legacy_activity_id),
  foreign key (organization_id, actor_profile_id) references public.profiles(organization_id, id) on delete restrict
);

create table public.report_presets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  owner_profile_id uuid not null,
  legacy_preset_id text,
  name text not null check (btrim(name) <> ''),
  filters jsonb not null default '{}'::jsonb check (jsonb_typeof(filters) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, legacy_preset_id),
  unique (organization_id, owner_profile_id, name),
  foreign key (organization_id, owner_profile_id) references public.profiles(organization_id, id) on delete cascade
);

create table public.migration_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  version text not null check (btrim(version) <> ''),
  source_key text not null check (btrim(source_key) <> ''),
  source_fingerprint text not null,
  result jsonb not null default '{}'::jsonb check (jsonb_typeof(result) = 'object'),
  applied_by_profile_id uuid,
  applied_at timestamptz not null default now(),
  unique (organization_id, version, source_key, source_fingerprint),
  foreign key (organization_id, applied_by_profile_id) references public.profiles(organization_id, id) on delete restrict
);

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'organizations', 'seasons', 'profiles', 'crew_members', 'locations',
    'fields', 'games', 'game_assignments', 'assignment_claims',
    'availability', 'report_presets'
  ] loop
    execute format(
      'create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name, table_name
    );
  end loop;
end;
$$;

create index profiles_organization_role_status_idx on public.profiles (organization_id, role, status);
create index crew_members_organization_active_idx on public.crew_members (organization_id, active);
create index games_organization_date_idx on public.games (organization_id, game_date, game_time);
create index assignments_game_status_idx on public.game_assignments (organization_id, game_id, status);
create index claims_assignment_status_idx on public.assignment_claims (organization_id, assignment_id, status);
create index availability_crew_date_idx on public.availability (organization_id, crew_member_id, availability_date);
create index notifications_recipient_created_idx on public.notifications (organization_id, recipient_profile_id, created_at desc);
create index activities_organization_created_idx on public.activities (organization_id, created_at desc);
