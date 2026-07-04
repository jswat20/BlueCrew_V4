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