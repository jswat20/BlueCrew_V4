import { test, expect } from "./fixtures/app.fixture.js";
import { createConsoleMonitor } from "./helpers/consoleMonitor.js";

test.describe("Login UI", () => {
  test("approved umpire can log in with email", async ({ app }) => {
    const consoleMonitor = createConsoleMonitor(app.page);

    const email = `login-ui-${Date.now()}@test.com`;

    await app.page.evaluate(testEmail => {
      const result = accountService.createAccount({
        firstName: "Login",
        lastName: "Tester",
        email: testEmail
      });

      accountService.approveAccount(result.data.id);
    }, email);

    await app.page.getByTestId("nav-login").click();

    await expect(app.page.getByTestId("login-page")).toBeVisible();

    await app.page.getByTestId("login-email").fill(email);
    await app.page.getByTestId("login-submit").click();

    await expect(app.page.getByTestId("page-dashboard")).toBeVisible();

    await consoleMonitor.expectClean();
  });
});