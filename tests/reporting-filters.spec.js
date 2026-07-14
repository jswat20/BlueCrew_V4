import {
  test,
  expect
} from "./fixtures/app.fixture.js";

test.describe("Reporting Filters", () => {
  test.beforeEach(async ({ app }) => {
    await app.page.evaluate(() => {
      localStorage.clear();

      games.splice(0, games.length);
      crew.splice(0, crew.length);

      Object.keys(reportsPageState)
        .forEach(key => {
          reportsPageState[key] = "";
        });

      authService.loginAsAdmin();
      document.body.dataset.role = "admin";
    });
  });

  test("filters assignment reports by date range", async ({
    app
  }) => {
    await app.page.evaluate(() => {
      gameService.create({
        id: "filter-date-one",
        date: "2028-06-01",
        field: "North",
        level: "12U",
        awayTeam: "A",
        homeTeam: "B",
        gameType: "single"
      });

      gameService.create({
        id: "filter-date-two",
        date: "2028-07-01",
        field: "South",
        level: "14U",
        awayTeam: "C",
        homeTeam: "D",
        gameType: "single"
      });

      renderPage("reports");
    });

    await app.page
      .getByTestId("reports-filter-start-date")
      .fill("2028-07-01");

    await app.page
      .getByTestId("reports-filter-start-date")
      .dispatchEvent("change");

    await expect(
      app.page.getByTestId(
        "assignment-report-total-games"
      )
    ).toHaveText("1");
  });

  test("filters assignment reports by level", async ({
    app
  }) => {
    await app.page.evaluate(() => {
      gameService.create({
        id: "filter-level-one",
        date: "2028-06-01",
        field: "North",
        level: "12U",
        awayTeam: "A",
        homeTeam: "B",
        gameType: "single"
      });

      gameService.create({
        id: "filter-level-two",
        date: "2028-06-02",
        field: "South",
        level: "14U",
        awayTeam: "C",
        homeTeam: "D",
        gameType: "single"
      });

      renderPage("reports");
    });

    await app.page
      .getByTestId("reports-filter-level")
      .selectOption("14U");

    await expect(
      app.page.getByTestId(
        "assignment-report-total-games"
      )
    ).toHaveText("1");

    await app.page
      .getByTestId("assignment-report-toggle")
      .click();

    await expect(
      app.page.getByTestId(
        "assignment-report-detail"
      )
    ).toContainText("14U");
  });

  test("filters availability by crew member", async ({
    app
  }) => {
    await app.page.evaluate(() => {
      crew.push(
        {
          id: "filter-crew-one",
          firstName: "Alex",
          lastName: "Blue",
          active: true
        },
        {
          id: "filter-crew-two",
          firstName: "Taylor",
          lastName: "Green",
          active: true
        }
      );

      availabilityService.setAvailability({
        crewId: "filter-crew-one",
        date: "2028-06-01",
        status: "available"
      });

      availabilityService.setAvailability({
        crewId: "filter-crew-two",
        date: "2028-06-01",
        status: "unavailable"
      });

      renderPage("reports");
    });

    await app.page
      .getByTestId("reports-filter-crew")
      .selectOption("filter-crew-one");

    await expect(
      app.page.getByTestId(
        "availability-report-available"
      )
    ).toHaveText("1");

    await expect(
      app.page.getByTestId(
        "availability-report-unavailable"
      )
    ).toHaveText("0");
  });

  test("filters review reports by status", async ({
    app
  }) => {
    await app.page.evaluate(() => {
      games.push(
        {
          id: "filter-submitted",
          date: "2028-06-01",
          review: {
            status: "submitted",
            submittedAt:
              "2028-06-01T12:00:00.000Z"
          }
        },
        {
          id: "filter-approved",
          date: "2028-06-02",
          review: {
            status: "approved",
            submittedAt:
              "2028-06-02T12:00:00.000Z"
          }
        }
      );

      saveGames();
      renderPage("reports");
    });

    await app.page
      .getByTestId("reports-filter-status")
      .selectOption("approved");

    await expect(
      app.page.getByTestId(
        "review-report-submitted"
      )
    ).toHaveText("0");

    await expect(
      app.page.getByTestId(
        "review-report-approved"
      )
    ).toHaveText("1");
  });

  test("reset restores unfiltered results", async ({
    app
  }) => {
    await app.page.evaluate(() => {
      gameService.create({
        id: "filter-reset-one",
        date: "2028-06-01",
        field: "North",
        level: "12U",
        awayTeam: "A",
        homeTeam: "B",
        gameType: "single"
      });

      gameService.create({
        id: "filter-reset-two",
        date: "2028-06-02",
        field: "South",
        level: "14U",
        awayTeam: "C",
        homeTeam: "D",
        gameType: "single"
      });

      renderPage("reports");
    });

    await app.page
      .getByTestId("reports-filter-field")
      .selectOption("North");

    await expect(
      app.page.getByTestId(
        "assignment-report-total-games"
      )
    ).toHaveText("1");

    await app.page
      .getByTestId("reports-filter-reset")
      .click();

    await expect(
      app.page.getByTestId(
        "assignment-report-total-games"
      )
    ).toHaveText("2");
  });
});
