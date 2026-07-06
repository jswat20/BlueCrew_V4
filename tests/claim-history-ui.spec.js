import { test, expect } from "./fixtures/app.fixture.js";

test.describe("Claim History UI", () => {
async function createApprovedAndRejectedClaims(app) {
  await app.createPendingClaim({
    homeTeam: "Approved Home",
    awayTeam: "Approved Away"
  });

  await app.page.evaluate(() => {
    authService.loginAsAdmin();
    document.body.dataset.role = "admin";
  });

  await app.page.getByTestId("nav-claims-queue").click();

  await app.page
    .locator('[data-testid^="approve-claim-"]')
    .first()
    .click();

  await app.createPendingClaim({
    homeTeam: "Rejected Home",
    awayTeam: "Rejected Away"
  });

  await app.page.evaluate(() => {
    authService.loginAsAdmin();
    document.body.dataset.role = "admin";
  });

  await app.page.getByTestId("nav-claims-queue").click();

  await app.page
    .locator('[data-testid^="reject-claim-"]')
    .first()
    .click();
}


  test("shows an empty state when there is no claim history", async ({ app }) => {
    await app.page.evaluate(() => {
      authService.loginAsAdmin();
      document.body.dataset.role = "admin";
      renderPage("claim-history");
    });

    await expect(app.page.getByTestId("claim-history")).toBeVisible();
    await expect(app.page.getByTestId("claim-history-empty")).toBeVisible();
    await expect(
      app.page.getByText("There is no claim history.")
    ).toBeVisible();
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

  test("renders claim history filter buttons", async ({ app }) => {
    await createApprovedAndRejectedClaims(app);

    await app.page.getByTestId("nav-claim-history").click();

    await expect(
      app.page.getByTestId("claim-history-filter-all")
    ).toBeVisible();

    await expect(
      app.page.getByTestId("claim-history-filter-approved")
    ).toBeVisible();

    await expect(
      app.page.getByTestId("claim-history-filter-rejected")
    ).toBeVisible();
  });

  test("approved filter displays only approved claim cards", async ({ app }) => {
    await createApprovedAndRejectedClaims(app);

    await app.page.getByTestId("nav-claim-history").click();
    await app.page.getByTestId("claim-history-filter-approved").click();

    await expect(app.page.getByTestId("approved-claim-card")).toHaveCount(1);
    await expect(app.page.getByTestId("rejected-claim-card")).toHaveCount(0);
  });

  test("rejected filter displays only rejected claim cards", async ({ app }) => {
    await createApprovedAndRejectedClaims(app);

    await app.page.getByTestId("nav-claim-history").click();
    await app.page.getByTestId("claim-history-filter-rejected").click();

    await expect(app.page.getByTestId("approved-claim-card")).toHaveCount(0);
    await expect(app.page.getByTestId("rejected-claim-card")).toHaveCount(1);
  });

  test("all filter restores approved and rejected claim cards", async ({ app }) => {
    await createApprovedAndRejectedClaims(app);

    await app.page.getByTestId("nav-claim-history").click();

    await app.page.getByTestId("claim-history-filter-approved").click();

    await expect(app.page.getByTestId("approved-claim-card")).toHaveCount(1);
    await expect(app.page.getByTestId("rejected-claim-card")).toHaveCount(0);

    await app.page.getByTestId("claim-history-filter-all").click();

    await expect(app.page.getByTestId("approved-claim-card")).toHaveCount(1);
    await expect(app.page.getByTestId("rejected-claim-card")).toHaveCount(1);
  });
});