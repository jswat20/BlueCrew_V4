import { test, expect } from "./fixtures/app.fixture.js";
import AxeBuilder from "@axe-core/playwright";

async function createOperationsGames(page) {
  return page.evaluate(() => {
    games.splice(0, games.length);
    saveGames();
    authService.loginAsAdmin();
    document.body.dataset.role = "admin";
    const today = new Date().toISOString().split("T")[0];
    const definitions = [
      ["single", "Solo"], ["twoMan", "Two"], ["threeMan", "Three"], ["fourMan", "Four"]
    ];
    const crewMembers = crewService.getAll();
    const ids = definitions.map(([gameType, suffix], gameIndex) => {
      const game = gameService.create({
        id: `ops-63-${gameType}`,
        date: today, time: "18:00", level: "16U",
        locationComplex: `Lake Shore Athletic Complex With A Long ${suffix} Name`,
        locationField: "Field 3", field: "Field 3",
        homeTeam: `Extremely Long Home Team ${suffix}`,
        awayTeam: `Extremely Long Away Team ${suffix}`, gameType
      }).data;
      const assignments = assignmentService.getAssignments(game);
      assignments.slice(0, Math.min(gameIndex + 1, assignments.length)).forEach((assignment, index) => {
        const crew = crewMembers[index % crewMembers.length];
        assignment.crewId = crew.id;
        assignment.status = "assigned";
      });
      return game.id;
    });
    gameService.save();
    renderPage("operations-center");
    return ids;
  });
}

