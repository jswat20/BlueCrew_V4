const { test, expect } = require("@playwright/test");
const { readFileSync } = require("node:fs");

const migration = readFileSync(
  "supabase/migrations/20261122230517_saas_workspace_memberships_and_entitlements.sql",
  "utf8"
);
const settingsComponent = readFileSync("components/settings.js", "utf8");
const initialSchema = readFileSync("supabase/migrations/202608040001_initial_schema.sql", "utf8");

test("SaaS tenant foundation models independent memberships, roles, and modules", () => {
  for (const table of [
    "organization_memberships",
    "organization_membership_roles",
    "organization_module_entitlements",
    "workspace_audit_events"
  ]) {
    expect(migration).toContain(`create table public.${table}`);
    expect(migration).toContain(`alter table public.${table} enable row level security`);
  }
  expect(migration).toContain("unique (organization_id, auth_user_id)");
  expect(migration).toContain("primary key (organization_id, membership_id, role_code)");
  expect(migration).toContain("module_code in ('league', 'umpire')");
});

test("legacy workspaces are backfilled as Complete Suite without changing profile authority", () => {
  expect(migration).toContain("from public.profiles p");
  expect(migration).toContain("cross join (values ('league'), ('umpire')) modules(module_code)");
  expect(migration).toContain("'legacy_backfill'");
  expect(migration).not.toContain("drop constraint profiles_auth_user_id_key");
  expect(migration).not.toContain("create or replace function public.current_organization_id");
});

test("tenant onboarding is trusted, atomic, and unavailable to browser roles", () => {
  expect(migration).toContain("create or replace function public.provision_saas_workspace");
  expect(migration).toContain("auth.jwt() ->> 'role'");
  expect(migration).toContain("platform_operator_required");
  expect(migration).toContain("workspace.provisioned");
  expect(migration).toContain("grant execute on function public.provision_saas_workspace(text, text, text, text[], uuid) to service_role");
  expect(migration).toContain("from public, anon, authenticated");
  expect(migration).not.toContain("grant execute on function public.provision_saas_workspace(text, text, text, text[], uuid) to authenticated");
});

test("membership and entitlement mutations fail closed for browser roles", () => {
  expect(migration).toContain("revoke all on public.organization_memberships");
  expect(migration).toContain("public.organization_module_entitlements");
  expect(migration).toContain("organization_memberships_select_self_or_admin");
  expect(migration).toContain("workspace_audit_events_select_admin");
  expect(migration).toContain("from public, anon, authenticated");
  expect(migration).toContain("public.workspace_audit_events to authenticated");
});

test("accepted League features enforce module entitlement in the backend", () => {
  expect(migration).toContain("private.enforce_league_module_entitlement");
  expect(migration).toContain("league_module_not_enabled");
  for (const table of [
    "organization_sports", "leagues", "divisions", "teams",
    "locations", "fields", "field_availability_rules",
    "field_closures", "field_reservations"
  ]) {
    expect(migration).toContain(`'${table}'`);
  }
});

test("workspace UI displays database-provided roles and enabled modules", () => {
  expect(settingsComponent).toContain('data-testid="settings-workspace"');
  expect(settingsComponent).toContain('data-testid="workspace-membership"');
  expect(settingsComponent).toContain('data-testid="workspace-module"');
  expect(settingsComponent).toContain("getWorkspaceContext");
  expect(settingsComponent).toContain("League Scheduling");
  expect(settingsComponent).toContain("Umpire Management");
});

test("legacy games remain a documented module-separation blocker", () => {
  const games = initialSchema.slice(
    initialSchema.indexOf("create table public.games"),
    initialSchema.indexOf("create table public.game_assignments")
  );
  expect(games).toContain("season_id uuid not null");
  expect(games).toContain("location_id uuid not null");
  expect(games).toContain("field_id uuid not null");
});

