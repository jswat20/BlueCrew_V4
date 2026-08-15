import { test, expect } from "./fixtures/app.fixture.js";

async function seedPending(page, names) {
  return page.evaluate(values => {
    accountService.getPendingAccounts().forEach(account => accountService.rejectAccount(account.id));
    const accounts = values.map((name, index) => accountService.createAccount({
      firstName: name,
      lastName: "Pending",
      email: `${name.toLowerCase()}-${Date.now()}-${index}@example.com`
    }).data);
    renderPage("operations-center");
    return accounts;
  }, names);
}

async function openDialog(page) {
  const trigger = page.getByTestId("operations-metric-pending-accounts");
  await trigger.focus();
  await trigger.click();
  const dialog = page.getByTestId("operations-detail-pending-accounts");
  await expect(dialog).toBeVisible();
  return { trigger, dialog };
}

test.describe("Pending Accounts dialog continuity", () => {
  test("supports consecutive approve and deny decisions", async ({ app }) => {
    const accounts = await seedPending(app.page, ["First", "Second", "Third"]);
    const { dialog } = await openDialog(app.page);
    await expect(dialog.getByTestId("operations-pending-accounts-remaining")).toHaveText("3 remaining");

    await dialog.locator(`[data-operations-pending-account="${accounts[0].id}"] [data-operations-quick-action="approve-account"]`).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(`[data-operations-pending-account="${accounts[0].id}"]`)).toHaveCount(0);
    await expect(dialog.getByTestId("operations-pending-accounts-remaining")).toHaveText("2 remaining");
    await expect(dialog.locator(`[data-operations-pending-account="${accounts[1].id}"]`)).toBeVisible();
    await expect(dialog.locator('[data-operations-quick-action="approve-account"]').first()).toBeFocused();

    await dialog.locator(`[data-operations-pending-account="${accounts[1].id}"] [data-operations-quick-action="reject-account"]`).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId("operations-pending-accounts-remaining")).toHaveText("1 remaining");

    await dialog.locator(`[data-operations-pending-account="${accounts[2].id}"] [data-operations-quick-action="approve-account"]`).click();
    await expect(dialog).not.toBeVisible();
    const statuses = await app.page.evaluate(ids => ids.map(id => accountService.getById(id)?.status), accounts.map(account => account.id));
    expect(statuses).toEqual(["approved", "rejected", "approved"]);
  });

  test("failed mutation keeps the current account and shows an error", async ({ app }) => {
    const [account] = await seedPending(app.page, ["Failure"]);
    const { dialog } = await openDialog(app.page);
    await app.page.evaluate(() => {
      window.__originalApproveAccount = accountService.approveAccount;
      accountService.approveAccount = () => ({ success: false, message: "Hosted approval failed." });
    });
    const button = dialog.locator(`[data-operations-pending-account="${account.id}"] [data-operations-quick-action="approve-account"]`);
    await button.click();
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(`[data-operations-pending-account="${account.id}"]`)).toBeVisible();
    await expect(dialog.getByTestId("operations-pending-accounts-status")).toContainText("Hosted approval failed");
    await expect(button).toBeFocused();
    await app.page.evaluate(() => { accountService.approveAccount = window.__originalApproveAccount; });
  });

  test("Escape and Close preserve native dialog focus restoration", async ({ app }) => {
    await seedPending(app.page, ["Keyboard"]);
    let opened = await openDialog(app.page);
    await app.page.keyboard.press("Escape");
    await expect(opened.dialog).not.toBeVisible();
    await expect(opened.trigger).toBeFocused();

    opened = await openDialog(app.page);
    await opened.dialog.getByRole("button", { name: /close pending accounts/i }).click();
    await expect(opened.dialog).not.toBeVisible();
    await expect(opened.trigger).toBeFocused();
  });
});
