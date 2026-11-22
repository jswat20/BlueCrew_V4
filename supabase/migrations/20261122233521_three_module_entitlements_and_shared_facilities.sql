-- Three independently purchasable modules and workspace-owned facilities.
-- This migration deliberately does not add tournament domain tables: it first
-- removes the incorrect League dependency from shared infrastructure.

alter table public.organization_module_entitlements
  drop constraint organization_module_entitlements_module_code_check;

alter table public.organization_module_entitlements
  add constraint organization_module_entitlements_module_code_check
  check (module_code in ('league', 'umpire', 'tournament'));

insert into public.organization_module_entitlements (
  organization_id, module_code, enabled, entitlement_source
)
select o.id, 'tournament', true, 'legacy_backfill'
from public.organizations o
on conflict (organization_id, module_code) do nothing;

create or replace function private.workspace_has_any_operational_module(
  p_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select private.organization_module_enabled(p_organization_id, 'league')
      or private.organization_module_enabled(p_organization_id, 'umpire')
      or private.organization_module_enabled(p_organization_id, 'tournament')
$$;

revoke all on function private.workspace_has_any_operational_module(uuid) from public, anon;
grant execute on function private.workspace_has_any_operational_module(uuid) to authenticated, service_role;

create or replace function private.enforce_shared_facility_entitlement()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_organization_id uuid := case when tg_op = 'DELETE' then old.organization_id else new.organization_id end;
begin
  if (select auth.uid()) is not null
     and not private.workspace_has_any_operational_module(v_organization_id) then
    raise exception using errcode = '42501', message = 'operational_module_not_enabled';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.enforce_shared_facility_entitlement() from public, anon, authenticated;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'organization_sports', 'locations', 'fields',
    'field_availability_rules', 'field_closures', 'field_reservations'
  ] loop
    execute format('drop trigger if exists %I_require_league_module on public.%I', v_table, v_table);
    execute format(
      'create trigger %I_require_operational_module before insert or update or delete on public.%I for each row execute function private.enforce_shared_facility_entitlement()',
      v_table,
      v_table
    );
  end loop;
end;
$$;

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
     or cardinality(p_enabled_modules) <> cardinality(array(select distinct value from unnest(p_enabled_modules) value))
     or exists (
       select 1 from unnest(p_enabled_modules) value
       where value not in ('league', 'umpire', 'tournament')
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

comment on table public.organization_module_entitlements is
  'Backend-enforced League, Umpire, and Tournament module entitlements. Billing synchronization is intentionally deferred.';
