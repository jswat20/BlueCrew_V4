import { expect, test } from "@playwright/test";

test.describe("Operations Center staffing board", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      authService.loginAsAdmin();
      renderPage("operations-center");
    });
  });

  test("removes the legacy priority queue", async ({ page }) => {
    await expect(page.getByTestId("operations-work-deck")).toHaveCount(0);
    await expect(page.getByText("Priority ordered")).toHaveCount(0);
  });

  test("renders upcoming work as a staffing table", async ({ page }) => {
    await expect(page.getByTestId("operations-upcoming-work")).toBeVisible();
    const events = page.getByTestId("operations-upcoming-event");
    if (await events.count()) {
      await expect(page.locator(".operations-staffing-table").first()).toBeVisible();
      await expect(page.locator(".operations-staffing-table th").first()).toHaveText("Time");
    }
  });
});
