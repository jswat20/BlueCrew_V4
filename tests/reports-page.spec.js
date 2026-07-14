import {
  test,
  expect
} from "./fixtures/app.fixture.js";

test.describe("Reports Page", () => {
  test.beforeEach(async ({ app }) => {
    await app.page.evaluate(() => {
      localStorage.clear();

      games.splice(0, games.length);
      crew.splice(0, crew.length);

      if (
        typeof gameService.save ===
        "function"
      ) {
        gameService.save();
      }

      authService.loginAsAdmin();
      document.body.dataset.role = "admin";
    });
  });

  test("renders all three report cards", async ({
    app
  }) => {
    await app.page.evaluate(() => {
      renderPage("reports");
    });

    await expect(
      app.page.getByTestId("reports-page")
    ).toBeVisible();

    await expect(
      app.page.getByTestId(
        "assignment-report-card"
      )
    ).toBeVisible();

    await expect(
      app.page.getByTestId(
        "availability-report-card"
      )
    ).toBeVisible();

    await expect(
      app.page.getByTestId(
        "review-report-card"
      )
    ).toBeVisible();
  });

  test("shows the empty reporting state", async ({
    app
  }) => {
    await app.page.evaluate(() => {
      renderPage("reports");
    });

    await expect(
      app.page.getByTestId("reports-empty")
    ).toBeVisible();

    await expect(
      app.page.getByTestId(
        "assignment-report-total-games"
      )
    ).toHaveText("0");

    await expect(
      app.page.getByTestId(
        "availability-report-available"
      )
    ).toHaveText("0");

    await expect(
      app.page.getByTestId(
        "review-report-approved"
      )
    ).toHaveText("0");
  });

  test("renders review report values", async ({
    app
  }) => {
    await app.page.evaluate(() => {
      games.push(
        {
          id: "report-submitted",
          review: {
            status: "submitted",
            submittedAt:
              "2026-07-01T12:00:00.000Z"
          }
        },
        {
          id: "report-returned",
          review: {
            status: "returned",
            submittedAt:
              "2026-07-02T12:00:00.000Z"
          }
        },
        {
          id: "report-approved",
          review: {
            status: "approved",
            submittedAt:
              "2026-07-03T12:00:00.000Z"
          }
        }
      );

      saveGames();
      renderPage("reports");
    });

    await expect(
      app.page.getByTestId(
        "review-report-submitted"
      )
    ).toHaveText("1");

    await expect(
      app.page.getByTestId(
        "review-report-returned"
      )
    ).toHaveText("1");

    await expect(
      app.page.getByTestId(
        "review-report-approved"
      )
    ).toHaveText("1");

    await expect(
      app.page.getByTestId(
        "review-report-completion"
      )
    ).toHaveText("33%");
  });

  test("updates after assignment mutation and rerender", async ({
    app
  }) => {
    await app.page.evaluate(() => {
      const game = gameService.create({
        id: "reports-page-assignment",
        date: "2028-06-01",
        time: "6:00 PM",
        field: "Field 1",
        level: "12U",
        awayTeam: "Away",
        homeTeam: "Home",
        gameType: "single"
      }).data;

      renderPage("reports");

      const assignment =
        assignmentService
          .getAssignments(game)[0];

      assignmentService.assignToAssignment(
        game.id,
        assignment.id,
        "reports-page-crew"
      );

      renderPage("reports");
    });

    await expect(
      app.page.getByTestId(
        "assignment-report-total-games"
      )
    ).toHaveText("1");

    await expect(
      app.page.getByTestId(
        "assignment-report-assigned"
      )
    ).toHaveText("1");

    await expect(
      app.page.getByTestId(
        "assignment-report-fully-staffed"
      )
    ).toHaveText("1");

    await expect(
      app.page.getByTestId(
        "assignment-report-rate"
      )
    ).toHaveText("100%");
  });

  test("opens from the Reports navigation item", async ({
    app
  }) => {
    await app.page.getByTestId("nav-reports").click();

    await expect(
      app.page.getByTestId("page-reports")
    ).toBeVisible();

    await expect(
      app.page.getByTestId("reports-page")
    ).toBeVisible();
  });
});
