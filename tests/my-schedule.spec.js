import { test, expect } from "./fixtures/app.fixture.js";

test.describe("My Schedule", () => {
  test("shows an empty state when the umpire has no assigned games", async ({ app }) => {
    await app.page.evaluate(() => {
      const accountResult = accountService.createAccount({
        firstName: "Empty",
        lastName: "Schedule",
        email: "empty.schedule@example.com",
        password: "password123"
      });

      accountService.approveAccount(accountResult.data.id);

      loginService.login(
        "empty.schedule@example.com",
        "password123"
      );

      authService.loginAsUmpire();

      renderPage("my-schedule");
    });

    await expect(app.page.getByTestId("my-schedule")).toBeVisible();
    await expect(app.page.getByTestId("my-schedule-empty")).toBeVisible();
  });

  test("shows assigned games for the logged in umpire", async ({ app }) => {
    const game = await app.page.evaluate(() => {
      const accountResult = accountService.createAccount({
        firstName: "My",
        lastName: "Schedule",
        email: "my.schedule@example.com",
        password: "password123"
      });

      const crew = crewService.getAll()[0];

      accountService.approveAccount(accountResult.data.id);

      accountService.updateAccount(accountResult.data.id, {
        crewId: crew.id
      });

      loginService.login(
        "my.schedule@example.com",
        "password123"
      );

      authService.loginAsUmpire();

      const gameResult = gameService.create({
        date: "2099-01-15",
        time: "6:00 PM",
        field: "Field 1",
        level: "12U",
        homeTeam: "My Schedule Home",
        awayTeam: "My Schedule Away",
        gameType: "single"
      });

      const savedGame = gameService
        .getAll()
        .find(item => item.id === gameResult.data.id);

      savedGame.crewId = crew.id;
      savedGame.assignmentStatus = AssignmentStatus.ASSIGNED;

      renderPage("my-schedule");

      return savedGame;
    });

    await expect(app.page.getByTestId("my-schedule")).toBeVisible();
    await expect(app.page.getByTestId("my-schedule-table")).toBeVisible();

    await expect(
      app.page.getByTestId(`my-schedule-row-${game.id}`)
    ).toBeVisible();

    const row = app.page.getByTestId(`my-schedule-row-${game.id}`);

await expect(row).toContainText("My Schedule Away @ My Schedule Home");
await expect(row).toContainText("2099-01-15");
await expect(row).toContainText("6:00 PM");
await expect(row).toContainText("Field 1");
await expect(row).toContainText("12U");
  });
});