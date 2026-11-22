-- The Slate V2 SaaS tenant foundation.
-- Additive and backwards compatible: legacy profiles remain authoritative until
-- active-workspace switching is introduced in a later, separately reviewed migration.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid,
  status text not null default 'pending'
    check (status in ('invited', 'pending', 'approved', 'suspended', 'revoked')),
  invited_by_auth_user_id uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, auth_user_id),
  foreign key (organization_id, profile_id)
    references public.profiles(organization_id, id) on delete restrict,
  check ((status = 'approved') = (approved_at is not null)),
  check (status <> 'revoked' or revoked_at is not null)
);

create table public.organization_membership_roles (
  organization_id uuid not null,
  membership_id uuid not null,
  role_code text not null check (role_code in (
    'administrator', 'assigner', 'umpire', 'league_viewer',
    'facility_manager', 'tournament_director'
  )),
  granted_by_membership_id uuid,
  created_at timestamptz not null default now(),
  primary key (organization_id, membership_id, role_code),
  foreign key (organization_id, membership_id)
    references public.organization_memberships(organization_id, id) on delete cascade,
  foreign key (organization_id, granted_by_membership_id)
    references public.organization_memberships(organization_id, id) on delete restrict
);

create table public.organization_module_entitlements (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  module_code text not null check (module_code in ('league', 'umpire')),
  enabled boolean not null default false,
  entitlement_source text not null default 'platform_operator'
    check (entitlement_source in ('legacy_backfill', 'platform_operator', 'subscription')),
  effective_at timestamptz not null default now(),
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (organization_id, module_code),
  check (expires_at is null or expires_at > effective_at)
);

create table public.workspace_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_auth_user_id uuid references auth.users(id) on delete set null,
  action text not null check (btrim(action) <> ''),
  entity_type text not null check (btrim(entity_type) <> ''),
  entity_id uuid,
  correlation_id uuid not null default gen_random_uuid(),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (organization_id, id)
);

create index organization_memberships_auth_status_idx
  on public.organization_memberships (auth_user_id, status, organization_id);
create index organization_memberships_organization_status_idx
  on public.organization_memberships (organization_id, status, auth_user_id);
create index organization_membership_roles_membership_idx
  on public.organization_membership_roles (membership_id, organization_id, role_code);
create index organization_module_entitlements_enabled_idx
  on public.organization_module_entitlements (organization_id, module_code)
  where enabled;
create index workspace_audit_events_organization_created_idx
  on public.workspace_audit_events (organization_id, created_at desc);

create trigger organization_memberships_set_updated_at
before update on public.organization_memberships
for each row execute function public.set_updated_at();

create trigger organization_module_entitlements_set_updated_at
before update on public.organization_module_entitlements
for each row execute function public.set_updated_at();

insert into public.organization_memberships (
  organization_id, auth_user_id, profile_id, status, approved_at, revoked_at, created_at, updated_at
)
select
  p.organization_id,
  p.auth_user_id,
  p.id,
  case p.status::text
    when 'approved' then 'approved'
    when 'rejected' then 'revoked'
    else 'pending'
  end,
  case when p.status::text = 'approved' then coalesce(p.approved_at, p.created_at, now()) end,
  case when p.status::text = 'rejected' then coalesce(p.rejected_at, p.updated_at, now()) end,
  p.created_at,
  p.updated_at
from public.profiles p
on conflict (organization_id, auth_user_id) do update
set profile_id = excluded.profile_id,
    status = excluded.status,
    approved_at = excluded.approved_at,
    revoked_at = excluded.revoked_at,
    updated_at = excluded.updated_at;

insert into public.organization_membership_roles (organization_id, membership_id, role_code)
select m.organization_id, m.id, p.role::text
from public.organization_memberships m
join public.profiles p
  on p.organization_id = m.organization_id
 and p.auth_user_id = m.auth_user_id
on conflict do nothing;

