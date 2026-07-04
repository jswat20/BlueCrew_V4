import { test, expect } from "./fixtures/app.fixture.js";

test.describe("Claim Games UI", () => {
  test("shows an empty state when there are no claimable games", async ({ app }) => {
    await app.page.evaluate(() => {
      const accountResult = accountService.createAccount({
        firstName: "UI",
        lastName: "Tester",
        email: "ui@example.com",
        password: "password123"
      });

      const crew = crewService.getAll()[0];

      accountService.approveAccount(accountResult.data.id);

      accountService.updateAccount(accountResult.data.id, {
        crewId: crew.id
      });

      loginService.login("ui@example.com", "password123");
    });

await app.page.evaluate(() => {
  authService.loginAsUmpire();
  renderPage("claim-games");
});

    await expect(
      app.page.getByTestId("claim-games-empty")
    ).toBeVisible();
  });

  test("shows claimable games", async ({ app }) => {
    await app.page.evaluate(() => {
      const accountResult = accountService.createAccount({
        firstName: "Claim",
        lastName: "UI",
        email: "claimui@example.com",
        password: "password123"
      });

const crew = crewService.getAll()[1];

      accountService.approveAccount(accountResult.data.id);

      accountService.updateAccount(accountResult.data.id, {
        crewId: crew.id
      });

      loginService.login(
        "claimui@example.com",
        "password123"
      );

      const result = gameService.create({
        date: "2099-05-01",
        time: "6:30 PM",
        field: "Field 5",
        level: "12U",
        homeTeam: "Home Team",
        awayTeam: "Away Team",
        gameType: "single"
      });

      assignmentService.openForClaims(result.data.id);
    });

await app.page.evaluate(() => {
  authService.loginAsUmpire();
  renderPage("claim-games");
});
    await expect(
      app.page.getByTestId("claim-games")
    ).toBeVisible();

    await expect(
      app.page.getByText("Away Team @ Home Team")
    ).toBeVisible();

    await expect(
app.page.locator('button[data-testid^="claim-game-"]')
    ).toBeVisible();
  });
});