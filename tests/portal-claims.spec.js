import { test, expect } from "./fixtures/app.fixture.js";

test.describe("Portal Claims", () => {
  test("returns no claimable games when none are open", async ({ app }) => {
    const games = await app.page.evaluate(() => {
      return portalService.getClaimableGames();
    });

    expect(games).toEqual([]);
  });

  test("returns open-for-claim games", async ({ app }) => {
    const games = await app.page.evaluate(() => {
      // Create and log in an approved, linked umpire.
      const accountResult = accountService.createAccount({
        firstName: "Claim",
        lastName: "Umpire",
        email: "claim@example.com",
        password: "password123"
      });

      const account = accountResult.data;
      const crew = crewService.getAll()[0];

      accountService.approveAccount(account.id);

      accountService.updateAccount(account.id, {
        crewId: crew.id
      });

      loginService.login(
        "claim@example.com",
        "password123"
      );

      // Create a game.
      const gameResult = gameService.create({
        date: "2099-02-01",
        time: "7:00 PM",
        field: "Field 2",
        level: "14U",
        homeTeam: "Claim Home",
        awayTeam: "Claim Away",
        gameType: "single"
      });

      // Open the game for claims using the service.
      assignmentService.openForClaims(gameResult.data.id);

      return portalService.getClaimableGames();
    });

    expect(games).toHaveLength(1);

    expect(games[0]).toMatchObject({
      homeTeam: "Claim Home",
      awayTeam: "Claim Away",
      field: "Field 2",
      level: "14U",
      matchup: "Claim Away @ Claim Home"
    });
  });
});