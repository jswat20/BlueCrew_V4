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
  test("administrators can open crew assignment from Game Hub", async ({ app }) => {
    const { gameId } = await setupGameHub(app);

    await app.page.evaluate(id => {
      authService.loginAsAdmin();
      document.body.dataset.role = "admin";
      renderPage("game-hub", { gameId: id });
    }, gameId);

    const manageCrew = app.page.getByTestId("game-hub-manage-crew");
    await expect(manageCrew).toBeVisible();
    await manageCrew.click();
    await expect(app.page.getByTestId("assignment-drawer")).toBeVisible();
    await expect(app.page.getByTestId("assignment-save")).toBeVisible();
  });

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

  test(
    "persists checklist progress for the selected game",
    async ({ app }) => {
      const { gameId } =
        await setupGameHub(app);

      await app.page
        .getByTestId(
          `my-schedule-open-game-${gameId}`
        )
        .click();

      await expect(
        app.page.getByTestId(
          "game-hub-checklist"
        )
      ).toBeVisible();

      await expect(
        app.page.getByTestId(
          "game-hub-checklist-progress"
        )
      ).toContainText("0 of 4 complete");

      const uniformToggle =
        app.page.getByTestId(
          "game-hub-checklist-toggle-uniform"
        );

      await uniformToggle.check();

      await expect(
        app.page.getByTestId(
          "game-hub-checklist-progress"
        )
      ).toContainText("1 of 4 complete");

      await expect(
        app.page.getByTestId(
          "game-hub-checklist-toggle-uniform"
        )
      ).toBeChecked();

      await app.page
        .getByTestId("game-hub-back")
        .click();

      await app.page
        .getByTestId(
          `my-schedule-open-game-${gameId}`
        )
        .click();

      await expect(
        app.page.getByTestId(
          "game-hub-checklist-toggle-uniform"
        )
      ).toBeChecked();

      await expect(
        app.page.getByTestId(
          "game-hub-checklist-progress"
        )
      ).toContainText("1 of 4 complete");
    }
  );

  test(
    "completes a game and persists completion",
    async ({ app }) => {
      const { gameId } =
        await setupGameHub(app);

      await app.page
        .getByTestId(
          `my-schedule-open-game-${gameId}`
        )
        .click();

      await expect(
        app.page.getByTestId(
          "game-hub-completion"
        )
      ).toBeVisible();

      await expect(
        app.page.getByTestId(
          "game-hub-completion-incomplete"
        )
      ).toContainText(
        "Game not yet completed."
      );

      const completeButton =
        app.page.getByTestId(
          "game-hub-complete-game"
        );

      await expect(
        completeButton
      ).toBeVisible();

      await completeButton.click();

      await expect(
        app.page.getByTestId(
          "game-hub-completion-complete"
        )
      ).toContainText(
        "Game Completed"
      );

      await expect(
        app.page.getByTestId(
          "game-hub-completed-by"
        )
      ).toContainText("Game Hub");

      await expect(
        app.page.getByTestId(
          "game-hub-completed-at"
        )
      ).not.toBeEmpty();

      const persistedCompletion =
        await app.page.evaluate(
          selectedGameId => {
            const game =
              gameService.getById(
                selectedGameId
              );

            return {
              completed:
                game.completed,
              completionTime:
                game.completionTime,
              completedBy:
                game.completedBy,
              completionStatus:
                game.completionStatus
            };
          },
          gameId
        );

      expect(
        persistedCompletion.completed
      ).toBe(true);

      expect(
        persistedCompletion.completionTime
      ).toBeTruthy();

      expect(
        persistedCompletion.completedBy
      ).toBe("Game Hub");

      expect(
        persistedCompletion.completionStatus
      ).toBe("completed");

      await app.page
        .getByTestId("game-hub-back")
        .click();

      await expect(
        app.page.getByTestId(
          "my-schedule"
        )
      ).toBeVisible();

      await app.page
        .getByTestId(
          `my-schedule-open-game-${gameId}`
        )
        .click();

      await expect(
        app.page.getByTestId(
          "game-hub-completion-complete"
        )
      ).toContainText(
        "Game Completed"
      );

      await expect(
        app.page.getByTestId(
          "game-hub-completed-by"
        )
      ).toContainText("Game Hub");

      await expect(
        app.page.getByTestId(
          "game-hub-completed-at"
        )
      ).not.toBeEmpty();

      await expect(
        app.page.getByTestId(
          "game-hub-complete-game"
        )
      ).toHaveCount(0);
    }
  );


  test(
    "saves and persists the final score after completion",
    async ({ app }) => {
      const { gameId } =
        await setupGameHub(app);

      await app.page
        .getByTestId(
          `my-schedule-open-game-${gameId}`
        )
        .click();

      await expect(
        app.page.getByTestId(
          "game-hub-final-score"
        )
      ).toHaveCount(0);

      await app.page
        .getByTestId(
          "game-hub-complete-game"
        )
        .click();

      await expect(
        app.page.getByTestId(
          "game-hub-final-score"
        )
      ).toBeVisible();

      await app.page
        .getByTestId(
          "game-hub-away-score"
        )
        .fill("3");

      await app.page
        .getByTestId(
          "game-hub-home-score"
        )
        .fill("7");

      await app.page
        .getByTestId(
          "game-hub-save-score"
        )
        .click();

      await expect(
        app.page.getByTestId(
          "game-hub-score-status"
        )
      ).toContainText(
        "Final score saved."
      );

      const persistedScore =
        await app.page.evaluate(
          selectedGameId => {
            const game =
              gameService.getById(
                selectedGameId
              );

            return {
              homeScore: game.homeScore,
              awayScore: game.awayScore
            };
          },
          gameId
        );

      expect(
        persistedScore.homeScore
      ).toBe(7);

      expect(
        persistedScore.awayScore
      ).toBe(3);

      await app.page
        .getByTestId("game-hub-back")
        .click();

      await app.page
        .getByTestId(
          `my-schedule-open-game-${gameId}`
        )
        .click();

      await expect(
        app.page.getByTestId(
          "game-hub-away-score"
        )
      ).toHaveValue("3");

      await expect(
        app.page.getByTestId(
          "game-hub-home-score"
        )
      ).toHaveValue("7");
    }
  );


  test(
    "saves and persists game reports after completion",
    async ({ app }) => {
      const { gameId } =
        await setupGameHub(app);

      await app.page
        .getByTestId(
          `my-schedule-open-game-${gameId}`
        )
        .click();

      await expect(
        app.page.getByTestId(
          "game-hub-reports"
        )
      ).toHaveCount(0);

      await app.page
        .getByTestId(
          "game-hub-complete-game"
        )
        .click();

      await app.page
        .getByTestId(
          "game-hub-away-score"
        )
        .fill("3");

      await app.page
        .getByTestId(
          "game-hub-home-score"
        )
        .fill("7");

      await app.page
        .getByTestId(
          "game-hub-save-score"
        )
        .click();

      await expect(
        app.page.getByTestId(
          "game-hub-reports"
        )
      ).toBeVisible();

      await app.page
        .getByTestId(
          "game-hub-report-incidents"
        )
        .check();

      await app.page
        .getByTestId(
          "game-hub-report-rainout"
        )
        .check();

      await app.page
        .getByTestId(
          "game-hub-report-notes"
        )
        .fill(
          "Lightning delay ended the game early."
        );

      await app.page
        .getByTestId(
          "game-hub-save-reports"
        )
        .click();

      await expect(
        app.page.getByTestId(
          "game-hub-reports-status"
        )
      ).toContainText(
        "Game reports saved."
      );

      const persistedReports =
        await app.page.evaluate(
          selectedGameId => {
            const game =
              gameService.getById(
                selectedGameId
              );

            return game.reports;
          },
          gameId
        );

      expect(
        persistedReports
      ).toEqual({
        incidents: true,
        ejections: false,
        protests: false,
        rainout: true,
        notes:
          "Lightning delay ended the game early."
      });

      await app.page
        .getByTestId("game-hub-back")
        .click();

      await app.page
        .getByTestId(
          `my-schedule-open-game-${gameId}`
        )
        .click();

      await expect(
        app.page.getByTestId(
          "game-hub-report-incidents"
        )
      ).toBeChecked();

      await expect(
        app.page.getByTestId(
          "game-hub-report-ejections"
        )
      ).not.toBeChecked();

      await expect(
        app.page.getByTestId(
          "game-hub-report-protests"
        )
      ).not.toBeChecked();

      await expect(
        app.page.getByTestId(
          "game-hub-report-rainout"
        )
      ).toBeChecked();

      await expect(
        app.page.getByTestId(
          "game-hub-report-notes"
        )
      ).toHaveValue(
        "Lightning delay ended the game early."
      );

      await expect(
        app.page.getByTestId(
          "game-hub-away-score"
        )
      ).toHaveValue("3");

      await expect(
        app.page.getByTestId(
          "game-hub-home-score"
        )
      ).toHaveValue("7");
    }
  );


  test(
    "submits a completed game for review and locks editing",
    async ({ app }) => {
      const { gameId } =
        await setupGameHub(app);

      await app.page
        .getByTestId(
          `my-schedule-open-game-${gameId}`
        )
        .click();

      await app.page
        .getByTestId(
          "game-hub-crew-notes-input"
        )
        .fill(
          "Postgame notes ready for review."
        );

      await app.page
        .getByTestId(
          "game-hub-save-crew-notes"
        )
        .click();

      await app.page
        .getByTestId(
          "game-hub-checklist-toggle-uniform"
        )
        .check();

      await app.page
        .getByTestId(
          "game-hub-complete-game"
        )
        .click();

      await app.page
        .getByTestId(
          "game-hub-away-score"
        )
        .fill("4");

      await app.page
        .getByTestId(
          "game-hub-home-score"
        )
        .fill("6");

      await app.page
        .getByTestId(
          "game-hub-save-score"
        )
        .click();

      await app.page
        .getByTestId(
          "game-hub-report-incidents"
        )
        .check();

      await app.page
        .getByTestId(
          "game-hub-report-notes"
        )
        .fill(
          "Incident documentation submitted."
        );

      await app.page
        .getByTestId(
          "game-hub-save-reports"
        )
        .click();

      await expect(
        app.page.getByTestId(
          "game-hub-review-status"
        )
      ).toContainText("Draft");

      await app.page
        .getByTestId(
          "game-hub-submit-review"
        )
        .click();

      await expect(
        app.page.getByTestId(
          "game-hub-review-submitted"
        )
      ).toContainText("Submitted");

      await expect(
        app.page.getByTestId(
          "game-hub-review-submitted-by"
        )
      ).toContainText("Game Hub");

      await expect(
        app.page.getByTestId(
          "game-hub-review-submitted-at"
        )
      ).not.toBeEmpty();

      await expect(
        app.page.getByTestId(
          "game-hub-submit-review"
        )
      ).toHaveCount(0);

      await app.page
        .getByTestId("game-hub-back")
        .click();

      await app.page
        .getByTestId(
          `my-schedule-open-game-${gameId}`
        )
        .click();

      await expect(
        app.page.getByTestId(
          "game-hub-review-submitted"
        )
      ).toContainText("Submitted");

      await expect(
        app.page.getByTestId(
          "game-hub-away-score"
        )
      ).toBeDisabled();

      await expect(
        app.page.getByTestId(
          "game-hub-home-score"
        )
      ).toBeDisabled();

      await expect(
        app.page.getByTestId(
          "game-hub-save-score"
        )
      ).toBeDisabled();

      await expect(
        app.page.getByTestId(
          "game-hub-report-incidents"
        )
      ).toBeDisabled();

      await expect(
        app.page.getByTestId(
          "game-hub-report-notes"
        )
      ).toHaveAttribute(
        "readonly",
        ""
      );

      await expect(
        app.page.getByTestId(
          "game-hub-save-reports"
        )
      ).toBeDisabled();

      await expect(
        app.page.getByTestId(
          "game-hub-crew-notes-input"
        )
      ).toHaveAttribute(
        "readonly",
        ""
      );

      await expect(
        app.page.getByTestId(
          "game-hub-save-crew-notes"
        )
      ).toBeDisabled();

      await expect(
        app.page.getByTestId(
          "game-hub-checklist-toggle-uniform"
        )
      ).toBeDisabled();

      const persistedReview =
        await app.page.evaluate(
          selectedGameId => {
            const game =
              gameService.getById(
                selectedGameId
              );

            return game.review;
          },
          gameId
        );

      expect(
        persistedReview.status
      ).toBe("submitted");

      expect(
        persistedReview.submittedForReview
      ).toBe(true);

      expect(
        persistedReview.submittedAt
      ).toBeTruthy();

      expect(
        persistedReview.submittedBy
      ).toBe("Game Hub");
    }
  );

});
