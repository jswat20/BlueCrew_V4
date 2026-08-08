import { test, expect } from "./fixtures/supabase-auth.fixture.js";

const admin = { id: "admin-activity", auth_user_id: "auth-admin-activity", organization_id: "organization-1", first_name: "John", last_name: "Switala", email: "john@example.com", role: "administrator", status: "approved", communication_preferences: {} };
test.use({ supabaseScenario: {
  profile: admin,
  crewId: null,
  organization: { id: "organization-1", name: "Lake Shore Baseball", slug: "lake-shore", timezone: "America/New_York", settings: { level_aliases: { "8U": "Pinto" } } },
  activityActors: [admin],
  activities: [{ id: "hosted-activity", organization_id: "organization-1", actor_profile_id: admin.id, type: "game", action: "game_created", subject: "", object: "", message: "", metadata: { locationComplex: "Lake Shore Athletic Complex", level: "8U", date: "2026-08-12", time: "18:00" }, created_at: new Date().toISOString() }]
} });

test("hosted activity hydration preserves server-side actor attribution", async ({ supabaseAuthApp }) => {
  const { page, calls } = supabaseAuthApp;
  await page.evaluate(async () => { await loginService.loginWithPassword("john@example.com", "password"); renderPage("dashboard"); });
  const row = page.getByTestId("dashboard-assignment-activity-item");
  await expect(row.locator(".operations-log-actor")).toHaveText("Admin - John Switala");
  await expect(row.getByTestId("dashboard-assignment-activity-matchup")).toHaveText("8U - Pinto");
  await expect(row.getByTestId("dashboard-assignment-activity-action")).toContainText("6:00 PM");
  expect((await calls()).some(call => call.table === "activities" && call.operation === "select")).toBe(true);
});
