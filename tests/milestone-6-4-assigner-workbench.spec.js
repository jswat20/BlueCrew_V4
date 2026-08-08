import { expect, test } from "@playwright/test";

test.describe("Milestone 6.4 Assigner Workbench polish", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      authService.loginAsAdmin();
      notificationService.clearAll();
    });
  });

  test("notifications are collapsed by default and retain a compact accessible header", async ({ page }) => {
    await page.evaluate(() => {
      notificationService.create({ title: "Operational notice", message: "Ready for review.", createdAt: "2026-08-08T18:00:00" });
      navigateTo("assigner-workbench");
    });

    const card = page.getByTestId("workbench-notifications");
    await expect(card.getByTestId("workbench-notifications-count")).toHaveText("1");
    await expect(card.getByTestId("workbench-notification-item")).toHaveCount(0);
    await expect(card.getByTestId("workbench-toggle-notifications")).toHaveAttribute("aria-expanded", "false");
    await expect(card.locator(".workbench-section-header")).toHaveCSS("display", "flex");

    await card.getByTestId("workbench-toggle-notifications").click();
    await expect(card.getByTestId("workbench-notification-item")).toContainText("6:00 PM");
    await expect(card.getByTestId("workbench-toggle-notifications")).toHaveAttribute("aria-expanded", "true");

    await card.getByTestId("workbench-open-notifications").click();
    await expect(page.getByTestId("notifications")).toBeVisible();
    await expect.poll(() => page.evaluate(() => currentPageContext)).toEqual({ origin: "assigner-workbench", returnPage: "assigner-workbench" });
  });

  test("needs assignment uses the compact operational row and opens Game Hub", async ({ page }) => {
    await page.evaluate(() => {
      gameService.create({
        date: "2099-08-08",
        time: "18:00",
        level: "12U",
        locationComplex: "North Complex",
        locationField: "Field 3",
        awayTeam: "Visitors",
        homeTeam: "Home",
        gameType: "single"
      });
      navigateTo("assigner-workbench");
    });

    const row = page.getByTestId("workbench-needs-assignment-item").filter({ hasText: "Visitors @ Home" }).first();
    await expect(row).toContainText("08/08/99");
    await expect(row).toContainText("6:00 PM");
    await expect(row).toContainText("12U - North Complex - Field 3");
    await expect(row).toContainText("0/1 Staffed");
    await expect(row).not.toContainText("Work next");
    await expect(row.locator(".workbench-mini-game-crew")).toHaveCSS("text-align", "right");
    await row.click();
    await expect(page.getByTestId("workbench-game-dialog")).toBeVisible();
  });

  test("all Workbench View All actions use the shared primary treatment", async ({ page }) => {
    await page.evaluate(() => navigateTo("assigner-workbench"));
    const buttons = page.locator('[data-testid="assigner-workbench"] .button-view-all');
    expect(await buttons.count()).toBeGreaterThan(1);
    for (const button of await buttons.all()) {
      await expect(button).toHaveClass(/button-primary/);
      await expect(button).toHaveClass(/button-view-all/);
    }
  });

  test("notification destinations are role-aware without widening page access", async ({ page }) => {
    const result = await page.evaluate(() => {
      const notification = {
        type: "game-available",
        relatedId: "game-42",
        destination: { page: "claim-games", context: { highlightId: "game-42" } }
      };
      const crossOrganization = { ...notification, organizationId: "other-org" };
      const account = loginService.getCurrentAccount() || authService.getCurrentUser();
      if (account) account.organizationId = "current-org";
      return {
        administrator: authorizationService.resolveNotificationDestination(notification, "administrator"),
        assigner: authorizationService.resolveNotificationDestination(notification, "assigner"),
        umpireAdminOnly: authorizationService.resolveNotificationDestination({ destination: { page: "accounts", context: {} } }, "umpire"),
        umpireOwn: authorizationService.resolveNotificationDestination(notification, "umpire"),
        crossOrganization: authorizationService.resolveNotificationDestination(crossOrganization, "administrator")
      };
    });

    expect(result.administrator).toEqual({ page: "game-hub", context: { gameId: "game-42", origin: "notifications", returnPage: "notifications" } });
    expect(result.assigner).toEqual(result.administrator);
    expect(result.umpireAdminOnly).toBeNull();
    expect(result.umpireOwn).toEqual({ page: "claim-games", context: { highlightId: "game-42" } });
    expect(result.crossOrganization).toBeNull();
  });

  test("administrator opens an admin-visible game notification without Access Denied", async ({ page }) => {
    await page.evaluate(() => {
      const game = gameService.create({
        date: "2099-08-09",
        time: "19:00",
        level: "12U",
        locationComplex: "Central Complex",
        locationField: "Field 1",
        awayTeam: "Away",
        homeTeam: "Home",
        gameType: "single"
      }).data;
      notificationService.create({
        type: "game-available",
        title: "New Game Added",
        message: "A game was added.",
        relatedId: game.id,
        destination: { page: "claim-games", context: { highlightId: game.id } }
      });
      navigateTo("assigner-workbench");
    });

    await page.getByTestId("workbench-toggle-notifications").click();
    await page.getByTestId("workbench-notification-item").filter({ hasText: "New Game Added" }).click();
    await expect(page.locator("body")).toHaveAttribute("data-page", "game-hub");
    await expect(page.getByTestId("access-denied")).toHaveCount(0);
    await expect(page.getByTestId("game-hub")).toBeVisible();
  });
});
