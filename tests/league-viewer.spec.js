const { test, expect } = require("@playwright/test");

async function becomeLeagueViewer(page) {
  await page.evaluate(() => {
    authService.useAuthenticatedAccount({
      id: "viewer-profile",
      role: "league_viewer",
      firstName: "League",
      lastName: "Viewer",
      organizationId: "organization-1"
    });
    loginService.isLoggedIn = () => true;
    refreshNavigationAuthorization();
  });
}

test.describe("League Viewer client authorization", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await becomeLeagueViewer(page);
  });

  test("has an explicit read-only role and label", async ({ page }) => {
    const result = await page.evaluate(() => ({
      label: authenticatedIdentityService.roleLabel("league_viewer"),
      schedule: authorizationService.canView("schedule", "league_viewer"),
      crew: authorizationService.canView("crew", "league_viewer"),
      dashboard: authorizationService.canView("dashboard", "league_viewer"),
      edit: authorizationService.canEditSchedule("league_viewer"),
      assign: authorizationService.canAssignGames("league_viewer"),
      manageCrew: authorizationService.canManageCrew("league_viewer")
    }));
    expect(result).toEqual({ label: "League Viewer", schedule: true, crew: true, dashboard: false, edit: false, assign: false, manageCrew: false });
  });

  test("shows only Schedule, Crew, and Logout destinations", async ({ page }) => {
    await expect(page.getByTestId("nav-schedule")).toBeVisible();
    await expect(page.getByTestId("nav-crew")).toBeVisible();
    await expect(page.getByTestId("nav-logout")).toBeVisible();
    for (const id of ["nav-dashboard", "nav-operations-center", "nav-assigner-workbench", "nav-accounts", "nav-settings", "nav-admin", "nav-claim-games", "nav-my-schedule", "nav-notifications", "nav-profile", "nav-rules-and-regulations"]) {
      await expect(page.getByTestId(id)).toBeHidden();
    }
  });

  test("renders Schedule without mutation controls", async ({ page }) => {
    await page.evaluate(() => renderPage("schedule"));
    await expect(page.getByTestId("schedule-page")).toBeVisible();
    await expect(page.getByTestId("view-daily")).toBeVisible();
    await expect(page.getByTestId("view-all-games")).toBeVisible();
    await expect(page.getByTestId("add-game")).toHaveCount(0);
    await expect(page.getByTestId("import-schedule")).toHaveCount(0);
    await expect(page.locator('[data-testid^="edit-game-"]')).toHaveCount(0);
    await expect(page.locator('[data-testid^="game-details-"]')).toHaveCount(0);
  });

  test("renders a read-only Crew directory and cards", async ({ page }) => {
    await page.evaluate(() => renderPage("crew"));
    await expect(page.getByTestId("league-viewer-crew")).toBeVisible();
    await expect(page.getByText("+ Add Crew Member")).toHaveCount(0);
    const firstCard = page.locator('[data-testid^="league-viewer-crew-"]').first();
    await expect(firstCard).toBeVisible();
    await firstCard.click();
    await expect(page.getByTestId("crew-card-dialog")).toBeVisible();
    await expect(page.getByTestId("crew-card-flipper")).not.toHaveClass(/is-flipped/);
    await expect(page.getByTestId("crew-card-view-information")).toBeVisible();
    await page.getByTestId("crew-card-view-information").click();
    await expect(page.getByTestId("crew-card-flipper")).toHaveClass(/is-flipped/);
    await page.getByTestId("crew-card-view-front").click();
    await expect(page.getByTestId("crew-card-flipper")).not.toHaveClass(/is-flipped/);
    await expect(page.getByTestId("crew-card-edit")).toHaveCount(0);
    await expect(page.getByTestId("crew-card-password-reset")).toHaveCount(0);
  });

  test("keeps the read-only Crew Card contained on a mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => renderPage("crew"));
    await page.locator('[data-testid^="league-viewer-crew-"]').first().click();
    const dialog = page.getByTestId("crew-card-dialog");
    await expect(dialog).toBeVisible();
    await page.getByTestId("crew-card-view-information").click();
    await expect(page.getByTestId("crew-card-back")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await expect(page.getByTestId("crew-card-edit")).toHaveCount(0);
  });

  test("denies direct administrative routes and mutation entry points", async ({ page }) => {
    const result = await page.evaluate(async () => {
      renderPage("accounts");
      const accessDenied = document.body.innerText.includes("You do not have permission");
      return {
        accessDenied,
        editor: openGameEditor(),
        assignment: openAssignmentDrawer(gameService.getAll()[0]?.id),
        createCrew: await crewService.create({ firstName: "No", lastName: "Write" }),
        updateCrew: await crewService.updateMember(crewService.getAll()[0]?.id, { active: false })
      };
    });
    expect(result.accessDenied).toBe(true);
    expect(result.editor).toBe(false);
    expect(result.assignment).toBe(false);
    expect(result.createCrew.success).toBe(false);
    expect(result.updateCrew.success).toBe(false);
  });

  test("unknown roles still fail closed to umpire capabilities", async ({ page }) => {
    expect(await page.evaluate(() => ({
      schedule: authorizationService.canView("schedule", "unexpected-role"),
      crew: authorizationService.canView("crew", "unexpected-role"),
      claim: authorizationService.canClaimGames("unexpected-role")
    }))).toEqual({ schedule: false, crew: false, claim: true });
  });
});
