import { expect, test } from "@playwright/test";

test.describe("Simplified umpire Notification Center", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      notificationService.clearAll(); authService.loginAsAdmin(); uiStateService.clearSelections();
      notificationService.create({ type:"assignment-created", title:"Older Assignment", message:"Tigers assignment.", createdAt:"2026-07-01T12:00:00.000Z" });
      notificationService.create({ type:"claim-submitted", title:"Newest Claim", message:"Lions claim.", createdAt:"2026-07-10T12:00:00.000Z" });
      notificationService.create({ type:"review-submitted", title:"Review Ready", message:"Wolves review.", createdAt:"2026-07-05T12:00:00.000Z" });
      renderPage("notifications");
    });
  });

  test("removes administrative discovery controls and remains newest first", async ({ page }) => {
    await expect(page.getByTestId("notification-search")).toHaveCount(0);
    await expect(page.getByTestId("notification-sort")).toHaveCount(0);
    await expect(page.getByTestId("notification-filters")).toHaveCount(0);
    await expect(page.getByTestId("notification-card")).toHaveCount(3);
    await expect(page.getByTestId("notification-card").first()).toContainText("Game Claimed");
  });

  test("selects and clears all currently loaded notifications", async ({ page }) => {
    await page.getByTestId("notifications-select-visible").click();
    await expect(page.getByTestId("notification-selection-count")).toContainText("3");
    await page.getByTestId("notifications-clear-selection").click();
    await expect(page.getByTestId("notification-selection-count")).toContainText("0");
  });

  test("marks selected loaded notifications read", async ({ page }) => {
    await page.getByTestId("notifications-select-visible").click();
    await page.getByTestId("notifications-mark-selected-read").click();
    expect(await page.evaluate(() => notificationService.getNotifications().every(item => item.read))).toBe(true);
  });
});
