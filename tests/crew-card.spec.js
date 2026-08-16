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
    await expect(trigger).toContainText("@");
    await expect(trigger).not.toContainText(/BC-\d{4}-/);
    await expect(trigger).not.toContainText("Baseball Umpire");
    await trigger.focus();
    await trigger.press("Enter");
    const dialog = page.getByTestId("crew-card-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId("crew-card-back")).toContainText("Contact Information");
    await expect(dialog.getByTestId("crew-card-view-official-history")).toBeVisible();
    await expect(dialog).not.toContainText("Detailed identity, contact, eligibility");
    await expect(dialog.getByTestId("crew-card-back")).not.toContainText("Eligible Age Ranges");
    await expect(dialog.getByTestId("crew-card-back")).not.toContainText("Issued:");
    await expect(dialog.locator(".crew-card-site-logo")).toHaveAttribute("src", "assets/the-slate-logo.png");
    await expect(dialog.getByTestId("crew-card-flipper")).toHaveClass(/is-flipped/);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("compact roster cards show contact data and invoke the credential implementation", async ({ page }) => {
    await seedLinkedCrew(page);
    const trigger = page.getByTestId("crew-roster-member").first();
    await expect(trigger).toHaveClass(/crew-roster-credential/);
    await expect(trigger.locator(".crew-credential-contact-summary")).toContainText("@");
    await trigger.click();
    await expect(page.locator("#crew-credential-dialog")).toBeVisible();
    await expect(page.locator("#crew-card-dialog")).toHaveCount(0);
  });

  test("photo and fallback stay in the detailed card rather than the compact card", async ({ page }) => {
    await seedLinkedCrew(page, "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=");
    const compact = page.getByTestId("crew-roster-member").first();
    await expect(compact.locator("img")).toHaveCount(0);
    await compact.click();
    await expect(page.getByTestId("crew-card-flipper")).toHaveClass(/is-flipped/);
    await expect(page.getByTestId("crew-card-dialog").locator(".crew-credential-face-back .crew-credential-photo")).toBeVisible();
    await page.getByTestId("crew-card-dialog").getByRole("button", { name: "Close" }).click();
    await page.evaluate(() => {
      const account = accountService.getAll().find(item => item.crewId);
      accountService.updateCrewProfileAsAdmin(account.id, { photoDataUrl: "" });
      renderPage("crew");
    });
    await page.getByTestId("crew-roster-member").first().click();
    await expect(page.getByTestId("crew-card-dialog").locator(".crew-credential-face-back .crew-credential-photo-fallback")).toBeVisible();
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

  test("expanded card stays within the browser viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.getByTestId("nav-crew").click();
    await page.getByTestId("crew-roster-member").first().click();
    const dialog = page.getByTestId("crew-card-dialog");
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(720);
    await expect(dialog).toHaveCSS("overflow-y", "auto");
    const backOverflow = await dialog.locator(".crew-credential-face-back").evaluate(card => card.scrollHeight - card.clientHeight);
    expect(backOverflow).toBeLessThanOrEqual(1);
  });

  test("admin editor saves structured profile data while Crew ID stays read-only", async ({ page }) => {
    const seeded = await seedLinkedCrew(page);
    await page.getByTestId("crew-roster-member").first().click();
    await page.getByTestId("crew-card-edit").click();
    const editor = page.getByTestId("crew-card-admin-dialog");
    await expect(editor.getByTestId("crew-admin-id")).toHaveAttribute("readonly", "");
    await editor.locator("#crew-admin-birthdate").fill("1988-05-20");
    await editor.getByTestId("crew-admin-years").fill("7");
    await editor.locator("#crew-admin-history").fill("2025|1st Year|\n2026|2nd Year|");
    await editor.getByTestId("crew-admin-save").click();
    const saved = await page.evaluate(accountId => accountService.getProfile(accountId), seeded.accountId);
    expect(saved.birthdate).toBe("1988-05-20");
    expect(saved.yearsOfService).toBe(7);
  });

  test("official history opens read-only with focus entry, Escape close, and focus return", async ({ page }) => {
    const seeded = await seedLinkedCrew(page);
    await page.evaluate(accountId => {
      accountService.updateCrewProfileAsAdmin(accountId, {
        adminNotes: "Strong communicator\nArrives prepared"
      });
      renderPage("crew");
    }, seeded.accountId);
    await page.getByTestId("crew-roster-member").first().click();
    const back = page.getByTestId("crew-card-back");
    await expect(back.getByTestId("crew-card-identity-eligibility")).toContainText("Eligibility");
    await expect(back.locator(".crew-credential-history-launch")).toContainText("2 Seasons");
    const trigger = back.getByTestId("crew-card-view-official-history");
    await trigger.click();
    const history = page.getByTestId("official-history-dialog");
    await expect(history).toBeVisible();
    await expect(history.getByTestId("official-history-records").locator("li")).toHaveCount(2);
    await expect(history.getByTestId("official-history-close")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(history).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(back.locator(".crew-credential-notes li")).toHaveCount(2);
  });

  test("profile back expands and wraps at desktop and mobile widths", async ({ page }) => {
    const seeded = await seedLinkedCrew(page);
    await page.evaluate(accountId => {
      accountService.updateCrewProfileAsAdmin(accountId, { address: "123 Extremely Long Municipal Recreation Boulevard Apartment 456, Chesapeake Beach, Maryland 20732", emergencyContact: "A Very Long Emergency Contact Name" });
      const account = accountService.getById(accountId); loginService.login(account.email); authService.loginAsCrew(account.crewId); document.body.dataset.role = "umpire"; renderPage("profile"); showProfileCardSide(true);
    }, seeded.accountId);
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const card = page.getByTestId("profile-crew-card-experience");
      await expect(card.getByTestId("crew-card-back")).toBeVisible();
      expect(await card.locator(".profile-card-stage").evaluate(element => {
        const rect = element.getBoundingClientRect();
        return rect.left >= 0 && rect.right <= window.innerWidth;
      })).toBe(true);
      await expect(card.getByText(/Extremely Long Municipal/)).toBeVisible();
    }
  });

  test("profile back groups approved history, workload, eligibility, and contact sections while hiding login internals", async ({ page }) => {
    const seeded = await seedLinkedCrew(page);
    await page.evaluate(async accountId => {
      const account = accountService.getById(accountId);
      await crewService.updateMember(account.crewId, { levels: ["6U", "8U", "10U", "Juniors", "Seniors"] });
      loginService.login(account.email); authService.loginAsCrew(account.crewId); document.body.dataset.role = "umpire"; renderPage("profile"); showProfileCardSide(true);
    }, seeded.accountId);
    const back = page.getByTestId("crew-card-back");
    const summary = back.locator(".profile-card-back-summary");
    await expect(back.locator(".crew-credential-photo")).toHaveCount(0);
    await expect(summary.getByTestId("crew-card-view-official-history")).toBeVisible();
    await expect(summary).toContainText("2 Seasons");
    await expect(summary).toContainText("Games Today");
    await expect(summary).toContainText("Season Total");
    const eligibility = back.getByTestId("crew-card-identity-eligibility");
    await expect(eligibility.locator(".settings-pill")).toHaveText(["6U", "8U", "10U", "JR", "SR"]);
    expect(await eligibility.evaluate((element, summaryElement) => summaryElement.contains(element), await summary.elementHandle())).toBe(true);
    const centeredValues = await summary.locator(".crew-credential-age > div").evaluateAll(elements => elements.every(element => getComputedStyle(element).textAlign === "center"));
    expect(centeredValues).toBe(true);
    await expect(back).not.toContainText("Login Identity");
    await expect(back).not.toContainText("Login Email");
  });
});
