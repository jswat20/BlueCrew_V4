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

 test("shows an empty state when there are no pending claims", async ({ app }) => {
  await app.page.evaluate(() => {
    renderPage("claims-queue");
  });

  await expect(app.page.getByTestId("claims-queue-empty")).toBeVisible();
});

  test("shows a pending claim", async ({ app }) => {
    await app.createPendingClaim();

    await app.page.evaluate(() => {
      authService.loginAsAdmin();
      document.body.dataset.role = "admin";
      window.BlueCrew.test.currentRole = "admin";

      if (window.qaService) {
        qaService.setRole("admin");
      }

      renderPage("claims-queue");
    });

    await expect(app.page.getByTestId("claim-queue-card")).toHaveCount(1);
    await expect(app.page.getByText("Pending Away @ Pending Home")).toBeVisible();
    await expect(app.page.getByText("Position: Plate")).toBeVisible();
await expect(app.page.getByText(/Claimed by:/)).toBeVisible();
  });

  test("approves a pending claim and removes it from the queue", async ({ app }) => {
    await app.createPendingClaim();

    await app.page.evaluate(() => {
      authService.loginAsAdmin();
      document.body.dataset.role = "admin";
      window.BlueCrew.test.currentRole = "admin";

      if (window.qaService) {
        qaService.setRole("admin");
      }

      renderPage("claims-queue");
    });

    await app.page.getByRole("button", { name: "Approve" }).click();

    await expect(app.page.getByTestId("claims-queue-empty")).toBeVisible();
  });

  test("rejects a pending claim and removes it from the queue", async ({ app }) => {
    await app.createPendingClaim();

    await app.page.evaluate(() => {
      authService.loginAsAdmin();
      document.body.dataset.role = "admin";
      window.BlueCrew.test.currentRole = "admin";

      if (window.qaService) {
        qaService.setRole("admin");
      }

      renderPage("claims-queue");
    });

    await app.page.getByRole("button", { name: "Reject" }).click();

    await expect(app.page.getByTestId("claims-queue-empty")).toBeVisible();
  });
});