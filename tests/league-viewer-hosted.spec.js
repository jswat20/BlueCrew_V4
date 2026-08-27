import { test, expect } from "./fixtures/supabase-auth.fixture.js";

test.describe("hosted League Viewer lifecycle", () => {
  test.use({
    supabaseScenario: {
      profile: {
        id: "profile-viewer-1",
        auth_user_id: "auth-viewer-1",
        organization_id: "organization-1",
        first_name: "League",
        last_name: "Viewer",
        email: "viewer@example.test",
        role: "league_viewer",
        status: "approved",
        communication_preferences: {}
      },
      crewId: null,
      crewMembers: [{
        id: "crew-visible-1", organization_id: "organization-1", profile_id: "profile-umpire-visible",
        first_name: "Visible", last_name: "Umpire", email: "visible@example.test", phone: "4105550100",
        active: false, eligible_levels: ["8U"], preferences: {}, notes: "Leadership note"
      }],
      organizationProfiles: [{
        id: "profile-umpire-visible", organization_id: "organization-1", role: "umpire", status: "approved",
        first_name: "Visible", last_name: "Umpire", email: "visible@example.test", phone: "4105550100",
        home_phone: "4105550101", address: "123 League Way", emergency_contact: "Emergency Person",
        emergency_contact_phone: "4105550102", contact_preference: "call", official_history: [{ year: 2026, label: "Umpire" }],
        admin_notes: "Leadership note", communication_preferences: {}, photo_path: "auth-visible/profile"
      }]
    }
  });

  test("hydrates without an umpire crew link and opens scoped read-only pages", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    const login = await page.evaluate(() => loginService.loginWithPassword("viewer@example.test", "password"));
    expect(login.success).toBe(true);
    expect(await page.evaluate(() => authorizationService.currentRole())).toBe("league_viewer");
    await page.evaluate(() => renderPage("dashboard"));
    await expect(page.getByTestId("schedule-page")).toBeVisible();
    expect(await page.evaluate(() => document.body.dataset.page)).toBe("schedule");
    await page.evaluate(() => renderPage("schedule"));
    await expect(page.getByTestId("schedule-page")).toBeVisible();
    await page.evaluate(() => renderPage("crew"));
    await expect(page.getByTestId("league-viewer-crew-crew-visible-1")).toBeVisible();
    await page.getByTestId("league-viewer-crew-crew-visible-1").click();
    await expect(page.getByTestId("crew-card-emergency-contact")).toContainText("Emergency Person");
    await expect(page.getByText("123 League Way")).toBeVisible();
    await expect(page.getByTestId("crew-card-edit")).toHaveCount(0);
  });
});
