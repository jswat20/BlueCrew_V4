import { test, expect } from "./fixtures/app.fixture.js";

test.describe("Portal Service", () => {
  test("returns no schedule when no account is logged in", async ({ app }) => {
    const schedule = await app.page.evaluate(() =>
      portalService.getMySchedule()
    );

    expect(schedule).toEqual([]);
  });

  test("returns assigned games for the logged-in linked crew account", async ({ app }) => {
    const result = await app.page.evaluate(() => {
      const accountResult = accountService.createAccount({
        firstName: "Portal",
        lastName: "Umpire",
        email: "portal.umpire@example.com",
        password: "password123"
      });

      const account = accountResult.data;
      const crew = crewService.getAll()[0];

      accountService.approveAccount(account.id);

      accountService.updateAccount(account.id, {
        crewId: crew.id
      });

      loginService.login(
        "portal.umpire@example.com",
        "password123"
      );

      const gameResult = gameService.create({
        date: "2099-01-15",
        time: "6:00 PM",
        field: "Field 1",
        level: "12U",
        homeTeam: "Portal Home",
        awayTeam: "Portal Away",
        gameType: "single"
      });

      const game = gameService
        .getAll()
        .find(g => g.id === gameResult.data.id);

      game.crewId = crew.id;
      game.assignmentStatus = AssignmentStatus.ASSIGNED;

      return portalService.getMySchedule();
    });

    expect(
      result.some(
        game =>
          game.homeTeam === "Portal Home" &&
          game.awayTeam === "Portal Away"
      )
    ).toBe(true);

    const portalGame = result.find(
      game => game.homeTeam === "Portal Home"
    );

    expect(portalGame).toMatchObject({
      date: "2099-01-15",
      time: "6:00 PM",
      field: "Field 1",
      level: "12U",
      matchup: "Portal Away @ Portal Home"
    });
  });
});