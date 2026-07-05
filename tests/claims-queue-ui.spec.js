import { test, expect } from "./fixtures/app.fixture.js";

test.describe("Claims Queue UI", () => {
  test.beforeEach(async ({ app }) => {
    await app.page.evaluate(() => {
      authService.loginAsAdmin();
      document.body.dataset.role = "admin";
      window.BlueCrew.test.currentRole = "admin";

      if (window.qaService) {
        qaService.setRole("admin");
      }

      renderPage("dashboard");
    });
  });

  async function openClaimsQueue(app) {
  await app.page.evaluate(() => {
    authService.loginAsAdmin();
    document.body.dataset.role = "admin";
    window.BlueCrew.test.currentRole = "admin";

    if (window.qaService) {
      qaService.setRole("admin");
    }

    renderPage("claims-queue");
  });
}

  test("shows a pending claim", async ({ app }) => {
    await app.createPendingClaim();
    await openClaimsQueue(app);

    await expect(app.page.getByTestId("claim-queue-card")).toHaveCount(1);
    await expect(app.page.getByText("Pending Away @ Pending Home")).toBeVisible();
    await expect(app.page.getByText("Position: Plate")).toBeVisible();
    await expect(app.page.getByText(/Claimed by:/)).toBeVisible();
  });

  test("approves a pending claim and removes it from the queue", async ({ app }) => {
    await app.createPendingClaim();
    await openClaimsQueue(app);

    await app.page.getByTestId(/^approve-claim-/).click();

    await expect(app.page.getByTestId("claims-queue-empty")).toBeVisible();
  });

  test("rejects a pending claim and removes it from the queue", async ({ app }) => {
    await app.createPendingClaim();
    await openClaimsQueue(app);

    await app.page.getByTestId(/^reject-claim-/).click();

    await expect(app.page.getByTestId("claims-queue-empty")).toBeVisible();
  });

  test("bulk buttons are disabled when no claims are selected", async ({ app }) => {
    await app.createPendingClaim();
    await openClaimsQueue(app);

    await expect(app.page.getByTestId("bulk-approve-claims")).toBeDisabled();
    await expect(app.page.getByTestId("bulk-reject-claims")).toBeDisabled();
  });

  test("selecting a claim enables bulk buttons", async ({ app }) => {
    await app.createPendingClaim();
    await openClaimsQueue(app);

    await app.page.getByTestId("claim-select-checkbox").check();

    await expect(app.page.getByTestId("bulk-approve-claims")).toBeEnabled();
    await expect(app.page.getByTestId("bulk-reject-claims")).toBeEnabled();
  });

  test("Approve Selected approves selected pending claims and clears the queue", async ({ app }) => {
    await app.createPendingClaim();
    await openClaimsQueue(app);

    await app.page.getByTestId("claim-select-checkbox").check();
    await app.page.getByTestId("bulk-approve-claims").click();

    await expect(app.page.getByTestId("claims-queue-empty")).toBeVisible();
  });

  test("Reject Selected rejects selected pending claims and clears the queue", async ({ app }) => {
    await app.createPendingClaim();
    await openClaimsQueue(app);

    await app.page.getByTestId("claim-select-checkbox").check();
    await app.page.getByTestId("bulk-reject-claims").click();

    await expect(app.page.getByTestId("claims-queue-empty")).toBeVisible();
  });
  test("Select All selects every claim and enables bulk actions", async ({ app }) => {
  await app.createPendingClaim();
  await app.createPendingClaim({
    homeTeam: "Second Pending Home",
    awayTeam: "Second Pending Away"
  });

  await openClaimsQueue(app);

  await app.page.getByTestId("select-all-claims").click();

  await expect(app.page.getByTestId("claim-select-checkbox")).toHaveCount(2);

  for (const checkbox of await app.page.getByTestId("claim-select-checkbox").all()) {
    await expect(checkbox).toBeChecked();
  }

  await expect(app.page.getByTestId("bulk-approve-claims")).toBeEnabled();
  await expect(app.page.getByTestId("bulk-reject-claims")).toBeEnabled();
});

test("Clear Selection unchecks every claim and disables bulk actions", async ({ app }) => {
  await app.createPendingClaim();
  await app.createPendingClaim({
    homeTeam: "Second Pending Home",
    awayTeam: "Second Pending Away"
  });

  await openClaimsQueue(app);

  await app.page.getByTestId("select-all-claims").click();
  await app.page.getByTestId("clear-selected-claims").click();

  await expect(app.page.getByTestId("claim-select-checkbox")).toHaveCount(2);

  for (const checkbox of await app.page.getByTestId("claim-select-checkbox").all()) {
    await expect(checkbox).not.toBeChecked();
  }

  await expect(app.page.getByTestId("bulk-approve-claims")).toBeDisabled();
  await expect(app.page.getByTestId("bulk-reject-claims")).toBeDisabled();
  await expect(app.page.getByTestId("clear-selected-claims")).toBeDisabled();
});
});