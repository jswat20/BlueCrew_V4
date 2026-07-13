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
test("Admin can link an approved account to a crew member", async ({ app }) => {
  const consoleMonitor = createConsoleMonitor(app.page);

  const account = await app.page.evaluate(() => {
    const result = accountService.createAccount({
      firstName: "Crew",
      lastName: "Link",
      email: `crew-link-${Date.now()}@test.com`
    });

    accountService.approveAccount(result.data.id);

    return result.data;
  });

  const crewMember = await app.page.evaluate(() => {
    return crewService.getAll()[0];
  });

  await app.page.getByTestId("nav-accounts").click();

  const row = app.page.getByTestId(`unlinked-account-${account.id}`);

  await expect(row).toBeVisible();

  await app.page
    .getByTestId(`crew-select-${account.id}`)
    .selectOption(String(crewMember.id));

  await app.page
    .getByTestId(`link-crew-${account.id}`)
    .click();

  await app.page.reload();

  await app.page.getByTestId("nav-accounts").click();

  await expect(
    app.page.getByTestId(`unlinked-account-${account.id}`)
  ).not.toBeVisible();

  await consoleMonitor.expectClean();
});
test("dashboard pending accounts opens the pending filter", async ({ app }) => {
  await app.page.evaluate(() => {
    accountService.createAccount({
      firstName: "Dashboard",
      lastName: "Pending",
      email: `dashboard-pending-${Date.now()}@test.com`
    });

    renderPage("dashboard");
  });

  await app.page
    .getByTestId("dashboard-summary-pending-accounts")
    .click();

  await expect(app.page.locator("body")).toHaveAttribute(
    "data-page",
    "accounts"
  );

  await expect(
    app.page.getByTestId("accounts-page")
  ).toHaveAttribute("data-account-filter", "pending");

  await expect(
    app.page.getByTestId("pending-accounts-section")
  ).toBeVisible();

  await expect(
    app.page.getByTestId("unlinked-accounts-section")
  ).not.toBeVisible();
});

test("account filters switch between pending and unlinked views", async ({ app }) => {
  await app.page.evaluate(() => {
    const pending = accountService.createAccount({
      firstName: "Filter",
      lastName: "Pending",
      email: `filter-pending-${Date.now()}@test.com`
    });

    const approved = accountService.createAccount({
      firstName: "Filter",
      lastName: "Approved",
      email: `filter-approved-${Date.now()}@test.com`
    });

    accountService.approveAccount(approved.data.id);
    uiStateService.setAccountFilter("pending");
    renderPage("accounts");
  });

  await expect(
    app.page.getByTestId("pending-accounts-section")
  ).toBeVisible();

  await expect(
    app.page.getByTestId("unlinked-accounts-section")
  ).not.toBeVisible();

  await app.page
    .getByTestId("account-filter-unlinked")
    .click();

  await expect(
    app.page.getByTestId("unlinked-accounts-section")
  ).toBeVisible();

  await expect(
    app.page.getByTestId("pending-accounts-section")
  ).not.toBeVisible();
});

test("rejecting a pending account removes it from the pending view", async ({ app }) => {
  const account = await app.page.evaluate(() => {
    const created = accountService.createAccount({
      firstName: "Reject",
      lastName: "Pending",
      email: `reject-pending-${Date.now()}@test.com`
    });

    uiStateService.setAccountFilter("pending");
    renderPage("accounts");

    return created.data;
  });

  await app.page
    .getByTestId(`reject-account-${account.id}`)
    .click();

  await expect(
    app.page.getByTestId(`pending-account-${account.id}`)
  ).not.toBeVisible();
});
test("bulk account actions are disabled until an account is selected", async ({ app }) => {
  await app.page.evaluate(() => {
    accountService.createAccount({
      firstName: "Bulk",
      lastName: "One",
      email: `bulk-one-${Date.now()}@test.com`
    });

    renderPage("accounts");
  });

  await expect(
    app.page.getByTestId("approve-selected-accounts")
  ).toBeDisabled();

  await expect(
    app.page.getByTestId("reject-selected-accounts")
  ).toBeDisabled();
});
test("selecting a pending account enables bulk actions", async ({ app }) => {
  const id = await app.page.evaluate(() => {
    return accountService.createAccount({
      firstName: "Bulk",
      lastName: "Two",
      email: `bulk-two-${Date.now()}@test.com`
    }).data.id;
  });

  await app.page.evaluate(() => renderPage("accounts"));

  await app.page
    .getByTestId(`select-account-${id}`)
    .check();

  await expect(
    app.page.getByTestId("approve-selected-accounts")
  ).toBeEnabled();

  await expect(
    app.page.getByTestId("reject-selected-accounts")
  ).toBeEnabled();
});
test("bulk approve removes selected pending accounts", async ({ app }) => {
  const ids = await app.page.evaluate(() => {
    return [1, 2].map(i =>
      accountService.createAccount({
        firstName: `Approve${i}`,
        lastName: "Bulk",
        email: `approve-${i}-${Date.now()}@test.com`
      }).data.id
    );
  });

  await app.page.evaluate(() => renderPage("accounts"));

  for (const id of ids) {
    await app.page
      .getByTestId(`select-account-${id}`)
      .check();
  }

  await app.page
    .getByTestId("approve-selected-accounts")
    .click();

  await expect(
    app.page.getByTestId("pending-accounts-empty")
  ).toBeVisible();
});
test("bulk reject removes selected pending accounts", async ({ app }) => {
  const ids = await app.page.evaluate(() => {
    return [1, 2].map(i =>
      accountService.createAccount({
        firstName: `Reject${i}`,
        lastName: "Bulk",
        email: `reject-${i}-${Date.now()}@test.com`
      }).data.id
    );
  });

  await app.page.evaluate(() => renderPage("accounts"));

  for (const id of ids) {
    await app.page
      .getByTestId(`select-account-${id}`)
      .check();
  }

  await app.page
    .getByTestId("reject-selected-accounts")
    .click();

  await expect(
    app.page.getByTestId("pending-accounts-empty")
  ).toBeVisible();
});
test("displays an approved account role", async ({ app }) => {
  const account = await app.page.evaluate(() => {
    const created = accountService.createAccount({
      firstName: "Role",
      lastName: "Display",
      email: `role-display-${Date.now()}@test.com`
    });

    accountService.updateRole(
      created.data.id,
      "assigner"
    );

    accountService.approveAccount(
      created.data.id
    );

    uiStateService.setAccountFilter("approved");
    renderPage("accounts");

    return created.data;
  });

  await expect(
    app.page.getByTestId(
      `account-role-display-${account.id}`
    )
  ).toHaveText("Role: Assigner");
});

