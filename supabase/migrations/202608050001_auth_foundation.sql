-- Milestone 2B: Supabase Auth registration and account-approval foundation.
-- Domain persistence remains unchanged and no localStorage data is migrated.

create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code_digest bytea not null,
  created_by_profile_id uuid not null,
  expires_at timestamptz not null,
  max_uses integer not null default 1 check (max_uses > 0),
  use_count integer not null default 0 check (use_count >= 0 and use_count <= max_uses),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (code_digest),
  foreign key (organization_id, created_by_profile_id)
    references public.profiles(organization_id, id) on delete restrict,
  check (expires_at > created_at)
);

create index organization_invitations_active_idx
  on public.organization_invitations (organization_id, expires_at)
  where revoked_at is null;

alter table public.organization_invitations enable row level security;

create policy invitations_select_admin
  on public.organization_invitations for select to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.is_administrator()
  );

grant select on public.organization_invitations to authenticated;
revoke all on public.organization_invitations from anon;

create function public.create_umpire_invitation(
  p_invitation_code text,
  p_expires_at timestamptz,
  p_max_uses integer default 1
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, extensions, public
as $$
declare
  invitation_id uuid;
  organization_id uuid := public.current_organization_id();
  profile_id uuid := public.current_profile_id();
begin
  if not public.is_administrator() then
    raise exception 'Only administrators may create registration invitations';
  end if;

  if length(btrim(p_invitation_code)) < 24 then
    raise exception 'Invitation codes must contain at least 24 characters';
  end if;

  if p_expires_at <= now() then
    raise exception 'Invitation expiration must be in the future';
  end if;

  if p_max_uses is null or p_max_uses < 1 then
    raise exception 'Invitation max uses must be positive';
  end if;

  insert into public.organization_invitations (
    organization_id,
    code_digest,
    created_by_profile_id,
    expires_at,
    max_uses
  ) values (
    organization_id,
    digest(convert_to(btrim(p_invitation_code), 'utf8'), 'sha256'),
    profile_id,
    p_expires_at,
    p_max_uses
  )
  returning id into invitation_id;

  return invitation_id;
end;
$$;

create function public.provision_pending_umpire(
  p_invitation_code text,
  p_first_name text,
  p_last_name text,
  p_phone text default ''
)
returns public.profiles
language plpgsql
security definer
set search_path = pg_catalog, extensions, public
as $$
declare
  authenticated_user auth.users%rowtype;
  invitation public.organization_invitations%rowtype;
  existing_profile public.profiles%rowtype;
  created_profile public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  select * into authenticated_user
  from auth.users
  where id = auth.uid();

  if not found or authenticated_user.email is null then
    raise exception 'Authenticated user was not found';
  end if;

  if authenticated_user.email_confirmed_at is null then
    raise exception 'Email verification is required';
  end if;

  select * into existing_profile
  from public.profiles
  where auth_user_id = auth.uid();

  if found then
    if existing_profile.role <> 'umpire' or existing_profile.status <> 'pending' then
      raise exception 'Authenticated user already has a non-pending profile';
    end if;
    return existing_profile;
  end if;

  if btrim(coalesce(p_first_name, '')) = '' or btrim(coalesce(p_last_name, '')) = '' then
    raise exception 'First and last name are required';
  end if;

  select * into invitation
  from public.organization_invitations
  where code_digest = digest(convert_to(btrim(p_invitation_code), 'utf8'), 'sha256')
    and revoked_at is null
    and expires_at > now()
    and use_count < max_uses
  for update;

  if not found then
    raise exception 'Invitation is invalid, expired, revoked, or fully used';
  end if;

  insert into public.profiles (
    organization_id,
    auth_user_id,
    role,
    status,
    first_name,
    last_name,
    email,
    phone
  ) values (
    invitation.organization_id,
    auth.uid(),
    'umpire',
    'pending',
    btrim(p_first_name),
    btrim(p_last_name),
    lower(authenticated_user.email),
    btrim(coalesce(p_phone, ''))
  )
  returning * into created_profile;

  update public.organization_invitations
  set use_count = use_count + 1
  where id = invitation.id;

  insert into public.activities (
    organization_id,
    actor_profile_id,
    type,
    action,
    subject,
    message,
    metadata
  ) values (
    created_profile.organization_id,
    created_profile.id,
    'account',
    'account_registered',
    concat_ws(' ', created_profile.first_name, created_profile.last_name),
    'Authenticated umpire registration submitted for approval.',
    jsonb_build_object('invitationId', invitation.id)
  );

  return created_profile;
end;
$$;

create function public.approve_umpire_profile(
  p_target_profile_id uuid,
  p_target_crew_member_id uuid
)
returns public.profiles
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  administrator_profile_id uuid := public.current_profile_id();
  administrator_organization_id uuid := public.current_organization_id();
  target_profile public.profiles%rowtype;
  target_crew_member public.crew_members%rowtype;
begin
  if not public.is_administrator() then
    raise exception 'Only administrators may approve umpire profiles';
  end if;

  select * into target_profile
  from public.profiles
  where id = p_target_profile_id
    and organization_id = administrator_organization_id
  for update;

  if not found then
    raise exception 'Pending profile was not found in this organization';
  end if;

  if target_profile.role <> 'umpire' or target_profile.status <> 'pending' then
    raise exception 'Only pending umpire profiles may be approved';
  end if;

  select * into target_crew_member
  from public.crew_members
  where id = p_target_crew_member_id
    and organization_id = administrator_organization_id
  for update;

  if not found then
    raise exception 'Crew member was not found in this organization';
  end if;

  if target_crew_member.profile_id is not null
    and target_crew_member.profile_id <> target_profile.id then
    raise exception 'Crew member is already linked to another profile';
  end if;

  update public.profiles
  set status = 'approved', approved_at = now(), rejected_at = null
  where id = target_profile.id
  returning * into target_profile;

  update public.crew_members
  set profile_id = target_profile.id
  where id = target_crew_member.id;

  insert into public.notifications (
    organization_id,
    type,
    audience,
    recipient_profile_id,
    title,
    message,
    destination_page
  ) values (
    administrator_organization_id,
    'account-approved',
    'account',
    target_profile.id,
    'Account Approved',
    'Your account for The Slate has been approved.',
    'profile'
  );

  insert into public.activities (
    organization_id,
    actor_profile_id,
    type,
    action,
    subject,
    message,
    metadata
  ) values (
    administrator_organization_id,
    administrator_profile_id,
    'account',
    'account_approved',
    concat_ws(' ', target_profile.first_name, target_profile.last_name),
    'Umpire account approved and linked to crew.',
    jsonb_build_object(
      'profileId', target_profile.id,
      'crewMemberId', target_crew_member.id
    )
  );

  return target_profile;
end;
$$;

create function public.bootstrap_organization(
  p_organization_name text,
  p_organization_slug text,
  p_administrator_auth_user_id uuid,
  p_administrator_first_name text,
  p_administrator_last_name text,
  p_season_name text,
  p_season_starts_on date,
  p_season_ends_on date
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  authenticated_user auth.users%rowtype;
  organization_id uuid;
  administrator_profile_id uuid;
  season_id uuid;
begin
  if auth.role() <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Trusted service-role bootstrap is required';
  end if;

  select * into authenticated_user
  from auth.users
  where id = p_administrator_auth_user_id;

  if not found or authenticated_user.email is null or authenticated_user.email_confirmed_at is null then
    raise exception 'A verified administrator Auth user is required';
  end if;

  insert into public.organizations (name, slug)
  values (btrim(p_organization_name), btrim(p_organization_slug))
  returning id into organization_id;

  insert into public.seasons (
    organization_id,
    name,
    starts_on,
    ends_on,
    active
  ) values (
    organization_id,
    btrim(p_season_name),
    p_season_starts_on,
    p_season_ends_on,
    true
  ) returning id into season_id;

  insert into public.profiles (
    organization_id,
    auth_user_id,
    role,
    status,
    first_name,
    last_name,
    email,
    approved_at
  ) values (
    organization_id,
    p_administrator_auth_user_id,
    'administrator',
    'approved',
    btrim(p_administrator_first_name),
    btrim(p_administrator_last_name),
    lower(authenticated_user.email),
    now()
  ) returning id into administrator_profile_id;

  insert into public.migration_runs (
    organization_id,
    version,
    source_key,
    source_fingerprint,
    result,
    applied_by_profile_id
  ) values (
    organization_id,
    '2B-bootstrap',
    'trusted-bootstrap',
    p_administrator_auth_user_id::text,
    jsonb_build_object('seasonId', season_id),
    administrator_profile_id
  );

  return jsonb_build_object(
    'organizationId', organization_id,
    'administratorProfileId', administrator_profile_id,
    'seasonId', season_id
  );
end;
$$;

revoke all on function public.create_umpire_invitation(text, timestamptz, integer) from public;
revoke all on function public.provision_pending_umpire(text, text, text, text) from public;
revoke all on function public.approve_umpire_profile(uuid, uuid) from public;
revoke all on function public.bootstrap_organization(text, text, uuid, text, text, text, date, date) from public;

grant execute on function public.create_umpire_invitation(text, timestamptz, integer) to authenticated;
grant execute on function public.provision_pending_umpire(text, text, text, text) to authenticated;
grant execute on function public.approve_umpire_profile(uuid, uuid) to authenticated;
grant execute on function public.bootstrap_organization(text, text, uuid, text, text, text, date, date) to service_role;
