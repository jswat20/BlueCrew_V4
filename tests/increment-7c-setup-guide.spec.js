import { test, expect } from "./fixtures/supabase-auth.fixture.js";

const administrator = {
  id: "profile-admin-setup",
  auth_user_id: "auth-admin-setup",
  organization_id: "organization-1",
  first_name: "Setup",
  last_name: "Administrator",
  email: "setup-admin@example.test",
  phone: "",
  role: "administrator",
  status: "approved",
  communication_preferences: {}
};

const leagueCatalog = {
  organizationSports: [{ id: "program-1", organization_id: "organization-1", sport_code: "softball", display_name: "Softball", active: true }],
  leagues: [{ id: "league-1", organization_id: "organization-1", organization_sport_id: "program-1", name: "Spring League", active: true }],
  seasons: [{ id: "season-1", organization_id: "organization-1", name: "Spring 2027", starts_on: "2027-03-01", ends_on: "2027-06-01", active: true }],
  divisions: [{ id: "division-1", organization_id: "organization-1", league_id: "league-1", season_id: "season-1", name: "12U", code: "12U", active: true }],
  teams: [
    { id: "team-1", organization_id: "organization-1", division_id: "division-1", season_id: "season-1", name: "Blue", active: true },
    { id: "team-2", organization_id: "organization-1", division_id: "division-1", season_id: "season-1", name: "Gold", active: true }
  ],
  locations: [{ id: "location-1", organization_id: "organization-1", name: "North Complex", timezone: "America/New_York", status: "operational" }],
  fields: [{ id: "field-1", organization_id: "organization-1", location_id: "location-1", name: "Field 1", status: "operational" }]
};

test.describe("module-aware workspace setup", () => {
  test.use({
    supabaseScenario: {
      initialSession: true,
      profile: administrator,
      workspaces: [{
        organization_id: "organization-1", organization_name: "Synthetic Softball", organization_slug: "synthetic-softball",
        organization_timezone: "America/New_York", membership_id: "membership-1", profile_id: administrator.id,
        membership_status: "approved", role_code: "administrator", enabled_modules: ["league"], profile: administrator
      }],
      ...leagueCatalog
    }
  });

  test("derives progress from tenant data and only shows enabled modules", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    const guide = page.getByTestId("workspace-setup-guide");
    await expect(guide).toContainText("Configure Synthetic Softball");
    await expect(guide).toContainText("4 of 5 steps complete");
    await expect(guide).toContainText("League Management");
    await expect(guide).not.toContainText("Tournament Management");
    await expect(page.getByTestId("setup-task-league-schedule")).not.toHaveClass(/is-complete/);
    await expect(page.getByTestId("setup-task-league-fields")).toHaveClass(/is-complete/);
  });

  test("can hide and revisit the tenant-qualified guide", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    await expect(page.getByTestId("workspace-setup-guide")).toBeVisible();
    await page.getByRole("button", { name: "Hide guide" }).click();
    await expect(page.getByTestId("workspace-setup-revisit")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("workspace-setup-revisit")).toBeVisible();
    await page.getByRole("button", { name: "Show setup guide" }).click();
    await expect(page.getByTestId("workspace-setup-guide")).toBeVisible();
  });

  test("opens the existing configuration workflow from a setup step", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    await page.getByTestId("setup-task-league-program").getByRole("button").click();
    await expect(page.getByTestId("page-settings")).toBeVisible();
    await expect(page.getByTestId("settings-competition-catalog")).toBeVisible();
  });

  test("remains usable at a 360 pixel mobile viewport", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    await page.setViewportSize({ width: 360, height: 780 });
    await expect(page.getByTestId("workspace-setup-guide")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
    const firstAction = page.getByTestId("setup-task-league-program").getByRole("button");
    await expect(firstAction).toBeVisible();
    expect((await firstAction.boundingBox()).height).toBeGreaterThanOrEqual(44);
  });
});