test("changes a pending account role", async ({ app }) => {
  const account = await app.page.evaluate(() => {
    const created = accountService.createAccount({
      firstName: "Role",
      lastName: "Change",
      email: `role-change-${Date.now()}@test.com`
    });

    renderPage("accounts");

    return created.data;
  });

  await app.page
    .getByTestId(`account-role-${account.id}`)
    .selectOption("administrator");

  const role = await app.page.evaluate(accountId => {
    return accountService
      .getById(accountId)
      .role;
  }, account.id);

  expect(role).toBe("administrator");
});

test("filters accounts by role", async ({ app }) => {
  const accounts = await app.page.evaluate(() => {
    const administrator =
      accountService.createAccount({
        firstName: "Filter",
        lastName: "Administrator",
        email: `filter-admin-${Date.now()}@test.com`
      }).data;

    const umpire =
      accountService.createAccount({
        firstName: "Filter",
        lastName: "Umpire",
        email: `filter-umpire-${Date.now()}@test.com`
      }).data;

    accountService.updateRole(
      administrator.id,
      "administrator"
    );

    renderPage("accounts");

    return {
      administrator,
      umpire
    };
  });

  await app.page
    .getByTestId(
      "account-role-filter-administrator"
    )
    .click();

  await expect(
    app.page.getByTestId(
      `pending-account-${accounts.administrator.id}`
    )
  ).toBeVisible();

  await expect(
    app.page.getByTestId(
      `pending-account-${accounts.umpire.id}`
    )
  ).not.toBeVisible();
});


test.describe("Account Roles UI", () => {
  test("displays the current role for an approved account", async ({ app }) => {
    const account = await app.page.evaluate(() => {
      const created = accountService.createAccount({
        firstName: "Display",
        lastName: "Assigner",
        email: `display-role-${Date.now()}@test.com`
      }).data;

      accountService.updateRole(created.id, "assigner");
      accountService.approveAccount(created.id);

      uiStateService.setAccountFilter("approved");
      renderPage("accounts");

      return created;
    });

    await expect(
      app.page.getByTestId(
        `account-role-display-${account.id}`
      )
    ).toHaveText("Role: Assigner");
  });

  test("changes the role of a pending account", async ({ app }) => {
    const account = await app.page.evaluate(() => {
      const created = accountService.createAccount({
        firstName: "Change",
        lastName: "Role",
        email: `change-role-${Date.now()}@test.com`
      }).data;

      renderPage("accounts");
      return created;
    });

    const roleSelect = app.page.getByTestId(
      `account-role-${account.id}`
    );

    await expect(roleSelect).toHaveValue("umpire");

    await roleSelect.selectOption("administrator");

    const role = await app.page.evaluate(accountId => {
      return accountService.getAll().find(
        account => String(account.id) === String(accountId)
      )?.role;
    }, account.id);

    expect(role).toBe("administrator");
  });

  test("filters accounts by role and composes with status", async ({ app }) => {
    const accounts = await app.page.evaluate(() => {
      localStorage.removeItem("bluecrew_accounts");

      const administrator =
        accountService.createAccount({
          firstName: "Role",
          lastName: "Administrator",
          email: `role-admin-${Date.now()}@test.com`
        }).data;

      const umpire =
        accountService.createAccount({
          firstName: "Role",
          lastName: "Umpire",
          email: `role-umpire-${Date.now()}@test.com`
        }).data;

      accountService.updateRole(
        administrator.id,
        "administrator"
      );

      uiStateService.setAccountFilter("pending");
      renderPage("accounts");

      return {
        administrator,
        umpire
      };
    });

    await app.page
      .getByTestId("account-role-filter-administrator")
      .click();

    await expect(
      app.page.getByTestId(
        `pending-account-${accounts.administrator.id}`
      )
    ).toBeVisible();

    await expect(
      app.page.getByTestId(
        `pending-account-${accounts.umpire.id}`
      )
    ).not.toBeVisible();

    await expect(
      app.page.getByTestId("accounts-page")
    ).toHaveAttribute("data-account-filter", "pending");

    await expect(
      app.page.getByTestId(
        "account-role-filter-administrator"
      )
    ).toHaveAttribute("aria-pressed", "true");
  });
});
