import { test, expect } from "./fixtures/app.fixture.js";

async function seedLinkedCrew(page, photoDataUrl = "") {
  return page.evaluate(photo => {
    localStorage.removeItem("bluecrew_accounts");
    authService.loginAsAdmin();
    const member = crewService.getAll()[0];
    const account = accountService.createAccount({ firstName: member.firstName, lastName: member.lastName, email: member.email, phone: member.phone, birthdate: "1990-07-14", photoDataUrl: photo, officialHistory: [{ year: 2025, label: "1st Year" }, { year: 2026, label: "2nd Year" }] }).data;
    accountService.approveAccount(account.id, member.id);
    renderPage("crew");
    return { crewId: member.id, accountId: account.id };
  }, photoDataUrl);
}

test.describe("Reusable Crew Card", () => {
  test.beforeEach(async ({ page }) => { await page.goto("/"); });

  test("front opens an accessible flipped back and Escape restores focus", async ({ page }) => {
    await seedLinkedCrew(page);
    const trigger = page.getByTestId("crew-roster-member").first();
    await expect(trigger).toContainText(/BC-\d{4}-/);
    await trigger.focus();
    await trigger.press("Enter");
    const dialog = page.getByTestId("crew-card-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId("crew-card-back")).toContainText("Contact Information");
    await expect(dialog.getByTestId("crew-card-back")).toContainText("Official History");
    await expect(dialog.getByTestId("crew-card-flipper")).toHaveClass(/is-flipped/);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("photo and fallback both render", async ({ page }) => {
    await seedLinkedCrew(page, "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=");
    await expect(page.getByTestId("crew-roster-member").first().locator("img")).toBeVisible();
    await page.evaluate(() => {
      const account = accountService.getAll().find(item => item.crewId);
      accountService.updateCrewProfileAsAdmin(account.id, { photoDataUrl: "" });
      renderPage("crew");
    });
    await expect(page.getByTestId("crew-roster-member").first().locator(".crew-credential-photo-fallback")).toBeVisible();
  });

  test("admin edit is visible while crew users cannot access it", async ({ page }) => {
    const seeded = await seedLinkedCrew(page);
    await page.getByTestId("crew-roster-member").first().click();
    await expect(page.getByTestId("crew-card-edit")).toBeVisible();
    await page.getByTestId("crew-card-dialog").getByRole("button", { name: "Close" }).click();
    await page.evaluate(crewId => { authService.loginAsCrew(crewId); document.body.dataset.role = "umpire"; openCrewCard(crewId); }, seeded.crewId);
    await expect(page.getByTestId("crew-card-edit")).toHaveCount(0);
  });

  test("reduced motion removes the flip transition", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seedLinkedCrew(page);
    await page.getByTestId("crew-roster-member").first().click();
    await expect(page.getByTestId("crew-card-flipper")).toHaveCSS("transition-duration", "0s");
  });

  test("admin editor saves structured profile data while Crew ID stays read-only", async ({ page }) => {
    const seeded = await seedLinkedCrew(page);
    await page.getByTestId("crew-roster-member").first().click();
    await page.getByTestId("crew-card-edit").click();
    const editor = page.getByTestId("crew-card-admin-dialog");
    await expect(editor.getByTestId("crew-admin-id")).toHaveAttribute("readonly", "");
    await editor.locator("#crew-admin-birthdate").fill("1988-05-20");
    await editor.locator("#crew-admin-history").fill("2025|1st Year|\n2026|2nd Year|");
    await editor.getByTestId("crew-admin-save").click();
    const saved = await page.evaluate(accountId => accountService.getProfile(accountId), seeded.accountId);
    expect(saved.birthdate).toBe("1988-05-20");
    expect(saved.yearsOfService).toBe(2);
  });
});
