import { test, expect } from "@playwright/test";

test.describe("Login Service", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");

    await page.evaluate(() => {
      localStorage.removeItem("bluecrew_accounts");
      localStorage.removeItem("bluecrew_session");
    });
  });

  test("approved account can login", async ({ page }) => {
    const result = await page.evaluate(() => {
      const created = accountService.createAccount({
        firstName: "John",
        lastName: "Smith",
        email: "john@example.com"
      });

      accountService.approveAccount(created.data.id);

      return loginService.login("john@example.com");
    });

    expect(result.success).toBe(true);

    const loggedIn = await page.evaluate(() => loginService.isLoggedIn());

    expect(loggedIn).toBe(true);
  });

  test("pending account cannot login", async ({ page }) => {
    const result = await page.evaluate(() => {
      accountService.createAccount({
        firstName: "Pending",
        lastName: "User",
        email: "pending@example.com"
      });

      return loginService.login("pending@example.com");
    });

    expect(result.success).toBe(false);
  });

  test("logout clears session", async ({ page }) => {
    await page.evaluate(() => {
      const created = accountService.createAccount({
        firstName: "Logout",
        lastName: "User",
        email: "logout@example.com"
      });

      accountService.approveAccount(created.data.id);

      loginService.login("logout@example.com");
    });

    expect(await page.evaluate(() => loginService.isLoggedIn())).toBe(true);

    await page.evaluate(() => {
      loginService.logout();
    });

    expect(await page.evaluate(() => loginService.isLoggedIn())).toBe(false);
  });

  test("getCurrentAccount returns logged in account", async ({ page }) => {
    const account = await page.evaluate(() => {
      const created = accountService.createAccount({
        firstName: "Current",
        lastName: "User",
        email: "current@example.com"
      });

      accountService.approveAccount(created.data.id);

      loginService.login("current@example.com");

      return loginService.getCurrentAccount();
    });

    expect(account.email).toBe("current@example.com");
  });
});