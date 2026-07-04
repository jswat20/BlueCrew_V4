import { test, expect } from "./fixtures/app.fixture.js";
import { createConsoleMonitor } from "./helpers/consoleMonitor.js";

test.describe("Accounts", () => {
  test("Admin can approve a pending account", async ({ app }) => {
    const consoleMonitor = createConsoleMonitor(app.page);

    const email = `pending-${Date.now()}@test.com`;

    await app.page.evaluate(testEmail => {
      accountService.createAccount({
        firstName: "Pending",
        lastName: "Tester",
        email: testEmail
      });
    }, email);

    await app.page.getByTestId("nav-accounts").click();

    await expect(
      app.page.getByTestId("pending-accounts-list")
    ).toBeVisible();

    const row = app.page.locator(
      `[data-testid^="pending-account-"]`,
      { hasText: email }
    );

    await expect(row).toBeVisible();

    await row
      .locator("[data-testid^='approve-account-']")
      .click();

    await expect(row).not.toBeVisible();

    await consoleMonitor.expectClean();
  });
});