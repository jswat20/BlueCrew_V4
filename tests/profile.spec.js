import { test, expect } from "@playwright/test";

test.describe("Unified Crew Card profile self-service", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.removeItem("bluecrew_accounts"); localStorage.removeItem("bluecrew_session");
      const crewMember = crewService.getAll()[0];
      const created = accountService.createAccount({ firstName:"Test", lastName:"Umpire", email:"profile@test.com", phone:"5551112222", homePhone:"5552223333", address:"100 Main Street", emergencyContact:"Pat Umpire", emergencyContactPhone:"5553334444", role:"umpire" });
      accountService.approveAccount(created.data.id, crewMember?.id || null);
      loginService.login(created.data.email); authService.loginAsUmpire(crewMember?.id); document.body.dataset.role="umpire"; renderPage("profile");
    });
  });

  async function edit(page) { const reveal = page.getByTestId("profile-card-back"); if (await reveal.count()) await reveal.click(); await page.getByTestId("profile-edit-crew-card").click(); await expect(page.getByTestId("crew-card-self-edit-mode")).toBeVisible(); }

  test("Profile opens the canonical own Crew Card with protected facts", async ({ page }) => {
    await expect(page.getByTestId("profile-crew-card-experience")).toBeVisible();
    await expect(page.getByTestId("profile-card-back")).toHaveText("View My Information");
    await page.getByTestId("profile-card-back").click();
    await expect(page.getByTestId("crew-card-back")).toContainText("Mike Johnson");
    await expect(page.getByTestId("crew-card-back")).toContainText("mike.johnson@example.com");
    await expect(page.getByTestId("crew-card-back")).not.toContainText("profile@test.com");
    await expect(page.getByTestId("crew-card-back")).toContainText("Pat Umpire");
    await edit(page);
    await expect(page.getByTestId("profile-login-email-readonly")).toHaveValue("profile@test.com");
    await expect(page.getByTestId("profile-login-email-readonly")).toHaveAttribute("readonly", "");
    await expect(page.locator("#crew-active, .crew-level-checkbox, .crew-preferred-level-checkbox, [data-testid='crew-card-password-reset']")).toHaveCount(0);
  });

  test("edits owned contact and emergency fields independently", async ({ page }) => {
    await edit(page);
    await page.getByTestId("profile-phone").fill("5559998888");
    await page.getByTestId("profile-home-phone").fill("5558887777");
    await page.getByTestId("profile-address").fill("250 Updated Avenue");
    await page.getByTestId("profile-contact-preference").selectOption("call");
    await page.getByTestId("profile-emergency-contact").fill("Jordan Umpire");
    await page.getByTestId("profile-emergency-phone").fill("5557776666");
    await page.getByTestId("profile-save").click();
    await expect(page.getByTestId("profile-success")).toHaveText("Profile saved.");
    await edit(page);
    await expect(page.getByTestId("profile-phone")).toHaveValue("(555) 999-8888");
    await expect(page.getByTestId("profile-home-phone")).toHaveValue("(555) 888-7777");
    await expect(page.getByTestId("profile-address")).toHaveValue("250 Updated Avenue");
    await expect(page.getByTestId("profile-contact-preference")).toHaveValue("call");
    await expect(page.getByTestId("profile-emergency-contact")).toHaveValue("Jordan Umpire");
    await expect(page.getByTestId("profile-emergency-phone")).toHaveValue("(555) 777-6666");
  });

  test("Cancel discards edits and security remains outside the card editor", async ({ page }) => {
    await edit(page); await page.getByTestId("profile-phone").fill("5550000000");
    await page.getByRole("button", { name:"Cancel" }).first().click();
    await expect(page.getByTestId("profile-account-security")).toBeVisible();
    await expect(page.getByTestId("profile-change-password")).toBeVisible();
    await edit(page); await expect(page.getByTestId("profile-phone")).toHaveValue("5551112222");
  });

  test("persists through page reload", async ({ page }) => {
    await edit(page); await page.getByTestId("profile-address").fill("500 Persistent Road"); await page.getByTestId("profile-save").click(); await page.reload();
    await page.evaluate(() => { const account=loginService.getCurrentAccount(); authService.loginAsUmpire(account?.crewId); document.body.dataset.role="umpire"; renderPage("profile"); });
    await page.getByTestId("profile-card-back").click();
    await expect(page.getByTestId("profile-crew-card-experience")).toContainText("500 Persistent Road");
  });
});
