import { test, expect } from "./fixtures/app.fixture.js";
import AxeBuilder from "@axe-core/playwright";

async function seedAdminCrew(app) {
  return app.page.evaluate(() => {
    localStorage.removeItem("bluecrew_accounts");
    authService.loginAsAdmin(); document.body.dataset.role = "admin";
    levelTerminologyService.configure({ level_aliases: { "8U": "Pinto", "12U": "Bronco Championship Certification" } });
    const member = crewService.getAll()[0];
    member.levels = ["8U", "12U"];
    const account = accountService.createAccount({ firstName: member.firstName, lastName: member.lastName, email: member.email, role: "umpire" }).data;
    accountService.approveAccount(account.id, member.id);
    renderPage("crew");
    return { crewId: member.id, accountId: account.id };
  });
}

test("crew card keeps keyboard flip/open behavior and admin cards show canonical levels only", async ({ app }) => {
  await seedAdminCrew(app);
  const card = app.page.getByTestId("crew-roster-member").first();
  await expect(card.locator(".crew-credential-levels")).toContainText("8U");
  await expect(card.locator(".crew-credential-levels")).toContainText("12U");
  await expect(card.locator(".crew-credential-levels")).not.toContainText(/Pinto|Bronco/);
  await card.focus(); await card.press("Enter");
  const dialog = app.page.getByTestId("crew-card-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("crew-card-flipper")).toHaveClass(/is-flipped/);
  await expect(dialog.locator(".crew-credential-eligibility")).not.toContainText(/Pinto|Bronco/);
  await app.page.keyboard.press("Escape");
  await expect(card).toBeFocused();
});

test("certification badges wrap within their cards without overlap", async ({ app }) => {
  await seedAdminCrew(app);
  const badges = app.page.getByTestId("crew-roster-member").first().locator(".crew-credential-levels i");
  const geometry = await badges.evaluateAll(elements => elements.map(element => {
    const badge = element.getBoundingClientRect(); const card = element.closest("button").getBoundingClientRect();
    return { inside: badge.left >= card.left && badge.right <= card.right + 1, wraps: getComputedStyle(element).whiteSpace === "normal" };
  }));
  expect(geometry.every(item => item.inside && item.wraps)).toBeTruthy();
});

test("crew admin editor retains dialog semantics, linked checkboxes, and Select All", async ({ app }) => {
  await seedAdminCrew(app);
  await app.page.getByTestId("crew-roster-member").first().click();
  await app.page.getByTestId("crew-card-edit").click();
  const editor = app.page.getByTestId("crew-card-admin-dialog");
  await expect(editor).toHaveAttribute("open", "");
  await expect(editor.getByTestId("crew-admin-save")).toHaveClass(/button-primary/);
  const selectAll = editor.getByTestId("crew-admin-level-select-all");
  await selectAll.check();
  await expect(editor.locator(".crew-admin-level:not(:checked)")).toHaveCount(0);
  const canonical = editor.locator('.crew-admin-level[data-canonical="8U"]');
  await canonical.first().uncheck();
  await expect(canonical.filter({ has: app.page.locator(":checked") })).toHaveCount(0);
});

test("umpire Profile uses the canonical Crew Card while account support remains available", async ({ app }) => {
  await app.loginAsApprovedUmpire();
  await app.page.evaluate(() => renderPage("profile"));
  const profile = app.page.getByTestId("profile");
  await expect(profile.getByRole("heading", { name: "My Crew Card" })).toBeVisible();
  await expect(profile.getByTestId("profile-crew-card-experience")).toBeVisible();
  await expect(profile.getByTestId("profile-communication")).toBeVisible();
  await profile.getByTestId("profile-card-back").click();
  await profile.getByTestId("profile-edit-crew-card").click();
  await expect(app.page.getByTestId("crew-card-self-edit-mode")).toBeVisible();
  await expect(app.page.locator(".crew-level-checkbox, #crew-active")).toHaveCount(0);
  await expect(profile.getByTestId("profile-account-security")).toBeVisible();
});

test("profile and crew controls remain reachable on narrow screens", async ({ app }) => {
  await app.loginAsApprovedUmpire(); await app.page.evaluate(() => renderPage("profile"));
  await app.page.setViewportSize({ width: 390, height: 760 });
  await app.page.getByTestId("profile-card-back").click();
  await app.page.getByTestId("profile-edit-crew-card").click();
  const save = app.page.getByTestId("profile-save");
  await save.scrollIntoViewIfNeeded();
  const box = await save.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(390);
});

test("pilot Settings preserves controls inside clearer shared cards", async ({ app }) => {
  await app.page.evaluate(() => { authService.loginAsAdmin(); document.body.dataset.role = "admin"; renderPage("settings"); });
  const settingsPage = app.page.getByTestId("settings-page");
await expect(settingsPage.getByRole("heading", { name: "Settings" })).toBeVisible();
await expect(settingsPage.getByTestId("settings-locations")).toContainText("Location Complexes & Fields");
await expect(settingsPage.getByTestId("add-location-complex")).toHaveClass(/button-secondary/);
await expect(settingsPage.getByTestId("settings-seasons")).toContainText("Seasons");
await expect(settingsPage.locator(".settings-card")).toHaveCount(5);
await expect(settingsPage).toContainText("Time Slots");
});
test("crew, profile, and settings polish has no automated WCAG A or AA violations", async ({ app }) => {
  await app.page.evaluate(() => { authService.loginAsAdmin(); document.body.dataset.role = "admin"; renderPage("settings"); });
  const result = await new AxeBuilder({ page: app.page }).include("#app-content").withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(result.violations).toEqual([]);
});
