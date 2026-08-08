import { test, expect } from "./fixtures/app.fixture.js";
import AxeBuilder from "@axe-core/playwright";

async function seedUmpireGame(app, { assigned = false, level = "6U" } = {}) {
  await app.loginAsApprovedUmpire();
  return app.page.evaluate(({ assigned, level }) => {
    const account = loginService.getCurrentAccount(); const crewId = authService.currentCrewId();
    levelTerminologyService.configure({ level_aliases: { "6U": "Clinic", "8U": "Pinto" } });
    const game = gameService.create({ date: "2099-08-10", time: "18:30", level, locationComplex: "Lake Shore Athletic Complex", locationField: "Field 8", field: "Field 8", awayTeam: "Hidden Away", homeTeam: "Hidden Home", gameType: "single" }).data;
    authService.loginAsAdmin();
    if (assigned) assignmentService.assignToAssignment(game.id, assignmentService.getAssignments(game)[0].id, crewId);
    else assignmentService.openForClaims(game.id);
    authService.useAuthenticatedAccount(account);
    return game.id;
  }, { assigned, level });
}

test("Action Center renders three distinct centered cells with red centered counts and responsive reflow", async ({ app }) => {
  await app.loginAsApprovedUmpire(); await app.page.evaluate(() => renderPage("dashboard"));
  const cells = app.page.getByTestId("crew-action-cell");
  await expect(cells).toHaveCount(3);
  for (const cell of await cells.all()) {
    await expect(cell).toHaveCSS("text-align", "center");
    await expect(cell.locator(":scope > b")).toHaveCSS("color", "rgb(217, 45, 32)");
    const centered = await cell.locator(":scope > b").evaluate(element => getComputedStyle(element).placeItems.includes("center"));
    expect(centered).toBeTruthy();
  }
  const desktop = await cells.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().top));
  expect(new Set(desktop.map(Math.round)).size).toBe(1);
  await app.page.setViewportSize({ width: 390, height: 800 });
  const mobile = await cells.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().top));
  expect(new Set(mobile.map(Math.round)).size).toBe(3);
});

test("dashboard notification summary uses alias, date, and AM/PM without matchup or location", async ({ app }) => {
  const gameId = await seedUmpireGame(app, { assigned: true });
  await app.page.evaluate(gameId => {
    notificationService.create({ type: "claim-approved", title: "Claim Approved", message: "Hidden Away @ Hidden Home", audience: "umpire", relatedId: gameId, destination: { page: "game-hub", context: { gameId } } });
    renderPage("dashboard");
  }, gameId);
  const row = app.page.getByTestId("crew-dashboard-notifications").locator(".shared-notification-row").first();
  await expect(row).toContainText("Claim Approved");
  await expect(row).toContainText("Clinic game - Aug 10 at 6:30 PM");
  await expect(row).not.toContainText(/Hidden Away|Hidden Home|Lake Shore|Field 8|6U - Clinic/);
  await expect(row.getByRole("button", { name: "Open" })).toBeVisible();
});

test("Claim Games is compact, centered, normalized, team-free, and keeps Claim", async ({ app }) => {
  const gameId = await seedUmpireGame(app);
  await app.page.evaluate(() => renderPage("claim-games"));
  const table = app.page.locator(".claim-games-table"); const row = app.page.getByTestId(`claim-game-row-${gameId}`);
  await expect(table.getByRole("columnheader", { name: "Teams" })).toHaveCount(0);
  await expect(row).toContainText("Lake Shore Athletic Complex");
  await expect(row).toContainText("Field 8");
  await expect(row).not.toContainText(/Hidden Away|Hidden Home|Lake Shore Athletic Complex - Field 8/);
  await expect(row).toContainText("6:30 PM");
  await expect(row.getByTestId(`claim-game-${gameId}`)).toHaveText("Claim");
  expect(await row.evaluate(element => element.getBoundingClientRect().height)).toBeLessThanOrEqual(56);
  for (const cell of await table.locator("th, td").all()) await expect(cell).toHaveCSS("text-align", "center");
});

test("My Schedule centers normalized fields and moves decline into Game Hub", async ({ app }) => {
  const gameId = await seedUmpireGame(app, { assigned: true });
  await app.page.evaluate(() => renderPage("my-schedule"));
  const table = app.page.getByTestId("my-schedule-table"); const row = app.page.getByTestId(`my-schedule-row-${gameId}`);
  await expect(row).toContainText("Lake Shore Athletic Complex"); await expect(row).toContainText("Field 8");
  await expect(row).not.toContainText("Lake Shore Athletic Complex - Field 8");
  await expect(row.getByTestId(`my-schedule-status-${gameId}`)).toHaveText("Assigned");
  await expect(row.getByText("Decline Assignment")).toHaveCount(0);
  const open = row.getByTestId(`my-schedule-open-game-${gameId}`); await expect(open).toHaveText("Open Game Hub");
  for (const cell of await table.locator("th, td").all()) await expect(cell).toHaveCSS("text-align", "center");
  await open.click(); await expect(app.page.getByTestId("game-hub-decline-assignment")).toBeVisible();
});

test("Profile Crew Information uses three facts and hides eligibility/history only there", async ({ app }) => {
  await app.loginAsApprovedUmpire(); await app.page.evaluate(() => renderPage("profile"));
  const facts = app.page.getByTestId("profile-credentials").locator(".profile-credential-grid > div");
  await expect(facts).toHaveCount(3);
  const tops = await facts.evaluateAll(elements => elements.map(element => Math.round(element.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(1);
  await expect(app.page.getByTestId("profile-crew-card")).not.toContainText(/Age Eligibility|Official History|6U|8U|10U|12U/);
  await expect(app.page.getByTestId("profile-credentials")).not.toContainText(/Age Eligibility|Official History/);
  await app.page.evaluate(() => { authService.loginAsAdmin(); document.body.dataset.role = "admin"; renderPage("crew"); });
  await app.page.getByTestId("crew-roster-member").first().click();
  await expect(app.page.getByTestId("crew-card-back")).toContainText("Age Eligibility");
  await expect(app.page.getByTestId("crew-card-back")).toContainText("Official History");
});

test("narrow tables scroll instead of crushing and remain keyboard focusable", async ({ app }) => {
  await seedUmpireGame(app); await app.page.evaluate(() => renderPage("claim-games"));
  await app.page.setViewportSize({ width: 600, height: 800 });
  const wrapper = app.page.locator(".claim-games-compact .presentation-table-wrapper");
  const dimensions = await wrapper.evaluate(element => ({ client: element.clientWidth, scroll: element.scrollWidth }));
  expect(dimensions.scroll).toBeGreaterThan(dimensions.client);
  await wrapper.focus(); await expect(wrapper).toBeFocused();
  expect(await app.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test("corrected umpire table has no automated WCAG A or AA violations", async ({ app }) => {
  await seedUmpireGame(app); await app.page.evaluate(() => renderPage("claim-games"));
  const result = await new AxeBuilder({ page: app.page }).include("#app-content").withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(result.violations).toEqual([]);
});
