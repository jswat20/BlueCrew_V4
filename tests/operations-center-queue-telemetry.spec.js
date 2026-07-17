import { expect, test } from "@playwright/test";

test.describe("Operations Center staffing health", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      authService.loginAsAdmin();
      renderPage("operations-center");
    });
  });

  test("shows today, week, and month operational states", async ({ page }) => {
    await expect(page.getByTestId("operations-period-today")).toBeVisible();
    await expect(page.getByTestId("operations-period-week")).toBeVisible();
    await expect(page.getByTestId("operations-period-month")).toBeVisible();
  });

  test("uses supported readiness states", async ({ page }) => {
    for (const period of ["today", "week", "month"]) {
      await expect(page.getByTestId(`operations-period-${period}`)).toHaveAttribute(
        "data-status",
        /critical|watch|healthy/
      );
    }
  });

  test("does not expose duplicate queue-control buttons", async ({ page }) => {
    await expect(page.getByTestId("operations-queue-summary")).toHaveCount(0);
  });
});
