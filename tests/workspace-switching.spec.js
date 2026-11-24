import { test, expect } from "./fixtures/supabase-auth.fixture.js";

const authUserId = "auth-multi-workspace";
const adminProfile = {
  id: "profile-workspace-a", auth_user_id: authUserId, organization_id: "organization-a",
  first_name: "Synthetic", last_name: "Operator", email: "synthetic@example.test", phone: "",
  role: "administrator", status: "approved", communication_preferences: {}
};
const viewerProfile = {
  ...adminProfile, id: "profile-workspace-b", organization_id: "organization-b", role: "league_viewer"
};
const workspaces = [
  { organization_id: "organization-a", organization_name: "Synthetic League Workspace", organization_slug: "synthetic-league", organization_timezone: "America/New_York", membership_id: "membership-a", profile_id: adminProfile.id, membership_status: "approved", role_code: "administrator", enabled_modules: ["league", "facility"], profile: adminProfile, crewId: null },
  { organization_id: "organization-b", organization_name: "Synthetic Officials Workspace", organization_slug: "synthetic-officials", organization_timezone: "America/Chicago", membership_id: "membership-b", profile_id: viewerProfile.id, membership_status: "approved", role_code: "league_viewer", enabled_modules: ["umpire"], profile: viewerProfile, crewId: null }
];

test.describe("secure multi-workspace switching", () => {
  test.use({ supabaseScenario: { profile: adminProfile, workspaces, activeWorkspaceId: "", initialSession: true, organization: { id: "organization-a", name: "Synthetic League Workspace", slug: "synthetic-league", timezone: "America/New_York", settings: {} } } });

  test("requires selection, switches role and modules, and persists server context", async ({ page, supabaseAuthApp }) => {
    await page.goto("/");
    await expect(page.getByTestId("workspace-selection-page")).toBeVisible();
    await expect(page.getByTestId("workspace-option")).toHaveCount(2);

    await page.getByTestId("workspace-option").filter({ hasText: "Synthetic League Workspace" }).click();
    await expect(page.getByTestId("active-workspace-modules")).toContainText("League");
    await expect(page.locator("body")).toHaveAttribute("data-role", "administrator");

    await page.getByTestId("workspace-switcher-select").selectOption("organization-b");
    await expect(page.getByTestId("active-workspace-modules")).toHaveText("Officials");
    await expect(page.locator("body")).toHaveAttribute("data-role", "league_viewer");
    await expect.poll(() => page.evaluate(() => localStorage.getItem("__slate_fixture_active_workspace"))).toBe("organization-b");
    await page.reload();
    await expect.poll(() => page.evaluate(() => workspaceService.snapshot())).toMatchObject({ activeWorkspace: { organizationId: "organization-b" } });
    await expect(page.getByTestId("workspace-switcher-select")).toHaveValue("organization-b");
  });

  test("rejects a workspace without approved membership", async ({ page, supabaseAuthApp }) => {
    await page.goto("/");
    const result = await page.evaluate(() => supabaseSharedRepository.selectActiveWorkspace("organization-c"));
    expect(result.error?.message).toBe("workspace_membership_required");
    await expect(page.getByTestId("workspace-selection-page")).toBeVisible();
  });

  test("settings expose only controls enabled in the active workspace", async ({ page, supabaseAuthApp }) => {
    await page.goto("/");
    await page.getByTestId("workspace-option").filter({ hasText: "Synthetic League Workspace" }).click();
    await page.getByRole("button", { name: "⚙ Settings" }).click();
    await expect(page.getByTestId("settings-seasons")).toBeVisible();
    await expect(page.getByTestId("settings-competition-catalog")).toBeVisible();
    await expect(page.getByTestId("add-reservation")).toBeVisible();

    await page.getByTestId("workspace-switcher-select").selectOption("organization-b");
    const officialsSettings = await page.evaluate(() => renderSettings());
    expect(officialsSettings).toContain('data-testid="settings-locations"');
    expect(officialsSettings).not.toContain('data-testid="settings-seasons"');
    expect(officialsSettings).not.toContain('data-testid="settings-competition-catalog"');
    expect(officialsSettings).not.toContain('data-testid="add-reservation"');
  });

  test("clears facility snapshots before hydrating another workspace", async ({ page, supabaseAuthApp }) => {
    await page.goto("/");
    await page.getByTestId("workspace-option").filter({ hasText: "Synthetic League Workspace" }).click();
    await expect.poll(() => page.evaluate(() => window.BlueCrew.test.currentPage)).toBe("dashboard");
    expect(await page.evaluate(async () => { await facilityService.load(); return facilityService.snapshot().loaded; })).toBe(true);
    await page.getByTestId("workspace-switcher-select").selectOption("organization-b");
    await expect.poll(() => page.evaluate(() => workspaceService.snapshot().activeWorkspace.organizationId)).toBe("organization-b");
    await expect.poll(() => page.evaluate(() => facilityService.snapshot())).toMatchObject({
      facilities: [], fields: [], availability: [], closures: [], reservations: [], loaded: false
    });
  });

  test("hides the previous workspace while a switch is being validated", async ({ page, supabaseAuthApp }) => {
    await page.goto("/");
    await page.getByTestId("workspace-option").filter({ hasText: "Synthetic League Workspace" }).click();
    await page.getByRole("button", { name: "⚙ Settings" }).click();
    await expect(page.getByTestId("settings-competition-catalog")).toBeVisible();

    await page.evaluate(() => {
      const original = supabaseAuthService.switchWorkspace;
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      supabaseAuthService.switchWorkspace = async organizationId => {
        await gate;
        supabaseAuthService.switchWorkspace = original;
        return original(organizationId);
      };
      window.__releaseWorkspaceSwitch = release;
    });
    await page.getByTestId("workspace-switcher-select").selectOption("organization-b");
    await expect(page.getByTestId("session-restoring")).toBeVisible();
    await expect(page.getByTestId("settings-competition-catalog")).toHaveCount(0);
    await page.evaluate(() => window.__releaseWorkspaceSwitch());
    await expect(page.getByTestId("active-workspace-modules")).toHaveText("Officials");
    await expect(page.locator("body")).toHaveAttribute("data-role", "league_viewer");
  });
});
