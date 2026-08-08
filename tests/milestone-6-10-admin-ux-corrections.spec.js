import { test, expect } from "./fixtures/app.fixture.js";
import AxeBuilder from "@axe-core/playwright";

async function openNeedsAssignmentDialog(app) {
  return app.page.evaluate(() => {
    authService.loginAsAdmin(); document.body.dataset.role = "admin";
    const game = gameService.create({ date: "2026-08-12", time: "18:00", level: "12U", locationComplex: "Lake Shore Athletic Complex", locationField: "Field 8", field: "Field 8", awayTeam: "Visitors", homeTeam: "Home", gameType: "single" }).data;
    navigateTo("assigner-workbench"); return game.id;
  });
}

test("Needs Assignment renders MM/DD/YY without changing the canonical date", async ({ app }) => {
  const gameId = await openNeedsAssignmentDialog(app);
  const row = app.page.getByTestId("workbench-needs-assignment-item").filter({ hasText: "Visitors @ Home" }).first();
  await expect(row.locator(".workbench-mini-game-date")).toHaveText("08/12/26");
  expect(await app.page.evaluate(id => gameService.getById(id).date, gameId)).toBe("2026-08-12");
});

test("compact Workbench Game Details header has left, centered, and right status structure", async ({ app }) => {
  await openNeedsAssignmentDialog(app);
  await app.page.getByTestId("workbench-needs-assignment-item").filter({ hasText: "Visitors @ Home" }).first().click();
  const dialog = app.page.getByTestId("workbench-game-dialog");
  const header = dialog.getByTestId("game-hub-admin-statuses");
  await expect(header.getByRole("heading", { name: "Game Details" })).toBeVisible();
  await expect(header.getByTestId("game-hub-admin-lifecycle-status")).toContainText("Scheduled");
  await expect(header.getByTestId("game-hub-admin-assignment-status")).toContainText("Needs Assignment");
  const geometry = await header.evaluate(element => {
    const [title, lifecycle, assignment] = [...element.children].map(child => child.getBoundingClientRect());
    return { ordered: title.left < lifecycle.left && lifecycle.left < assignment.left, lifecycleDelta: Math.abs((lifecycle.left + lifecycle.right) / 2 - (element.getBoundingClientRect().left + element.getBoundingClientRect().right) / 2) };
  });
  expect(geometry.ordered).toBeTruthy(); expect(geometry.lifecycleDelta).toBeLessThan(20);
});

test("Calendar navigation omits Today while preserving Calendar View and All Games", async ({ app }) => {
  await app.page.evaluate(() => { authService.loginAsAdmin(); document.body.dataset.role = "admin"; renderPage("schedule"); });
  await expect(app.page.getByTestId("view-daily")).toHaveText("Calendar View");
  await expect(app.page.getByTestId("view-all-games")).toBeVisible();
  await expect(app.page.getByTestId("schedule-view-tabs").getByTestId("today")).toHaveCount(0);
  await expect(app.page.getByTestId("toolbar-today")).toHaveCount(0);
  await app.page.getByTestId("view-daily").click();
  await expect(app.page.getByRole("button", { name: "Previous schedule date" })).toBeVisible();
});

test("Claim History uses compact shared rows with U labels and AM/PM time", async ({ app }) => {
  await app.createPendingClaim({ date: "2099-08-12", time: "18:00", homeTeam: "History Home", awayTeam: "History Away" });
  await app.page.evaluate(() => { authService.loginAsAdmin(); document.body.dataset.role = "admin"; renderPage("claims-queue"); });
  await app.page.locator('[data-testid^="approve-claim-"]').first().click();
  await app.page.evaluate(() => renderPage("claim-history"));
  const card = app.page.getByTestId("approved-claim-card").first();
  await expect(card).toHaveClass(/shared-notification-row/);
  await expect(card).toContainText("6:00 PM");
  await expect(card).toContainText("U1");
  await expect(card).not.toContainText(/\bPlate\b|18:00/);
  expect(await card.evaluate(element => element.getBoundingClientRect().height)).toBeLessThanOrEqual(72);
});

test("Admin Profile Details uses three, two, and one deliberate columns", async ({ app }) => {
  await app.page.setViewportSize({ width: 1280, height: 900 });
  await app.loginAsApprovedUmpire();
  await app.page.evaluate(() => {
    authService.loginAsAdmin();
    document.body.dataset.role = "admin";
    document.body.dataset.page = "profile";
    renderPage("profile");
  });
  const grid = app.page.locator(".profile-details-grid");
  const columns = async () => grid.evaluate(element => {
    const value = getComputedStyle(element).gridTemplateColumns;
    const repeat = value.match(/^repeat\((\d+)/);
    return repeat ? Number(repeat[1]) : value.split(/\s+/).length;
  });
  expect(await columns()).toBe(3);
  await app.page.setViewportSize({ width: 800, height: 900 });
  expect(await columns()).toBe(2);
  await app.page.setViewportSize({ width: 600, height: 900 }); expect(await columns()).toBe(1);
  await expect(app.page.getByTestId("profile-save")).toBeVisible();
  await expect(app.page.getByTestId("profile-cancel")).toBeVisible();
});

test("Claim History scroll region remains keyboard accessible and WCAG-clean", async ({ app }) => {
  await app.createPendingClaim({ date: "2099-08-12", time: "09:30" });
  await app.page.evaluate(() => { authService.loginAsAdmin(); document.body.dataset.role = "admin"; renderPage("claims-queue"); });
  await app.page.locator('[data-testid^="approve-claim-"]').first().click();
  await app.page.evaluate(() => renderPage("claim-history"));
  await app.page.setViewportSize({ width: 600, height: 800 });
  const section = app.page.getByTestId("claim-history-approved"); await section.focus(); await expect(section).toBeFocused();
  const dimensions = await section.evaluate(element => ({ client: element.clientWidth, scroll: element.scrollWidth }));
  expect(dimensions.scroll).toBeGreaterThan(dimensions.client);
  const axe = await new AxeBuilder({ page: app.page }).include("#app-content").withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations).toEqual([]);
});
