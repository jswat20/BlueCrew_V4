const { test, expect } = require("@playwright/test");

test.describe("Assigner Review Queue", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
page.on("pageerror", error => {
  console.log(
    "PAGE ERROR:",
    error.stack || error.message
  );
});

page.on("console", message => {
  if (message.type() === "error") {
    console.log(
      "BROWSER ERROR:",
      message.text()
    );
  }
});
    await page.evaluate(() => {
      authService.loginAsAdmin();
      document.body.dataset.role = "admin";

      const game = gameService.getAll()[0];

      game.completed = true;
      game.completedBy = "Test Umpire";
      game.completedAt = "2026-07-13T18:30:00.000Z";

      game.homeScore = 5;
      game.awayScore = 3;

      game.reports = {
        incidents: true,
        ejections: false,
        protests: false,
        rainout: false,
        notes: "Bench warning in the fifth inning."
      };

      const assignedCrewId =
  game.assignments?.find(
    assignment => assignment.crewId
  )?.crewId || game.crewId;

game.crewNotesByCrewId = {
  ...(game.crewNotesByCrewId || {}),
  [String(assignedCrewId)]:
    "Confirm ground rules before first pitch."
};

      game.review = {
        status: "submitted",
        submittedForReview: true,
        submittedAt: "2026-07-13T19:00:00.000Z",
        submittedBy: "Test Umpire"
      };

      gameService.save(game);

      renderPage("dashboard");
    });
  });

  test("submitted game appears in queue and dashboard count updates", async ({
    page
  }) => {
    await expect(
      page.getByTestId(
        "dashboard-summary-pending-reviews-value"
      )
    ).toHaveText("1");

    await page.evaluate(() =>
      navigateTo("review-queue")
    );

    await expect(
      page.getByTestId("review-queue")
    ).toBeVisible();

    const gameId = await page.evaluate(
      () => gameService.getAll()[0].id
    );

    await expect(
      page.getByTestId(
        `review-queue-row-${gameId}`
      )
    ).toBeVisible();

    await expect(
      page.getByTestId(
        `review-queue-completed-by-${gameId}`
      )
    ).toHaveText("Test Umpire");
  });

  test("review opens shared Game Hub in read-only mode and returns to queue", async ({
    page
  }) => {
    await page.evaluate(() =>
      navigateTo("review-queue")
    );

    const gameId = await page.evaluate(
      () => gameService.getAll()[0].id
    );

    await page
      .getByTestId(`review-queue-open-${gameId}`)
      .click();

    await expect(
      page.getByTestId("game-hub")
    ).toBeVisible();

    await expect(
      page.getByTestId("game-hub")
    ).toHaveAttribute(
      "data-review-mode",
      "true"
    );

    const completion = page.getByTestId("game-hub-completion-summary");
    await expect(completion).toContainText("3");
    await expect(completion).toContainText("5");
    await expect(completion).toContainText("Bench warning in the fifth inning.");
    await expect(page.getByTestId("game-hub-away-score")).toHaveCount(0);
    await expect(page.getByTestId("game-hub-report-notes")).toHaveCount(0);

    await expect(
      page.getByTestId("game-hub-crew-notes-input")
    ).toHaveValue(
      "Confirm ground rules before first pitch."
    );

    await expect(
      page.getByTestId("game-hub-crew-notes-input")
    ).toHaveAttribute("readonly", "");

    await expect(
      page.getByTestId("game-hub-save-crew-notes")
    ).toBeDisabled();

    await expect(page.getByTestId("game-hub-away-score")).toHaveCount(0);
    await expect(page.getByTestId("game-hub-home-score")).toHaveCount(0);
    await expect(page.getByTestId("game-hub-save-score")).toHaveCount(0);
    await expect(page.getByTestId("game-hub-report-notes")).toHaveCount(0);

    await expect(
      page.getByTestId("game-hub-back")
    ).toHaveText("← Back to Review Queue");

    await page
      .getByTestId("game-hub-back")
      .click();

    await expect(
      page.getByTestId("review-queue")
    ).toBeVisible();
  });
});
