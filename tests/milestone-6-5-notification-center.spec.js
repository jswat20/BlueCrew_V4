import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function seedNotificationCenter(page, role = "administrator") {
  return page.evaluate(selectedRole => {
    notificationService.clearAll();
    uiStateService.clearSelections();
    selectedRole === "umpire" ? authService.loginAsUmpire() : authService.loginAsAdmin();

    const game = gameService.create({
      date: "2026-08-12",
      time: "18:00",
      level: "8U",
      locationComplex: "Lake Shore Athletic Complex",
      locationField: "Field 2",
      awayTeam: "Visitors",
      homeTeam: "Home",
      gameType: "single"
    }).data;
    gameService.update(game.id, {
      year: 2026,
      seasonCode: "S",
      organizationCode: "LSYB",
      canonicalLevel: "8U",
      sequence: 112
    });
    notificationService.create({
      type: "game-available",
      title: "New Eligible Game",
      message: "A game was added.",
      relatedId: game.id,
      audience: selectedRole === "umpire" ? "umpire" : "admin",
      createdAt: "2026-08-08T18:00:00"
    });
    notificationService.create({
      type: "claim-submitted",
      title: "New Claim",
      message: "John Smith claimed Plate",
      relatedId: "legacy-game-id",
      audience: selectedRole === "umpire" ? "umpire" : "admin",
      createdAt: "2026-08-08T17:00:00"
    });
    renderPage("notifications");
    return game.id;
  }, role);
}

test.describe("Milestone 6.5 Notification Center redesign", () => {
  test.beforeEach(async ({ page }) => page.goto("/"));

  test("renders compact, non-clickable shared rows with operational content", async ({ page }) => {
    await seedNotificationCenter(page);
    const rows = page.getByTestId("notification-card");
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toHaveClass(/shared-notification-row/);
    expect(await rows.first().evaluate(element => element.getBoundingClientRect().height)).toBeLessThanOrEqual(70);
    expect(await rows.first().evaluate(element => getComputedStyle(element).cursor)).not.toBe("pointer");
    await expect(page.getByTestId("notification-type")).toHaveCount(0);

    await expect(page.getByText("Game Added")).toBeVisible();
    await expect(page.getByText("Aug 12 • 6:00 PM")).toBeVisible();
    await expect(page.getByText(/Lake Shore Athletic Complex/)).toBeVisible();
    await expect(page.getByText("Game Claimed")).toBeVisible();
    await expect(page.getByText("John Smith claimed U1")).toBeVisible();
    await expect(page.getByTestId("notification-timestamp").first()).toContainText("PM");
  });

  test("uses the shared game identifier and preserves a graceful fallback", async ({ page }) => {
    await seedNotificationCenter(page);
    await expect(page.getByText(/Game: 2026-S-LSYB-8U-0112/)).toBeVisible();
    await expect(page.getByText(/Game: legacy-game-id/)).toBeVisible();
  });

  test("toolbar state follows visible selection and unread state", async ({ page }) => {
    await seedNotificationCenter(page);
    const selectAll = page.getByTestId("notifications-select-visible");
    const markRead = page.getByTestId("notifications-mark-selected-read");
    const clear = page.getByTestId("notifications-clear-selection");
    const remove = page.getByTestId("notifications-delete-selected");

    await expect(selectAll).toHaveText("Select All");
    await expect(markRead).toHaveText("Mark as Read");
    await expect(markRead).toBeDisabled();
    await expect(clear).toBeDisabled();
    await expect(remove).toBeDisabled();

    await selectAll.click();
    await expect(page.getByTestId("notification-select").first()).toBeChecked();
    await expect(markRead).toBeEnabled();
    await expect(clear).toBeEnabled();
    await expect(remove).toBeEnabled();
    await markRead.click();
    await expect(markRead).toBeDisabled();
    await expect(page.getByTestId("notification-card").first()).toHaveAttribute("data-notification-status", "read");

    await selectAll.click();
    await remove.click();
    await expect(page.getByTestId("notifications-empty")).toBeVisible();
  });

  test("sidebar badge is centered red with white text", async ({ page }) => {
    await seedNotificationCenter(page);
    const badge = page.getByTestId("notifications-badge");
    await expect(badge).toHaveText("2");
    await expect(badge).toHaveCSS("background-color", "rgb(217, 45, 32)");
    await expect(badge).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(badge).toHaveCSS("align-items", "center");
  });

  for (const role of ["administrator", "umpire"]) {
    test(`${role} layout remains responsive and accessible`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await seedNotificationCenter(page, role);
      await expect(page.getByTestId("notifications")).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      const accessibility = await new AxeBuilder({ page })
        .include('[data-testid="notifications"]')
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      expect(accessibility.violations).toEqual([]);
    });
  }
});
