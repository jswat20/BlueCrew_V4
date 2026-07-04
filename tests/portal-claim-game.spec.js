import { test, expect } from "./fixtures/app.fixture.js";

test.describe("Portal Claim Game", () => {
  test("logged in umpire can claim an open game", async ({ app }) => {
    const result = await app.page.evaluate(() => {
      const accountResult = accountService.createAccount({
        firstName: "Claim",
        lastName: "Tester",
        email: "claimtester@example.com",
        password: "password123"
      });

      const account = accountResult.data;
      const crew = crewService.getAll()[0];

      accountService.approveAccount(account.id);

      accountService.updateAccount(account.id, {
        crewId: crew.id
      });

      loginService.login(
        "claimtester@example.com",
        "password123"
      );

      const gameResult = gameService.create({
        date: "2099-03-01",
        time: "6:00 PM",
        field: "Field 3",
        level: "16U",
        homeTeam: "Home",
        awayTeam: "Away",
        gameType: "single"
      });

      assignmentService.openForClaims(gameResult.data.id);

      return portalService.claimGame(gameResult.data.id);
    });

    expect(result.success).toBe(true);
  });

  test("claim moves game to pending approval", async ({ app }) => {
    const status = await app.page.evaluate(() => {
      const accountResult = accountService.createAccount({
        firstName: "Pending",
        lastName: "Tester",
        email: "pending@example.com",
        password: "password123"
      });

      const account = accountResult.data;
      const crew = crewService.getAll()[0];

      accountService.approveAccount(account.id);

      accountService.updateAccount(account.id, {
        crewId: crew.id
      });

      loginService.login(
        "pending@example.com",
        "password123"
      );

      const gameResult = gameService.create({
        date: "2099-03-02",
        time: "7:00 PM",
        field: "Field 4",
        level: "18U",
        homeTeam: "Pending Home",
        awayTeam: "Pending Away",
        gameType: "single"
      });

      assignmentService.openForClaims(gameResult.data.id);

      portalService.claimGame(gameResult.data.id);

      const game = gameService.getAll().find(
        g => g.id === gameResult.data.id
      );

      return assignmentService.getStatus(game);
    });

expect(status).toBe("pending_approval");  });
});