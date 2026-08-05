import { expect, test } from "@playwright/test";

test.describe("Operations Center navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => renderPage("operations-center"));
  });

  test("open-position KPI advances to the staffing workbench", async ({ page }) => {
    await page.getByTestId("operations-metric-open-positions").click();
    await expect(page.locator("body")).toHaveAttribute("data-page", "assigner-workbench");
  });

  test("events KPI opens today's compact schedule", async ({ page }) => {
    await page.getByTestId("operations-metric-events-today").click();
    await expect(page.locator("body")).toHaveAttribute("data-page", "schedule");
    await expect(page.getByTestId("schedule-calendar")).toBeVisible();
  });
});
