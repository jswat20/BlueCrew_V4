import { test, expect } from "./fixtures/supabase-auth.fixture.js";

const admin = { id: "schedule-admin", auth_user_id: "schedule-admin-auth", organization_id: "organization-1", first_name: "Schedule", last_name: "Admin", email: "schedule@example.com", role: "administrator", status: "approved", communication_preferences: {} };
const game = { id: "hosted-schedule-game", organization_id: "organization-1", season_id: "season-1", location_id: "lake-shore", field_id: "field-3", game_date: "2099-08-12", game_time: "18:00:00", timezone: "America/New_York", home_team: "Hosted Home", away_team: "Hosted Away", level: "16U", game_type: "single", lifecycle_status: "scheduled", review: {}, report: {}, source_metadata: {} };
test.use({ supabaseScenario: {
  profile: admin, crewId: null,
  organization: { id: "organization-1", name: "Lake Shore Baseball", slug: "lake-shore", timezone: "America/New_York", settings: { level_aliases: { "16U": "Colt" } } },
  locations: [{ id: "lake-shore", organization_id: "organization-1", name: "Lake Shore Athletic Complex", address: "", active: true }],
  fields: [{ id: "field-3", organization_id: "organization-1", location_id: "lake-shore", name: "Field 3", active: true }],
  games: [game], assignments: [{ id: "hosted-assignment", organization_id: "organization-1", game_id: game.id, position: "Plate", status: "needs_assignment", assigned_crew_member_id: null, locked: false }]
} });

test("hosted All Games displays the authoritative complex and canonical level alias", async ({ supabaseAuthApp }) => {
  const { page } = supabaseAuthApp;
  await page.evaluate(async () => { await loginService.loginWithPassword("schedule@example.com", "password"); currentScheduleView = "all"; renderPage("schedule"); });
  const row = page.getByTestId("game-row-hosted-schedule-game");
  await expect(row.locator(".schedule-column-complex")).toHaveText("Lake Shore Athletic Complex");
  await expect(row.locator(".schedule-column-time")).toHaveText("6:00 PM");
  await expect(row).toContainText("16U - Colt");
});
