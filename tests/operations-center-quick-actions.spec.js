import { expect, test } from "@playwright/test";

test.describe("Operations Center KPI actions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => renderPage("operations-center"));
  });

  test("pending queues use the approved detail-dialog architecture", async ({ page }) => {
    await page.getByTestId("operations-metric-pending-claims").click();
    await expect(page.getByTestId("operations-detail-pending-claims")).toHaveAttribute("open", "");
    await expect(page.getByTestId("operations-detail-pending-claims")).toContainText(/Pending Claims|Queue clear/);
  });

  test("removed current-task quick actions are not rendered", async ({ page }) => {
    for (const id of ["operations-current-task", "operations-current-task-action", "operations-approve-claim", "operations-reject-claim", "operations-assign-recommended"]) {
      await expect(page.getByTestId(id)).toHaveCount(0);
    }
  });
});
