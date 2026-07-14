import {
  test,
  expect
} from "./fixtures/app.fixture.js";

test.describe("Reporting Service", () => {
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
    });
  });

  test("returns an empty assignment report", async ({
    app
  }) => {
    const report = await app.page.evaluate(() =>
      reportingService.getAssignmentReport()
    );

    expect(report).toEqual({
      totalGames: 0,
      assigned: 0,
      openAssignments: 0,
      pendingClaims: 0,
      fullyStaffed: 0,
      assignmentRate: 0
    });
  });

  test("returns an empty availability report", async ({
    app
  }) => {
    const report = await app.page.evaluate(() =>
      reportingService.getAvailabilityReport()
    );

    expect(report).toEqual({
      available: 0,
      unavailable: 0,
      maybe: 0,
      noResponse: 0
    });
  });

  test("returns review status totals", async ({
    app
  }) => {
    const report = await app.page.evaluate(() => {
      games.push(
        {
          id: "submitted-report-game",
          review: {
            status: "submitted",
            submittedAt:
              "2026-07-01T12:00:00.000Z"
          }
        },
        {
          id: "returned-report-game",
          review: {
            status: "returned",
            submittedAt:
              "2026-07-02T12:00:00.000Z"
          }
        },
        {
          id: "approved-report-game",
          review: {
            status: "approved",
            submittedAt:
              "2026-07-03T12:00:00.000Z"
          }
        }
      );

      saveGames();

      return reportingService.getReviewReport();
    });

    expect(report).toEqual({
      submitted: 1,
      returned: 1,
      approved: 1,
      completionPercentage: 33
    });
  });

  test("assignment report updates after mutation", async ({
    app
  }) => {
    const reports = await app.page.evaluate(() => {
      const game = gameService.create({
        id: "report-assignment-game",
        date: "2028-06-01",
        time: "6:00 PM",
        field: "Field 1",
        level: "12U",
        awayTeam: "Away",
        homeTeam: "Home",
        gameType: "single"
      }).data;

      const before =
        reportingService.getAssignmentReport();

      const assignment =
        assignmentService
          .getAssignments(game)[0];

      assignmentService.assignToAssignment(
        game.id,
        assignment.id,
        "report-crew"
      );

      const after =
        reportingService.getAssignmentReport();

      return {
        before,
        after
      };
    });

    expect(reports.before.totalGames).toBe(1);
    expect(
      reports.before.openAssignments
    ).toBeGreaterThan(0);

    expect(reports.after.assigned).toBe(1);
    expect(reports.after.fullyStaffed).toBe(1);
    expect(reports.after.assignmentRate).toBe(100);
  });
});
