import { test, expect } from "./fixtures/app.fixture.js";

test.describe("My Claims UI", () => {
  test("shows an empty state when there are no pending claims", async ({ app }) => {
    await app.loginAsApprovedUmpire();

    await app.page.getByTestId("nav-my-claims").click();

    await expect(
      app.page.getByTestId("my-claims-empty")
    ).toBeVisible();
  });

  test("shows pending claims", async ({ app }) => {
    await app.createPendingClaim();

    await app.page.getByTestId("nav-my-claims").click();

    await expect(
      app.page.getByTestId("my-claim-card")
    ).toHaveCount(1);

    await expect(
      app.page.getByText("Pending Approval")
    ).toBeVisible();

    await expect(
      app.page.getByText("Pending Home vs Pending Away")
    ).toBeVisible();
  });
});