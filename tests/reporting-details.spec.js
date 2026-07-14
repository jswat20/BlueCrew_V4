import {
  test,
  expect
} from "./fixtures/app.fixture.js";

test.describe("Reporting Detail Views", () => {
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

  test("assignment details are hidden until opened", async ({
    app
  }) => {
    await app.page.evaluate(() => {
      gameService.create({
        id: "report-detail-game",
        date: "2028-06-01",
        time: "6:00 PM",
        field: "Field 1",
        level: "12U",
        awayTeam: "Away",
        homeTeam: "Home",
        gameType: "single"
      });

      renderPage("reports");
    });

    const detail = app.page.getByTestId(
      "assignment-report-detail"
    );

    await expect(detail).toBeHidden();

    await app.page
      .getByTestId("assignment-report-toggle")
      .click();

    await expect(detail).toBeVisible();

    await expect(
      app.page.getByTestId(
        "assignment-report-row"
      )
    ).toHaveCount(1);
  });

  test("assignment detail updates after staffing mutation", async ({
    app
  }) => {
    await app.page.evaluate(() => {
      const game = gameService.create({
        id: "report-staffed-game",
        date: "2028-06-02",
        time: "7:00 PM",
        field: "Field 2",
        level: "14U",
        awayTeam: "Visitors",
        homeTeam: "Hosts",
        gameType: "single"
      }).data;

      const assignment =
        assignmentService
          .getAssignments(game)[0];

      assignmentService.assignToAssignment(
        game.id,
        assignment.id,
        "report-detail-crew"
      );

      renderPage("reports");
    });

    await app.page
      .getByTestId("assignment-report-toggle")
      .click();

    const row = app.page.getByTestId(
      "assignment-report-row"
    );

    await expect(row).toContainText(
      "Visitors @ Hosts"
    );

    await expect(row).toContainText(
      "Fully Staffed"
    );
  });

  test("availability detail renders crew responses", async ({
    app
  }) => {
    await app.page.evaluate(() => {
      crew.push({
        id: "availability-report-crew",
        firstName: "Jamie",
        lastName: "Blue",
        active: true
      });

      if (
        typeof saveCrew ===
        "function"
      ) {
        saveCrew();
      }

      availabilityService.setAvailability({
        crewId: "availability-report-crew",
        date: "2028-06-03",
        status: "available"
      });

      renderPage("reports");
    });

    await app.page
      .getByTestId("availability-report-toggle")
      .click();

    const row = app.page.getByTestId(
      "availability-report-row"
    );

    await expect(row).toContainText(
      "Jamie Blue"
    );

    await expect(row).toContainText(
      "Available"
    );
  });

  test("review detail renders all review outcomes", async ({
    app
  }) => {
    await app.page.evaluate(() => {
      games.push(
        {
          id: "detail-submitted",
          date: "2028-06-04",
          awayTeam: "A",
          homeTeam: "B",
          review: {
            status: "submitted",
            submittedAt:
              "2028-06-04T12:00:00.000Z"
          }
        },
        {
          id: "detail-returned",
          date: "2028-06-05",
          awayTeam: "C",
          homeTeam: "D",
          review: {
            status: "returned",
            submittedAt:
              "2028-06-05T12:00:00.000Z"
          }
        },
        {
          id: "detail-approved",
          date: "2028-06-06",
          awayTeam: "E",
          homeTeam: "F",
          review: {
            status: "approved",
            submittedAt:
              "2028-06-06T12:00:00.000Z"
          }
        }
      );

      saveGames();
      renderPage("reports");
    });

    await app.page
      .getByTestId("review-report-toggle")
      .click();

    await expect(
      app.page.getByTestId("review-report-row")
    ).toHaveCount(3);

    const detail = app.page.getByTestId(
      "review-report-detail"
    );

    await expect(detail).toContainText(
      "Submitted"
    );

    await expect(detail).toContainText(
      "Returned"
    );

    await expect(detail).toContainText(
      "Approved"
    );
  });

  test("detail sections render isolated empty states", async ({
    app
  }) => {
    await app.page.evaluate(() => {
      renderPage("reports");
    });

    await app.page
      .getByTestId("assignment-report-toggle")
      .click();

    await app.page
      .getByTestId("availability-report-toggle")
      .click();

    await app.page
      .getByTestId("review-report-toggle")
      .click();

    await expect(
      app.page.getByTestId(
        "assignment-report-detail-empty"
      )
    ).toBeVisible();

    await expect(
      app.page.getByTestId(
        "availability-report-detail-empty"
      )
    ).toBeVisible();

    await expect(
      app.page.getByTestId(
        "review-report-detail-empty"
      )
    ).toBeVisible();
  });
});
