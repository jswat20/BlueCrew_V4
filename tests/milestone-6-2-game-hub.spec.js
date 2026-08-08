import { test, expect } from "./fixtures/app.fixture.js";
import AxeBuilder from "@axe-core/playwright";

async function createAdminGame(page, gameType = "fourMan", overrides = {}) {
  return page.evaluate(({ gameType, overrides }) => {
    authService.loginAsAdmin();
    document.body.dataset.role = "admin";
    const created = gameService.create({
      date: "2031-08-12", time: "18:00", locationComplex: "Lake Shore Athletic Complex",
      locationField: "3", field: "3", level: "16U", homeTeam: "Home Club",
      awayTeam: "Away Club", gameType, ...overrides
    }).data;
    renderPage("game-hub", { gameId: created.id, origin: "assigner-workbench", returnPage: "assigner-workbench" });
    return created.id;
  }, { gameType, overrides });
}

test.describe("Milestone 6.2 Game Hub redesign", () => {
  test("admin page has one matchup and one consolidated details card", async ({ app }) => {
    await createAdminGame(app.page);
    const hub = app.page.getByTestId("game-hub");
    await expect(hub.locator(".game-hub-admin-heading")).not.toContainText("Game Hub");
    await expect(hub.getByText("Away Club @ Home Club", { exact: true })).toHaveCount(1);
    await expect(hub.getByTestId("game-hub-admin-details")).toHaveCount(1);
    await expect(hub.getByTestId("game-hub-admin-statuses").locator(".status-badge")).toHaveCount(2);
    for (const testId of ["game-hub-summary-level", "game-hub-summary-date", "game-hub-summary-location", "game-hub-summary-field", "game-hub-summary-time"]) {
      await expect(hub.getByTestId(testId)).toBeVisible();
    }
    await expect(hub.getByTestId("game-hub-summary-date")).toContainText("August 12, 2031");
    await expect(hub.getByTestId("game-hub-summary-time")).toContainText("6:00 PM");
    await expect(hub).not.toContainText("undefined");
  });

  for (const [gameType, labels] of [
    ["single", ["U1"]], ["twoMan", ["U1", "U2"]],
    ["threeMan", ["U1", "U2", "U3"]], ["fourMan", ["U1", "U2", "U3", "U4"]]
  ]) {
    test(`admin officials renders ${labels.length} required row(s) for ${gameType}`, async ({ app }) => {
      await createAdminGame(app.page, gameType);
      const slots = app.page.getByTestId("game-hub-admin-crew").locator(".game-hub-command-slot");
      await expect(slots).toHaveCount(labels.length);
      await expect(slots.locator(":scope > span")).toHaveText(labels);
      await expect(slots.getByRole("button", { name: "Assign Crew" })).toHaveCount(labels.length);
    });
  }

  test("assigned official name replaces Assign Crew and retains destructive removal", async ({ app }) => {
    const gameId = await createAdminGame(app.page, "single");
    const name = await app.page.evaluate(id => {
      const game = gameService.getById(id);
      const assignment = assignmentService.getAssignments(game)[0];
      const crew = crewService.getAll()[0];
      assignment.crewId = crew.id;
      assignment.status = "assigned";
      gameService.save();
      renderPage("game-hub", { gameId: id, origin: "assigner-workbench", returnPage: "assigner-workbench" });
      return crewService.getDisplayName(crew.id);
    }, gameId);
    const slot = app.page.locator(".game-hub-command-slot");
    await expect(slot).toContainText(name);
    await expect(slot.getByRole("button", { name: "Assign Crew" })).toHaveCount(0);
    await expect(slot.getByRole("button", { name: "Remove Crew Member" })).toHaveClass(/button-danger/);
  });

  test("Crew Notes dialog has a spaced accessible empty state", async ({ app }) => {
    await createAdminGame(app.page, "twoMan");
    await app.page.getByTestId("game-hub-open-crew-notes").click();
    const dialog = app.page.getByTestId("game-hub-crew-notes-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("status")).toContainText("No assigned crew notes");
    expect(await dialog.locator(".game-hub-admin-notes").evaluate(el => parseFloat(getComputedStyle(el).paddingTop))).toBeGreaterThan(12);
  });

  test("admin back navigation respects Operations Center and Workbench origins", async ({ app }) => {
    const gameId = await createAdminGame(app.page, "single");
    await app.page.evaluate(id => renderPage("game-hub", { gameId: id, origin: "operations-center", returnPage: "operations-center" }), gameId);
    await expect(app.page.getByTestId("game-hub-back")).toContainText("Back to Ops Center");
    await app.page.getByTestId("game-hub-back").click();
    await expect(app.page.locator("body")).toHaveAttribute("data-page", "operations-center");
    await app.page.evaluate(id => renderPage("game-hub", { gameId: id, origin: "assigner-workbench", returnPage: "assigner-workbench" }), gameId);
    await expect(app.page.getByTestId("game-hub-back")).toContainText("Back to Assigner Workbench");
  });

  test("umpire summary uses three clean rows, shared position labels, and AM/PM", async ({ app }) => {
    await app.page.evaluate(() => {
      const account = accountService.createAccount({ firstName: "Mira", lastName: "Umpire", email: `mira.${Date.now()}@example.com`, password: "password123" }).data;
      accountService.approveAccount(account.id);
      const crew = crewService.getAll()[0];
      accountService.updateAccount(account.id, { crewId: crew.id });
      loginService.login(account.email, "password123");
      authService.loginAsUmpire();
      const game = gameService.create({ date: "2031-08-12", time: "18:00", locationComplex: "Lake Shore", field: "3", level: "16U", homeTeam: "Home", awayTeam: "Away", gameType: "twoMan" }).data;
      const assignment = assignmentService.getAssignments(game)[1];
      assignment.crewId = crew.id; assignment.status = "assigned"; gameService.save();
      renderPage("game-hub", { gameId: game.id });
    });
    await expect(app.page.getByTestId("game-hub-umpire-status-row")).toContainText("Assigned");
    await expect(app.page.getByTestId("game-hub-umpire-status-row")).toContainText("Forecast");
    await expect(app.page.getByTestId("game-hub-umpire-details")).toBeVisible();
    await expect(app.page.getByTestId("game-hub-summary-position")).toContainText("U2");
    await expect(app.page.getByTestId("game-hub-summary-time")).toContainText("6:00 PM");
    await expect(app.page.getByTestId("game-hub-decline-assignment")).toBeVisible();
  });

  test("admin layout remains readable and accessible at mobile width", async ({ app }) => {
    await app.page.setViewportSize({ width: 390, height: 844 });
    await createAdminGame(app.page, "fourMan");
    const hub = app.page.getByTestId("game-hub");
    expect(await hub.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    const results = await new AxeBuilder({ page: app.page }).include('[data-testid="game-hub"]').withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(results.violations).toEqual([]);
  });
});
