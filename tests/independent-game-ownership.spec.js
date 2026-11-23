const { test, expect } = require("@playwright/test");
const fs = require("fs");

const migration = fs.readFileSync(
  "supabase/migrations/20261123011002_independent_game_ownership.sql",
  "utf8"
);

test.describe("Increment 4C independent game ownership", () => {
  test("backfills legacy games into an immutable Officials domain", () => {
    expect(migration).toContain("game_domain text not null default 'officials'");
    expect(migration).toContain("check (game_domain in ('league', 'officials', 'tournament'))");
    expect(migration).toContain("message = 'game_domain_immutable'");
  });

  test("enforces owning-module entitlements and active workspace in the database", () => {
    expect(migration).toContain("private.organization_module_enabled(v_organization_id, private.game_domain_module(v_domain))");
    expect(migration).toContain("v_organization_id <> v_active_organization_id");
    expect(migration).toContain("message = 'game_domain_module_not_enabled'");
    expect(migration).toContain("create trigger games_require_domain_entitlement");
  });

  test("keeps officials staffing and reservation ownership boundaries explicit", () => {
    expect(migration).toContain("create trigger game_assignments_require_officials_domain");
    expect(migration).toContain("message = 'officials_game_required'");
    expect(migration).toContain("create trigger field_reservations_require_schedulable_game_domain");
    expect(migration).toContain("v_game_domain not in ('league', 'tournament')");
  });

  test("supports independent games without mandatory season or facility records", () => {
    expect(migration).toContain("alter table public.games alter column season_id drop not null");
    expect(migration).toContain("alter table public.games alter column location_id drop not null");
    expect(migration).toContain("alter table public.games alter column field_id drop not null");
    expect(migration).toContain("create or replace function public.create_domain_game");
  });

  test("legacy hosted imports remain explicitly Officials-owned", () => {
    expect(migration).toContain("if not private.organization_module_enabled(v_org,'umpire')");
    expect(migration).toContain("values(v_org,'officials',v_season");
  });
});
