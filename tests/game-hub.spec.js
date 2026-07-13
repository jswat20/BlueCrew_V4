import {
  test,
  expect
} from "./fixtures/app.fixture.js";

async function setupGameHub(app) {
  return app.page.evaluate(() => {
    const accountResult =
      accountService.createAccount({
        firstName: "Game",
        lastName: "Hub",
        email:
          `game.hub.${Date.now()}@example.com`,
        password: "password123"
      });

    const crew = crewService.getAll()[0];

    accountService.approveAccount(
      accountResult.data.id
    );

    accountService.updateAccount(
      accountResult.data.id,
      {
        crewId: crew.id
      }
    );

    loginService.login(
      accountResult.data.email,
      "password123"
    );

    authService.loginAsUmpire();

    const gameResult = gameService.create({
      date: "2099-03-15",
      time: "6:30 PM",
      field: "Game Hub Field",
      level: "12U",
      homeTeam: "Game Hub Home",
      awayTeam: "Game Hub Away",
      gameType: "single"
    });

    const game = gameService
      .getAll()
      .find(
        item =>
          String(item.id) ===
          String(gameResult.data.id)
      );

    const assignments =
      assignmentService.getAssignments(game);

    assignments[0].crewId = crew.id;
    assignments[0].position = "Plate";
    assignments[0].status = "assigned";

    game.crewId = crew.id;
    game.assignmentStatus = "assigned";

    if (
      typeof gameService.save ===
      "function"
    ) {
      gameService.save();
    }

    renderPage("my-schedule");

    return {
      gameId: game.id
    };
  });
}

test.describe("Game Hub", () => {
  test(
    "opens the selected game, renders its panels, and returns to My Schedule",
    async ({ app }) => {
      const { gameId } =
        await setupGameHub(app);

      await app.page
        .getByTestId(
          `my-schedule-open-game-${gameId}`
        )
        .click();

      const diagnostics =
        await app.page.evaluate(() => ({
          currentPage:
            window.BlueCrew?.test?.currentPage,
          errors:
            window.BlueCrew?.test?.errors || [],
          bodyText:
            document.body.innerText,
          bodyHtml:
            document.body.innerHTML
        }));

      console.log(
        "GAME HUB DIAGNOSTICS",
        JSON.stringify(diagnostics, null, 2)
      );

      const hub =
        app.page.getByTestId("game-hub");

      await expect(hub).toBeVisible();

      await expect(hub).toHaveAttribute(
        "data-game-id",
        String(gameId)
      );

      await expect(hub).toContainText(
        "Game Hub Field"
      );

      await expect(hub).toContainText(
        "Game Hub Away @ Game Hub Home"
      );

      const sectionKeys = [
        "game-information",
        "crew",
        "arrival",
        "game-day",
        "checklist",
        "timeline",
        "conditions",
        "contacts",
        "status"
      ];

      for (const key of sectionKeys) {
        await expect(
          app.page.getByTestId(
            `game-hub-section-${key}`
          )
        ).toBeVisible();
      }

      await app.page
        .getByTestId("game-hub-back")
        .click();

      await expect(
        app.page.getByTestId("my-schedule")
      ).toBeVisible();

      await expect(
        app.page.getByTestId(
          `my-schedule-row-${gameId}`
        )
      ).toBeVisible();
    }
  );
});
