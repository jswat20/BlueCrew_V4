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
      venue: "BlueCrew Sports Complex",
      address: "123 Umpire Way",
      notes: "Tournament semifinal",
      specialInstructions:
        "Use the north parking lot.",
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

      await expect(
        app.page.getByTestId(
          "game-hub-summary"
        )
      ).toBeVisible();

      await expect(
        app.page.getByTestId(
          "game-hub-summary-field"
        )
      ).toContainText("Game Hub Field");

      await expect(
        app.page.getByTestId(
          "game-hub-summary-level"
        )
      ).toContainText("12U");

      await expect(
        app.page.getByTestId(
          "game-hub-summary-position"
        )
      ).toContainText("Plate");

      const gameInformation =
        app.page.getByTestId(
          "game-hub-section-game-information"
        );

      await expect(gameInformation).toContainText(
        "Game Hub Field"
      );

      await expect(gameInformation).toContainText(
        "BlueCrew Sports Complex"
      );

      await expect(gameInformation).toContainText(
        "123 Umpire Way"
      );

      await expect(gameInformation).toContainText(
        "Tournament semifinal"
      );

      await expect(gameInformation).toContainText(
        "Use the north parking lot."
      );

      await expect(
        app.page.getByTestId(
          "game-hub-summary-status"
        )
      ).toContainText("Assigned");

      await expect(
        app.page.getByTestId(
          "game-hub-actions"
        )
      ).toBeVisible();

      await expect(
        app.page.getByTestId(
          "game-hub-availability"
        )
      ).toBeVisible();

      await expect(
        app.page.getByTestId(
          "game-hub-claim-games"
        )
      ).toBeVisible();

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

  test(
    "saves crew notes for the selected game",
    async ({ app }) => {
      const { gameId } =
        await setupGameHub(app);

      await app.page
        .getByTestId(
          `my-schedule-open-game-${gameId}`
        )
        .click();

      const notes =
        app.page.getByTestId(
          "game-hub-crew-notes-input"
        );

      await expect(notes).toBeVisible();

      await notes.fill(
        "Confirm the plate meeting at 6:10."
      );

      await app.page
        .getByTestId(
          "game-hub-save-crew-notes"
        )
        .click();

      await expect(
        app.page.getByTestId(
          "game-hub-crew-notes-status"
        )
      ).toContainText("Crew notes saved.");

      await app.page.evaluate(
        selectedGameId => {
          renderPage("my-schedule");
          renderPage("game-hub", {
            gameId: selectedGameId
          });
        },
        gameId
      );

      await expect(
        app.page.getByTestId(
          "game-hub-crew-notes-input"
        )
      ).toHaveValue(
        "Confirm the plate meeting at 6:10."
      );
    }
  );
});
