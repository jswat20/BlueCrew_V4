import { test, expect } from "./fixtures/app.fixture.js";

test.describe("Portal Claims", () => {
  test("returns no claimable games when none are open", async ({ app }) => {
    const games = await app.page.evaluate(() =>
      portalService.getClaimableGames()
    );

    expect(games).toEqual([]);
  });

  test("returns open-for-claim games", async ({ app }) => {
    const games = await app.page.evaluate(() => {
      gameService.create({
        date: "2099-02-01",
        time: "7:00 PM",
        field: "Field 2",
        level: "14U",
        homeTeam: "Claim Home",
        awayTeam: "Claim Away",
        gameType: "single"
      });

      const game = gameService.getAll().at(-1);

      game.assignmentStatus = AssignmentStatus.OPEN_FOR_CLAIM;
      game.assignmentMode = "claims";

      return portalService.getClaimableGames();
    });

    expect(games.length).toBeGreaterThan(0);

    expect(
      games.some(game =>
        game.homeTeam === "Claim Home" &&
        game.awayTeam === "Claim Away"
      )
    ).toBe(true);
  });
});