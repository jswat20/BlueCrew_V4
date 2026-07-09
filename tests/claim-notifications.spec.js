import { test, expect } from "./fixtures/app.fixture.js";

test.describe("Claim Notifications", () => {
  test("submitting a claim creates an admin notification", async ({ app }) => {
    await app.page.evaluate(() => {
      notificationService.clearAll();
    });

    await app.createPendingClaim();

    await app.page.evaluate(() => {
      authService.loginAsAdmin();
      document.body.dataset.role = "admin";
    });

    await app.page.getByTestId("nav-notifications").click();

    await expect(app.page.getByTestId("notification-card")).toHaveCount(1);
    await expect(
      app.page.getByText("New Claim Submitted")
    ).toBeVisible();
  });
  test("approving a claim creates an approval notification", async ({ app }) => {
  await app.page.evaluate(() => {
    notificationService.clearAll();
  });

  await app.createPendingClaim();

  await app.page.evaluate(() => {
    authService.loginAsAdmin();
    document.body.dataset.role = "admin";
  });

  await app.page.evaluate(() => {
    const claim = claimsQueueService.getPendingClaims()[0];
    claimsQueueService.approveClaim(claim.gameId);
  });

  await app.page.getByTestId("nav-notifications").click();

  await expect(app.page.getByTestId("notification-card")).toHaveCount(2);

  await expect(
    app.page.getByText("Claim Approved")
  ).toBeVisible();
});
test("rejecting a claim creates a rejection notification", async ({ app }) => {
  await app.page.evaluate(() => {
    notificationService.clearAll();
  });

  await app.createPendingClaim();

  await app.page.evaluate(() => {
    authService.loginAsAdmin();
    document.body.dataset.role = "admin";
  });

  await app.page.evaluate(() => {
    const claim = claimsQueueService.getPendingClaims()[0];
    claimsQueueService.rejectClaim(claim.gameId);
  });

  await app.page.getByTestId("nav-notifications").click();

  await expect(app.page.getByTestId("notification-card")).toHaveCount(2);

  await expect(
    app.page.getByText("Claim Rejected")
  ).toBeVisible();
});
});