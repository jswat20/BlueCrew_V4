import { test, expect } from "./fixtures/app.fixture.js";

test.describe("Claim History UI", () => {
  test("shows an empty state when there is no claim history", async ({ app }) => {
    await app.page.evaluate(() => {
      authService.loginAsAdmin();
      document.body.dataset.role = "admin";
      renderPage("claim-history");
    });

    await expect(app.page.getByTestId("claim-history")).toBeVisible();
    await expect(app.page.getByTestId("claim-history-empty")).toBeVisible();
    await expect(app.page.getByText("There is no claim history.")).toBeVisible();
  });
  test("approved claim appears in claim history after approval", async ({ app }) => {
  await app.createPendingClaim();

  await app.page.evaluate(() => {
    authService.loginAsAdmin();
    document.body.dataset.role = "admin";
  });

  await app.page.getByTestId("nav-claims-queue").click();
await app.page
  .locator('[data-testid^="approve-claim-"]')
  .first()
  .click();

  await app.page.getByTestId("nav-claim-history").click();

  await expect(app.page.getByTestId("approved-claim-card")).toHaveCount(1);
  await expect(
    app.page.getByText("Pending Away @ Pending Home")
  ).toBeVisible();
});
test("rejected claim appears in claim history after rejection", async ({ app }) => {
  await app.createPendingClaim();

  await app.page.evaluate(() => {
    authService.loginAsAdmin();
    document.body.dataset.role = "admin";
  });

  await app.page.getByTestId("nav-claims-queue").click();

  await app.page
    .locator('[data-testid^="reject-claim-"]')
    .first()
    .click();

  await app.page.getByTestId("nav-claim-history").click();

  await expect(app.page.getByTestId("rejected-claim-card")).toHaveCount(1);
  await expect(
    app.page.getByText("Pending Away @ Pending Home")
  ).toBeVisible();
});
});