insert into public.organization_module_entitlements (
  organization_id, module_code, enabled, entitlement_source
)
select o.id, module_code, true, 'legacy_backfill'
from public.organizations o
cross join (values ('league'), ('umpire')) modules(module_code)
on conflict (organization_id, module_code) do nothing;

create or replace function private.has_approved_membership(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = p_organization_id
      and m.auth_user_id = (select auth.uid())
      and m.status = 'approved'
  )
$$;

create or replace function private.has_membership_role(
  p_organization_id uuid,
  p_role_codes text[]
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.organization_memberships m
    join public.organization_membership_roles r
      on r.organization_id = m.organization_id
     and r.membership_id = m.id
    where m.organization_id = p_organization_id
      and m.auth_user_id = (select auth.uid())
      and m.status = 'approved'
      and r.role_code = any (p_role_codes)
  )
$$;

create or replace function private.organization_module_enabled(
  p_organization_id uuid,
  p_module_code text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.organization_module_entitlements e
    where e.organization_id = p_organization_id
      and e.module_code = p_module_code
      and e.enabled
      and e.effective_at <= now()
      and (e.expires_at is null or e.expires_at > now())
  )
$$;

revoke all on function private.has_approved_membership(uuid) from public;
revoke all on function private.has_membership_role(uuid, text[]) from public;
revoke all on function private.organization_module_enabled(uuid, text) from public;
grant execute on function private.has_approved_membership(uuid) to authenticated, service_role;
grant execute on function private.has_membership_role(uuid, text[]) to authenticated, service_role;
grant execute on function private.organization_module_enabled(uuid, text) to authenticated, service_role;

alter table public.organization_memberships enable row level security;
alter table public.organization_membership_roles enable row level security;
alter table public.organization_module_entitlements enable row level security;
alter table public.workspace_audit_events enable row level security;

create policy organization_memberships_select_self_or_admin
on public.organization_memberships for select to authenticated
using (
  auth_user_id = (select auth.uid())
  or (select private.has_membership_role(organization_id, array['administrator']))
);

create policy organization_membership_roles_select_self_or_admin
on public.organization_membership_roles for select to authenticated
using (
  exists (
    select 1 from public.organization_memberships m
    where m.organization_id = organization_membership_roles.organization_id
      and m.id = organization_membership_roles.membership_id
      and m.auth_user_id = (select auth.uid())
  )
  or (select private.has_membership_role(organization_id, array['administrator']))
);

create policy organization_module_entitlements_select_member
on public.organization_module_entitlements for select to authenticated
using ((select private.has_approved_membership(organization_id)));

create policy workspace_audit_events_select_admin
on public.workspace_audit_events for select to authenticated
using ((select private.has_membership_role(organization_id, array['administrator'])));

revoke all on public.organization_memberships,
  public.organization_membership_roles,
  public.organization_module_entitlements,
  public.workspace_audit_events from public, anon, authenticated;
grant select on public.organization_memberships,
  public.organization_membership_roles,
  public.organization_module_entitlements,
  public.workspace_audit_events to authenticated;

