import { test, expect } from "@playwright/test";

test.describe("Account Service", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.removeItem("bluecrew_accounts");
    });
  });

  test("creates an umpire account pending approval", async ({ page }) => {
    const result = await page.evaluate(() => {
      return accountService.createAccount({
        firstName: "Junior",
        lastName: "Umpire",
        email: "junior@example.com",
        phone: "555-111-2222"
      });
    });

    expect(result.success).toBe(true);
    expect(result.data.status).toBe("pending");
    expect(result.data.firstName).toBe("Junior");
    expect(result.data.lastName).toBe("Umpire");
    expect(result.data.email).toBe("junior@example.com");
  });

  test("prevents duplicate account emails", async ({ page }) => {
    await page.evaluate(() => {
      accountService.createAccount({
        firstName: "Junior",
        lastName: "One",
        email: "duplicate@example.com"
      });
    });

    const result = await page.evaluate(() => {
      return accountService.createAccount({
        firstName: "Junior",
        lastName: "Two",
        email: "duplicate@example.com"
      });
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("already exists");
  });

  test("approves an account and links it to a crew profile", async ({ page }) => {
    const result = await page.evaluate(() => {
      const created = accountService.createAccount({
        firstName: "Approved",
        lastName: "Umpire",
        email: "approved@example.com"
      });

      return accountService.approveAccount(created.data.id, 12);
    });

    expect(result.success).toBe(true);
    expect(result.data.status).toBe("approved");
    expect(result.data.crewId).toBe(12);
    expect(result.data.approvedAt).toBeTruthy();
  });

  test("rejects an account", async ({ page }) => {
    const result = await page.evaluate(() => {
      const created = accountService.createAccount({
        firstName: "Rejected",
        lastName: "Umpire",
        email: "rejected@example.com"
      });

      return accountService.rejectAccount(created.data.id);
    });

    expect(result.success).toBe(true);
    expect(result.data.status).toBe("rejected");
    expect(result.data.rejectedAt).toBeTruthy();
  });

  test("returns pending and approved accounts separately", async ({ page }) => {
    const result = await page.evaluate(() => {
      const pending = accountService.createAccount({
        firstName: "Pending",
        lastName: "Umpire",
        email: "pending@example.com"
      });

      const approved = accountService.createAccount({
        firstName: "Approved",
        lastName: "Umpire",
        email: "approved-list@example.com"
      });

      accountService.approveAccount(approved.data.id, 22);

      return {
        pendingAccounts: accountService.getPendingAccounts(),
        approvedAccounts: accountService.getApprovedAccounts()
      };
    });

    expect(result.pendingAccounts).toHaveLength(1);
    expect(result.pendingAccounts[0].email).toBe("pending@example.com");

    expect(result.approvedAccounts).toHaveLength(1);
    expect(result.approvedAccounts[0].email).toBe("approved-list@example.com");
  });

  test("updates an account without changing its id", async ({ page }) => {
    const result = await page.evaluate(() => {
      const created = accountService.createAccount({
        firstName: "Update",
        lastName: "Me",
        email: "update@example.com"
      });

      return accountService.updateAccount(created.data.id, {
        firstName: "Updated",
        phone: "555-999-0000"
      });
    });

    expect(result.success).toBe(true);
    expect(result.data.firstName).toBe("Updated");
    expect(result.data.phone).toBe("555-999-0000");
  });

  test("deletes an account", async ({ page }) => {
    const result = await page.evaluate(() => {
      const created = accountService.createAccount({
        firstName: "Delete",
        lastName: "Me",
        email: "delete@example.com"
      });

      accountService.deleteAccount(created.data.id);

      return accountService.getById(created.data.id);
    });

    expect(result).toBeNull();
  });
});