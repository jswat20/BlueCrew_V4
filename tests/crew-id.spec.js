import { test, expect } from "./fixtures/app.fixture.js";

test.describe("Immutable Crew ID", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.removeItem("bluecrew_accounts");
      authService.loginAsAdmin();
    });
  });

  test("new umpire accounts receive unique human-readable Crew IDs", async ({ page }) => {
    const codes = await page.evaluate(() => [
      accountService.createAccount({ firstName: "One", lastName: "Official", email: "one@crew.test" }).data.crewCode,
      accountService.createAccount({ firstName: "Two", lastName: "Official", email: "two@crew.test" }).data.crewCode
    ]);
    expect(codes[0]).toMatch(/^BC-\d{4}-\d{4,}$/);
    expect(codes[1]).toMatch(/^BC-\d{4}-\d{4,}$/);
    expect(codes[0]).not.toBe(codes[1]);
  });

  test("non-umpire accounts do not receive a Crew ID", async ({ page }) => {
    const account = await page.evaluate(() => accountService.createAccount({ firstName: "Admin", lastName: "Only", email: "admin@crew.test", role: "administrator" }).data);
    expect(account.crewCode).toBe("");
  });

  test("Crew ID survives edits, approval, rejection, and role updates", async ({ page }) => {
    const result = await page.evaluate(() => {
      const account = accountService.createAccount({ firstName: "Stable", lastName: "Official", email: "stable@crew.test" }).data;
      const original = account.crewCode;
      accountService.updateAccount(account.id, { phone: "555-111-2222" });
      accountService.approveAccount(account.id);
      accountService.rejectAccount(account.id);
      accountService.updateRole(account.id, "assigner");
      return { original, current: accountService.getById(account.id).crewCode };
    });
    expect(result.current).toBe(result.original);
  });

  test("admin and profile update paths cannot change Crew ID", async ({ page }) => {
    const result = await page.evaluate(() => {
      const account = accountService.createAccount({ firstName: "Guarded", lastName: "Official", email: "guarded@crew.test" }).data;
      const admin = accountService.updateAccount(account.id, { crewCode: "BC-1900-0001" });
      accountService.updateProfile(account.id, { email: account.email, crewCode: "BC-1900-0002" });
      return { admin, current: accountService.getById(account.id).crewCode, original: account.crewCode };
    });
    expect(result.admin.success).toBe(false);
    expect(result.current).toBe(result.original);
  });

  test("legacy migration assigns IDs once and is idempotent", async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.setItem("bluecrew_accounts", JSON.stringify([
        { id: "legacy-1", firstName: "Legacy", lastName: "One", email: "legacy1@test.com", role: "umpire", status: "approved", createdAt: "2025-04-01T12:00:00.000Z" },
        { id: "legacy-2", firstName: "Legacy", lastName: "Two", email: "legacy2@test.com", role: "umpire", status: "approved", createdAt: "2025-04-02T12:00:00.000Z" }
      ]));
      const first = accountService.migrateCrewCodes().map(account => account.crewCode);
      const second = accountService.migrateCrewCodes().map(account => account.crewCode);
      return { first, second };
    });
    expect(result.first).toEqual(result.second);
    expect(new Set(result.first).size).toBe(2);
  });
});
