import { expect, test } from "@playwright/test";

test.describe("Operations Center operational state", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      authService.loginAsAdmin();
      renderPage("operations-center");
    });
  });

  test("renders staffing readiness instrumentation", async ({ page }) => {
    await expect(page.getByTestId("operations-status-rail")).toBeVisible();
    await expect(page.getByTestId("operations-progress")).toBeVisible();
    await expect(page.getByTestId("operations-period-today")).toBeVisible();
    await expect(page.getByTestId("operations-period-week")).toBeVisible();
    await expect(page.getByTestId("operations-period-month")).toBeVisible();
  });

  test("does not render obsolete queue health controls", async ({ page }) => {
    await expect(page.getByTestId("operations-queue-health-item")).toHaveCount(0);
    await expect(page.getByTestId("operations-queue-summary")).toHaveCount(0);
  });
});
