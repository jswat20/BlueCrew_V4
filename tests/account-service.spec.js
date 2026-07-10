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

  test("approves an account and links it to a crew profile", async ({
    page
  }) => {
    const result = await page.evaluate(() => {
      const created = accountService.createAccount({
        firstName: "Approved",
        lastName: "Umpire",
        email: "approved@example.com"
      });

      return accountService.approveAccount(
        created.data.id,
        12
      );
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

  test("approves multiple accounts", async ({ page }) => {
    const result = await page.evaluate(() => {
      const accountIds = [];

      for (let index = 0; index < 3; index++) {
        const created = accountService.createAccount({
          firstName: `Bulk${index}`,
          lastName: "Approve",
          email: `bulk-approve-${index}@test.com`
        });

        accountIds.push(created.data.id);
      }

      return {
        operation:
          accountService.approveAccounts(accountIds),
        pendingAccounts:
          accountService.getPendingAccounts(),
        approvedAccounts:
          accountService.getApprovedAccounts()
      };
    });

    expect(result.operation.success).toBe(true);
    expect(result.operation.data.processed).toBe(3);
    expect(result.operation.data.approved).toBe(3);
    expect(result.operation.data.failed).toBe(0);

    expect(result.pendingAccounts).toHaveLength(0);
    expect(result.approvedAccounts).toHaveLength(3);
  });

  test("rejects multiple accounts", async ({ page }) => {
    const result = await page.evaluate(() => {
      const accountIds = [];

      for (let index = 0; index < 3; index++) {
        const created = accountService.createAccount({
          firstName: `Bulk${index}`,
          lastName: "Reject",
          email: `bulk-reject-${index}@test.com`
        });

        accountIds.push(created.data.id);
      }

      return {
        operation:
          accountService.rejectAccounts(accountIds),
        pendingAccounts:
          accountService.getPendingAccounts(),
        rejectedAccounts:
          accountService
            .getAll()
            .filter(account =>
              account.status === "rejected"
            )
      };
    });

    expect(result.operation.success).toBe(true);
    expect(result.operation.data.processed).toBe(3);
    expect(result.operation.data.rejected).toBe(3);
    expect(result.operation.data.failed).toBe(0);

    expect(result.pendingAccounts).toHaveLength(0);
    expect(result.rejectedAccounts).toHaveLength(3);
  });

  test("bulk account operations report invalid account ids", async ({
    page
  }) => {
    const result = await page.evaluate(() => {
      const created = accountService.createAccount({
        firstName: "Valid",
        lastName: "Account",
        email: "valid-bulk@test.com"
      });

      return accountService.approveAccounts([
        created.data.id,
        "missing-account"
      ]);
    });

    expect(result.success).toBe(true);
    expect(result.data.processed).toBe(2);
    expect(result.data.approved).toBe(1);
    expect(result.data.failed).toBe(1);
  });

  test("returns pending and approved accounts separately", async ({
    page
  }) => {
    const result = await page.evaluate(() => {
      accountService.createAccount({
        firstName: "Pending",
        lastName: "Umpire",
        email: "pending@example.com"
      });

      const approved = accountService.createAccount({
        firstName: "Approved",
        lastName: "Umpire",
        email: "approved-list@example.com"
      });

      accountService.approveAccount(
        approved.data.id,
        22
      );

      return {
        pendingAccounts:
          accountService.getPendingAccounts(),
        approvedAccounts:
          accountService.getApprovedAccounts()
      };
    });

    expect(result.pendingAccounts).toHaveLength(1);
    expect(result.pendingAccounts[0].email)
      .toBe("pending@example.com");

    expect(result.approvedAccounts).toHaveLength(1);
    expect(result.approvedAccounts[0].email)
      .toBe("approved-list@example.com");
  });

  test("updates an account without changing its id", async ({
    page
  }) => {
    const result = await page.evaluate(() => {
      const created = accountService.createAccount({
        firstName: "Update",
        lastName: "Me",
        email: "update@example.com"
      });

      return accountService.updateAccount(
        created.data.id,
        {
          firstName: "Updated",
          phone: "555-999-0000"
        }
      );
    });

    expect(result.success).toBe(true);
    expect(result.data.id).toBeTruthy();
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

  test("links an approved account to a crew member", async ({
    page
  }) => {
    const result = await page.evaluate(() => {
      const account = accountService.createAccount({
        firstName: "Link",
        lastName: "Tester",
        email: "link@test.com"
      }).data;

      accountService.approveAccount(account.id);

      const crewMember = crewService.getAll()[0];

      return accountService.linkCrew(
        account.id,
        crewMember.id
      );
    });

    expect(result.success).toBe(true);
    expect(result.data.crewId).toBeTruthy();
  });

  test("rejects linking a pending account", async ({ page }) => {
    const result = await page.evaluate(() => {
      const account = accountService.createAccount({
        firstName: "Pending",
        lastName: "Tester",
        email: "pending-link@test.com"
      }).data;

      const crewMember = crewService.getAll()[0];

      return accountService.linkCrew(
        account.id,
        crewMember.id
      );
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain(
      "Only approved accounts"
    );
  });

  test("rejects linking to a nonexistent crew member", async ({
    page
  }) => {
    const result = await page.evaluate(() => {
      const account = accountService.createAccount({
        firstName: "Invalid",
        lastName: "Crew",
        email: "invalid-crew@test.com"
      }).data;

      accountService.approveAccount(account.id);

      return accountService.linkCrew(
        account.id,
        "does-not-exist"
      );
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain(
      "Crew member not found"
    );
  });

  test("prevents linking two accounts to the same crew member", async ({
    page
  }) => {
    const result = await page.evaluate(() => {
      const first = accountService.createAccount({
        firstName: "One",
        lastName: "Tester",
        email: "first-link@test.com"
      }).data;

      const second = accountService.createAccount({
        firstName: "Two",
        lastName: "Tester",
        email: "second-link@test.com"
      }).data;

      accountService.approveAccount(first.id);
      accountService.approveAccount(second.id);

      const crewMember = crewService.getAll()[0];

      accountService.linkCrew(
        first.id,
        crewMember.id
      );

      return accountService.linkCrew(
        second.id,
        crewMember.id
      );
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain(
      "already linked"
    );
  });

  test("unlinks a crew member", async ({ page }) => {
    const result = await page.evaluate(() => {
      const account = accountService.createAccount({
        firstName: "Unlink",
        lastName: "Tester",
        email: "unlink@test.com"
      }).data;

      accountService.approveAccount(account.id);

      const crewMember = crewService.getAll()[0];

      accountService.linkCrew(
        account.id,
        crewMember.id
      );

      return accountService.unlinkCrew(account.id);
    });

    expect(result.success).toBe(true);
    expect(result.data.crewId).toBeNull();
  });

  test("returns only approved accounts that are not linked", async ({
    page
  }) => {
    const result = await page.evaluate(() => {
      const unlinked = accountService.createAccount({
        firstName: "Available",
        lastName: "Account",
        email: "available@test.com"
      }).data;

      const linked = accountService.createAccount({
        firstName: "Linked",
        lastName: "Account",
        email: "linked@test.com"
      }).data;

      accountService.approveAccount(unlinked.id);
      accountService.approveAccount(linked.id);

      const crewMember = crewService.getAll()[0];

      accountService.linkCrew(
        linked.id,
        crewMember.id
      );

      return accountService
        .getUnlinkedApprovedAccounts();
    });

    expect(result).toHaveLength(1);
    expect(result[0].email).toBe(
      "available@test.com"
    );
    expect(result[0].crewId).toBeNull();
    expect(result[0].status).toBe("approved");
  });
});