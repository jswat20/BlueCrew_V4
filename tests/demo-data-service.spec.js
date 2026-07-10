import { test, expect } from "./fixtures/app.fixture.js";

test.describe("Demo Data Service", () => {
  test("starts unloaded", async ({ app }) => {
    const summary = await app.page.evaluate(() =>
      demoDataService.getSummary()
    );

    expect(summary.loaded).toBe(false);
  });

  test("loads demo crew and games", async ({ app }) => {
    const summary = await app.page.evaluate(() => {
      demoDataService.loadLeague();
      return demoDataService.getSummary();
    });

    expect(summary.loaded).toBe(true);
    expect(summary.crew).toBe(4);
    expect(summary.games).toBe(8);
  });

  test("creates valid assignment models for demo games", async ({ app }) => {
    const result = await app.page.evaluate(() => {
      demoDataService.loadLeague();

      return gameService.getAll().map(game => ({
        id: game.id,
        gameType: game.gameType,
        assignments:
          assignmentService.getAssignments(game).length
      }));
    });

    expect(result).toHaveLength(8);

    expect(
      result.find(game => game.id === "demo-game-001")
        .assignments
    ).toBe(1);

    expect(
      result.find(game => game.id === "demo-game-002")
        .assignments
    ).toBe(2);
  });

  test("does not duplicate demo data", async ({ app }) => {
    const summary = await app.page.evaluate(() => {
      demoDataService.loadLeague();
      demoDataService.loadLeague();

      return demoDataService.getSummary();
    });

    expect(summary.crew).toBe(4);
    expect(summary.games).toBe(8);
  });

  test("restores original crew and games", async ({ app }) => {
    const result = await app.page.evaluate(() => {
      const originalCrewIds =
        crewService.getAll().map(member => member.id);

      const originalGameIds =
        gameService.getAll().map(game => game.id);

      demoDataService.loadLeague();
      demoDataService.resetLeague();

      return {
        originalCrewIds,
        restoredCrewIds:
          crewService.getAll().map(member => member.id),
        originalGameIds,
        restoredGameIds:
          gameService.getAll().map(game => game.id)
      };
    });

    expect(result.restoredCrewIds)
      .toEqual(result.originalCrewIds);

    expect(result.restoredGameIds)
      .toEqual(result.originalGameIds);
  });

  test("populates upcoming games on the dashboard", async ({ app }) => {
    await app.page.evaluate(() => {
      demoDataService.loadLeague();
      renderPage("dashboard");
    });

    const upcomingCount = await app.page
      .getByTestId("dashboard-summary-upcoming-games-value")
      .textContent();

    expect(Number(upcomingCount)).toBeGreaterThan(0);

    await expect(
      app.page.getByTestId("dashboard-upcoming-games")
    ).toBeVisible();
  });
});