create or replace function public.get_workspace_context()
returns table (
  organization_id uuid,
  organization_name text,
  organization_slug text,
  organization_timezone text,
  membership_id uuid,
  membership_status text,
  role_codes text[],
  enabled_modules text[]
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    o.id,
    o.name,
    o.slug,
    o.timezone,
    m.id,
    m.status,
    coalesce((
      select array_agg(r.role_code order by r.role_code)
      from public.organization_membership_roles r
      where r.organization_id = m.organization_id
        and r.membership_id = m.id
    ), '{}'::text[]),
    coalesce((
      select array_agg(e.module_code order by e.module_code)
      from public.organization_module_entitlements e
      where e.organization_id = m.organization_id
        and e.enabled
        and e.effective_at <= now()
        and (e.expires_at is null or e.expires_at > now())
    ), '{}'::text[])
  from public.organization_memberships m
  join public.organizations o on o.id = m.organization_id
  where m.auth_user_id = (select auth.uid())
    and m.status in ('approved', 'pending', 'invited')
    and o.active
  order by o.name, o.id
$$;

revoke all on function public.get_workspace_context() from public, anon, authenticated;
grant execute on function public.get_workspace_context() to authenticated;

create or replace function public.provision_saas_workspace(
  p_name text,
  p_slug text,
  p_timezone text,
  p_enabled_modules text[],
  p_owner_auth_user_id uuid
)
returns public.organizations
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_organization public.organizations%rowtype;
  v_membership_id uuid;
  v_module text;
begin
  if (select auth.jwt() ->> 'role') is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'platform_operator_required';
  end if;
  if nullif(btrim(coalesce(p_name, '')), '') is null
     or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception using errcode = 'P0001', message = 'workspace_identity_invalid';
  end if;
  if not exists (select 1 from auth.users where id = p_owner_auth_user_id) then
    raise exception using errcode = 'P0001', message = 'workspace_owner_not_found';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception using errcode = 'P0001', message = 'workspace_timezone_invalid';
  end if;
  if coalesce(cardinality(p_enabled_modules), 0) = 0
     or exists (
       select 1 from unnest(p_enabled_modules) value
       where value not in ('league', 'umpire')
     ) then
    raise exception using errcode = 'P0001', message = 'workspace_modules_invalid';
  end if;

  insert into public.organizations (name, slug, timezone)
  values (btrim(p_name), p_slug, p_timezone)
  returning * into v_organization;

  insert into public.organization_memberships (
    organization_id, auth_user_id, status, approved_at
  ) values (
    v_organization.id, p_owner_auth_user_id, 'approved', now()
  ) returning id into v_membership_id;

  insert into public.organization_membership_roles (
    organization_id, membership_id, role_code
  ) values (
    v_organization.id, v_membership_id, 'administrator'
  );

  foreach v_module in array p_enabled_modules loop
    insert into public.organization_module_entitlements (
      organization_id, module_code, enabled, entitlement_source
    ) values (
      v_organization.id, v_module, true, 'platform_operator'
    );
  end loop;

  insert into public.workspace_audit_events (
    organization_id, actor_auth_user_id, action, entity_type, entity_id, metadata
  ) values (
    v_organization.id,
    (select auth.uid()),
    'workspace.provisioned',
    'organization',
    v_organization.id,
    jsonb_build_object('modules', p_enabled_modules, 'owner_auth_user_id', p_owner_auth_user_id)
  );

  return v_organization;
end;
$$;

revoke all on function public.provision_saas_workspace(text, text, text, text[], uuid) from public, anon, authenticated;
grant execute on function public.provision_saas_workspace(text, text, text, text[], uuid) to service_role;

create or replace function private.enforce_league_module_entitlement()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_organization_id uuid := case when tg_op = 'DELETE' then old.organization_id else new.organization_id end;
begin
  if (select auth.uid()) is not null
     and not private.organization_module_enabled(v_organization_id, 'league') then
    raise exception using errcode = '42501', message = 'league_module_not_enabled';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.enforce_league_module_entitlement() from public;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'organization_sports', 'leagues', 'divisions', 'teams',
    'locations', 'fields', 'field_availability_rules',
    'field_closures', 'field_reservations'
  ] loop
    execute format(
      'create trigger %I_require_league_module before insert or update or delete on public.%I for each row execute function private.enforce_league_module_entitlement()',
      v_table,
      v_table
    );
  end loop;
end;
$$;

comment on table public.organization_memberships is
  'Independent user membership in a Slate customer workspace. Browser-selected context never grants access.';
comment on table public.organization_module_entitlements is
  'Backend-enforced League and Umpire module entitlements. Billing synchronization is intentionally deferred.';
comment on function public.provision_saas_workspace(text, text, text, text[], uuid) is
  'Trusted service-role tenant onboarding only; never grant to browser roles.';

