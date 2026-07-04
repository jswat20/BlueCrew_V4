import { test, expect } from "@playwright/test";

test.describe("Portal Service", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("returns no schedule when no account is logged in", async ({ page }) => {
    const schedule = await page.evaluate(() => portalService.getMySchedule());

    expect(schedule).toEqual([]);
  });

  test("returns assigned games for the logged-in linked crew account", async ({ page }) => {
  const result = await page.evaluate(() => {
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

    const storedGame = gameService
      .getAll()
      .find(item => item.id === gameResult.data.id);

    storedGame.crewId = crew.id;
    storedGame.assignmentStatus = AssignmentStatus.ASSIGNED;

return {
  currentAccount: loginService.getCurrentAccount(),
  allAccounts: accountService.getAll(),
  crew,
  games: gameService.getAll(),
  schedule: portalService.getMySchedule()
};  });

expect(result.schedule.some(game =>
  game.homeTeam === "Portal Home" &&
  game.awayTeam === "Portal Away"
)).toBe(true);

const portalGame = result.schedule.find(
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