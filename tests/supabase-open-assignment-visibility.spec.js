import { readFileSync } from "node:fs";
import { test, expect } from "./fixtures/supabase-auth.fixture.js";

const migration = readFileSync(
  "supabase/migrations/202608070006_open_assignment_read_visibility.sql",
  "utf8"
);
const policySql = migration.split("-- Keep the authoritative command")[0];

test("open-assignment policy is read-only and organization scoped", () => {
  expect(policySql).toContain("for select");
  expect(policySql).not.toMatch(/for\s+(insert|update|delete|all)/i);
  expect(policySql).toContain("organization_id = public.current_organization_id()");
  expect(policySql).toContain("game.organization_id = game_assignments.organization_id");
});

test("open-assignment policy exposes only active-umpire claim candidates", () => {
  expect(migration).toContain("public.current_account_role() = 'umpire'");
  expect(migration).toContain("public.is_approved_account()");
  expect(migration).toContain("crew.active = true");
  expect(migration).toContain("status = 'needs_assignment'");
  expect(migration).toContain("assigned_crew_member_id is null");
  expect(migration).toContain("locked = false");
});

const profile = { id: "profile-open", auth_user_id: "auth-open", organization_id: "organization-1", first_name: "Open", last_name: "Umpire", email: "open@example.com", role: "umpire", status: "approved", communication_preferences: {} };
const crew = { id: "crew-open", organization_id: "organization-1", profile_id: profile.id, first_name: "Open", last_name: "Umpire", email: profile.email, active: true, eligible_levels: ["6U", "8U", "10U"], preferences: {} };
const location = { id: "location-open", organization_id: "organization-1", name: "Lake Shore Athletic Complex", active: true };
const field = { id: "field-open", organization_id: "organization-1", location_id: location.id, name: "Field 1", active: true };
const levels = ["6U", "8U", "10U", "12U", "14U", "16U"];
const games = levels.map((level, index) => ({ id: `game-open-${index}`, organization_id: "organization-1", season_id: "season-1", location_id: location.id, field_id: field.id, legacy_game_id: `LSYB-${String(index + 1).padStart(3, "0")}`, game_date: "2099-08-12", game_time: "18:00:00", timezone: "America/New_York", home_team: `Home ${level}`, away_team: `Away ${level}`, level, game_type: "single", lifecycle_status: "scheduled", review: {}, report: {}, source_metadata: {} }));
const assignments = games.map((game, index) => ({ id: `assignment-open-${index}`, organization_id: "organization-1", game_id: game.id, position: "Plate", status: "needs_assignment", assigned_crew_member_id: null, locked: false }));

test.describe("hosted open-assignment hydration", () => {
  test.use({ supabaseScenario: { profile, crewId: crew.id, crewMembers: [crew], organization: { id: "organization-1", name: "Lake Shore", settings: { level_aliases: {} } }, locations: [location], fields: [field], games, assignments } });

  test("hydrates open slots before portal eligibility filtering", async ({ supabaseAuthApp }) => {
    const result = await supabaseAuthApp.page.evaluate(async () => {
      await loginService.loginWithPassword("open@example.com", "password1234");
      return {
        repositoryCount: (await supabaseSharedRepository.getGameAssignments()).data.length,
        hydratedCount: gameService.getAll().reduce((total, game) => total + game.assignments.length, 0),
        claimableLevels: portalService.getClaimableGames().map(game => game.level).sort()
      };
    });
    expect(result).toEqual({ repositoryCount: 6, hydratedCount: 6, claimableLevels: ["10U", "6U", "8U"] });
  });

  test("claim submission still uses the RPC boundary", async ({ supabaseAuthApp }) => {
    const result = await supabaseAuthApp.page.evaluate(async () => {
      await loginService.loginWithPassword("open@example.com", "password1234");
      return portalService.claimGame("game-open-0");
    });
    const calls = await supabaseAuthApp.calls();
    expect(result.success).toBe(true);
    expect(calls.filter(call => call.operation === "rpc").map(call => call.name)).toContain("submit_assignment_claim");
  });
});
