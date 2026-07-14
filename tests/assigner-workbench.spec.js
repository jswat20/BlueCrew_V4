import { expect, test } from "@playwright/test";

test("workbench renders", async ({ page }) => {
  await page.goto("/");

  await page.evaluate(() => {
    navigateTo("assigner-workbench");
  });

  await expect(
    page.getByTestId("assigner-workbench")
  ).toBeVisible();

  await expect(
    page.getByTestId("workbench-needs-assignment")
  ).toBeVisible();

  await expect(
    page.getByTestId("workbench-pending-claims")
  ).toBeVisible();

  await expect(
    page.getByTestId("workbench-awaiting-review")
  ).toBeVisible();

  await expect(
    page.getByTestId("workbench-returned-review")
  ).toBeVisible();

  await expect(
    page.getByTestId("workbench-today")
  ).toBeVisible();

  await expect(
    page.getByTestId("workbench-activity")
  ).toBeVisible();
});
