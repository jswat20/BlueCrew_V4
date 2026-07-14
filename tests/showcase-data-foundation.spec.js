
import {
  expect,
  test
} from "@playwright/test";

test.describe("Showcase Data Foundation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");

    await page.evaluate(() => {
      localStorage.removeItem(
        "bluecrew_accounts"
      );
    });
  });

  test("loads a full showcase organization", async ({
    page
  }) => {
    const result = await page.evaluate(() => {
      const operation =
        demoDataService.loadLeague();

      return {
        operation,
        summary:
          demoDataService.getSummary()
      };
    });

    expect(result.operation.success).toBe(true);

    expect(result.summary).toEqual(
      expect.objectContaining({
        loaded: true,
        crew: 40,
        games: 120,
        accounts: 51,
        administrators: 2,
        assigners: 3,
        umpires: 40,
        pendingAccounts: 4,
        rejectedAccounts: 2
      })
    );
  });

  test("uses relative schedule dates", async ({
    page
  }) => {
    const result = await page.evaluate(() => {
      demoDataService.loadLeague();

      const today =
        new Date()
          .toISOString()
          .split("T")[0];

      const games = gameService.getAll();

      return {
        today,
        hasPast:
          games.some(
            game => game.date < today
          ),
        hasToday:
          games.some(
            game => game.date === today
          ),
        hasFuture:
          games.some(
            game => game.date > today
          )
      };
    });

    expect(result.hasPast).toBe(true);
    expect(result.hasToday).toBe(true);
    expect(result.hasFuture).toBe(true);
  });

  test("creates valid normalized assignment models", async ({
    page
  }) => {
    const result = await page.evaluate(() => {
      demoDataService.loadLeague();

      return gameService
        .getAll()
        .map(game => ({
          id: game.id,
          expected:
            game.gameType === "single"
              ? 1
              : 2,
          actual:
            assignmentService
              .getAssignments(game)
              .length
        }));
    });

    expect(result).toHaveLength(120);

    expect(
      result.every(
        game =>
          game.actual === game.expected
      )
    ).toBe(true);
  });

  test("does not duplicate showcase data", async ({
    page
  }) => {
    const result = await page.evaluate(() => {
      demoDataService.loadLeague();
      demoDataService.loadLeague();

      return demoDataService.getSummary();
    });

    expect(result.crew).toBe(40);
    expect(result.games).toBe(120);
    expect(result.accounts).toBe(51);
  });

  test("restores the data present before loading", async ({
    page
  }) => {
    const result = await page.evaluate(() => {
      const originalCrew =
        crewService.getAll();

      const originalGames =
        gameService.getAll();

      localStorage.setItem(
        "bluecrew_accounts",
        JSON.stringify([
          {
            id: "original-account",
            firstName: "Original",
            lastName: "User",
            email: "original@test.com",
            role: "administrator",
            status: "approved",
            crewId: null
          }
        ])
      );

      demoDataService.loadLeague();
      demoDataService.resetLeague();

      return {
        crew:
          crewService.getAll(),
        games:
          gameService.getAll(),
        accounts:
          accountService.getAll(),
        originalCrew,
        originalGames
      };
    });

    expect(result.crew).toEqual(
      result.originalCrew
    );

    expect(result.games).toEqual(
      result.originalGames
    );

    expect(result.accounts).toHaveLength(1);
    expect(result.accounts[0].id).toBe(
      "original-account"
    );
  });

  test("shows Showcase League controls in Admin", async ({
    page
  }) => {
    await page.evaluate(() => {
      authService.loginAsAdmin();
      renderPage("admin");
    });

    await expect(
      page.getByTestId("load-demo-league")
    ).toHaveText("Load Showcase League");

    await expect(
      page.getByTestId("demo-league-status")
    ).toContainText(
      "Showcase league not loaded"
    );
  });
});