test.describe("Milestone 6.3 Operations Center polish", () => {
  test("staffing table provides wide Matchup/Location columns and one Umpire(s) column", async ({ app }) => {
    const ids = await createOperationsGames(app.page);
    const table = app.page.locator(".operations-staffing-table").first();
    await expect(table.locator("thead th")).toHaveText(["Time", "Level", "Matchup", "Location", "Umpire(s)"]);
    const widths = await table.locator("thead th").evaluateAll(cells => cells.map(cell => cell.getBoundingClientRect().width));
    expect(widths[2]).toBeGreaterThan(widths[0] * 2);
    expect(widths[3]).toBeGreaterThan(widths[1] * 2);
    expect(widths[4]).toBeGreaterThanOrEqual(240);
    await expect(table.getByText("Extremely Long Away Team Solo @ Extremely Long Home Team Solo", { exact: true })).toBeVisible();
    await expect(table.getByText("Lake Shore Athletic Complex With A Long Solo Name", { exact: true })).toBeVisible();
    expect(ids).toHaveLength(4);
  });

  test("Umpire(s) cells render exact U1-U4 models with names and OPEN treatment", async ({ app }) => {
    const ids = await createOperationsGames(app.page);
    for (let index = 0; index < ids.length; index += 1) {
      const cell = app.page.getByTestId(`operations-umpires-${ids[index]}`);
      await expect(cell.locator(".operations-umpire-entry")).toHaveCount(index + 1);
      await expect(cell.locator(".operations-umpire-entry > strong")).toHaveText(
        Array.from({ length: index + 1 }, (_, positionIndex) => `U${positionIndex + 1}:`)
      );
      await expect(cell).not.toContainText(/Plate|Base/);
    }
    const fourPerson = app.page.getByTestId(`operations-umpires-${ids[3]}`);
    await expect(fourPerson.locator('[data-status="assigned"]')).toHaveCount(4);
    const threePerson = app.page.getByTestId(`operations-umpires-${ids[2]}`);
    await expect(threePerson.locator('[data-status="open"]')).toHaveCount(0);
    const twoPerson = app.page.getByTestId(`operations-umpires-${ids[1]}`);
    await expect(twoPerson.locator('[data-status="open"]')).toHaveCount(0);
    const solo = app.page.getByTestId(`operations-umpires-${ids[0]}`);
    await expect(solo.locator('[data-status="assigned"]')).toHaveCount(1);
  });

  test("open assignments retain the compact OPEN-dot treatment", async ({ app }) => {
    const ids = await app.page.evaluate(() => {
      games.splice(0, games.length); saveGames(); authService.loginAsAdmin();
      const game = gameService.create({ date: new Date().toISOString().split("T")[0], time: "18:00", level: "12U", locationComplex: "Complex", field: "Field 1", homeTeam: "Home", awayTeam: "Away", gameType: "fourMan" }).data;
      renderPage("operations-center"); return game.id;
    });
    const cell = app.page.getByTestId(`operations-umpires-${ids}`);
    await expect(cell.locator('[data-status="open"]')).toHaveCount(4);
    await expect(cell.locator('[data-status="open"] > span:not(.visually-hidden)')).toHaveText(["OPEN", "OPEN", "OPEN", "OPEN"]);
    expect(await cell.locator('[data-status="open"]').first().evaluate(el => getComputedStyle(el, "::before").content)).not.toBe("none");
  });

  test("live feed formats assignment/removal names, U labels, game context, and complex plus field", async ({ app }) => {
    const ids = await app.page.evaluate(() => {
      localStorage.removeItem("bluecrew_activity"); authService.loginAsAdmin();
      const game = gameService.create({ date: new Date().toISOString().split("T")[0], time: "18:00", level: "12U", locationComplex: "Lake Shore Athletic Complex", locationField: "Field 3", field: "Field 3", homeTeam: "Hawks", awayTeam: "Bears", gameType: "twoMan" }).data;
      const crew = crewService.getAll()[0];
      activityService.log({ id: "ops-63-assigned", type: "assignment", action: "assigned", gameId: game.id, crewId: crew.id, subject: "Plate", metadata: { position: "Plate" } });
      activityService.log({ id: "ops-63-removed", type: "assignment", action: "cleared", gameId: game.id, subject: "Base", metadata: { position: "Base", previousCrewName: "Jane Smith" } });
      renderPage("operations-center");
      return { gameId: game.id, crewName: crewService.getDisplayName(crew.id) };
    });
    const assigned = app.page.locator('[data-activity-id="ops-63-assigned"]');
    const removed = app.page.locator('[data-activity-id="ops-63-removed"]');
    await expect(assigned.locator(".operations-log-action")).toContainText(`${ids.crewName} assigned to U1 for Bears @ Hawks`);
    await expect(removed.locator(".operations-log-action")).toContainText("Jane Smith removed from U2 for Bears @ Hawks");
    await expect(assigned.locator(".operations-log-location")).toHaveText("Lake Shore Athletic Complex • Field 3");
    await expect(assigned).not.toContainText(/Plate|Base/);
  });

  test("attention count is prominent near the date and staffing metrics remain coherent", async ({ app }) => {
    await createOperationsGames(app.page);
    const meta = app.page.getByTestId("operations-page-meta");
    await expect(meta.getByTestId("operations-operational-date")).toBeVisible();
    await expect(meta.getByTestId("operations-attention-summary")).toBeVisible();
    expect(await meta.getByTestId("operations-attention-summary").evaluate(el => parseFloat(getComputedStyle(el).fontWeight))).toBeGreaterThanOrEqual(700);
    const metrics = await app.page.evaluate(() => {
      const operations = dashboardService.getOperationsCenter();
      return Object.fromEntries(operations.statusMetrics.filter(item => ["events-today", "open-positions", "fully-staffed"].includes(item.id)).map(item => [item.id, item.displayValue ?? item.value]));
    });
    await expect(app.page.getByTestId("operations-metric-events-today").locator("strong")).toHaveText(String(metrics["events-today"]));
    await expect(app.page.getByTestId("operations-metric-open-positions").locator("strong")).toHaveText(String(metrics["open-positions"]));
    await expect(app.page.getByTestId("operations-metric-fully-staffed").locator("strong")).toHaveText(String(metrics["fully-staffed"]));
  });

  test("game selection preserves full Game Hub origin navigation and accessibility", async ({ app }) => {
    await createOperationsGames(app.page);
    const event = app.page.getByTestId("operations-upcoming-event").first();
    await event.focus(); await app.page.keyboard.press("Enter");
    await expect(app.page.locator("body")).toHaveAttribute("data-page", "game-hub");
    await expect(app.page.getByTestId("game-hub-back")).toContainText("Back to Ops Center");
    await app.page.getByTestId("game-hub-back").click();
    await expect(app.page.locator("body")).toHaveAttribute("data-page", "operations-center");
    const results = await new AxeBuilder({ page: app.page }).include('[data-testid="operations-center"]').withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(results.violations).toEqual([]);
  });
});
