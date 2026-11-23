const { test, expect } = require("@playwright/test");
const { readFileSync } = require("node:fs");

const migration = readFileSync(
  "supabase/migrations/20261122234858_four_modules_and_sport_neutral_resources.sql",
  "utf8"
);
const settings = readFileSync("components/settings.js", "utf8");
const repository = readFileSync("js/repositories/supabaseSharedRepository.js", "utf8");

test("four independent modules are accepted by trusted workspace onboarding", () => {
  expect(migration).toContain("module_code in ('league', 'umpire', 'tournament', 'facility')");
  expect(migration).toContain("value not in ('league','umpire','tournament','facility')");
  expect(migration).toContain("select o.id, 'facility', true, 'legacy_backfill'");
  for (const label of ["League Management", "Officials Management", "Tournament Management", "Facility Scheduling"]) {
    expect(settings).toContain(label);
  }
});

test("directory and reservation entitlements remain distinct", () => {
  expect(migration).toContain("private.workspace_has_any_operational_module");
  expect(migration).toContain("private.workspace_can_manage_reservations");
  expect(migration).toContain("organization_module_enabled(p_organization_id, 'facility')");
  expect(migration).toContain("reservation_module_not_enabled");
  const reservationHelper = migration.slice(
    migration.indexOf("create or replace function private.workspace_can_manage_reservations"),
    migration.indexOf("revoke all on function private.workspace_has_any_operational_module")
  );
  expect(reservationHelper).toContain("'league'");
  expect(reservationHelper).toContain("'tournament'");
  expect(reservationHelper).toContain("'facility'");
  expect(reservationHelper).not.toContain("'umpire'");
});

test("legacy fields become typed resources without changing identifiers", () => {
  expect(migration).toContain("alter table public.fields");
  expect(migration).toContain("add column resource_type text not null default 'field'");
  expect(migration).toContain("add column resource_details jsonb not null default '{}'::jsonb");
  for (const type of ["baseball_field", "softball_field", "basketball_court", "tennis_court", "pickleball_court", "racquetball_court", "hockey_rink", "gym", "room", "other"]) {
    expect(migration).toContain(`'${type}'`);
  }
  expect(migration).not.toContain("drop table public.fields");
});

test("hosted facility editor creates sport-neutral resources", () => {
  expect(settings).toContain("Bookable resource");
  expect(settings).toContain('name="resourceType"');
  expect(settings).toContain("Add Resource");
  expect(settings).toContain("Resource reservation");
  expect(repository).toContain('db.rpc("create_facility_resource"');
  expect(repository).toContain('db.rpc("update_facility_resource"');
  expect(repository).toContain("resource_type,resource_details");
});
