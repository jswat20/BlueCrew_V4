import {
  test,
  expect
} from "./fixtures/app.fixture.js";

test.describe(
  "Assignment activity dashboard",
  () => {
    test.beforeEach(async ({ app }) => {
      await app.page.evaluate(() => {
        localStorage.removeItem(
          "bluecrew_activity"
        );

        authService.loginAsAdmin();
        document.body.dataset.role =
          "admin";

        if (window.BlueCrew?.test) {
          window.BlueCrew.test.currentRole =
            "admin";
        }
      });
    });

    test("shows an empty state", async ({ app }) => {
      await app.page.evaluate(() => {
        renderPage("dashboard");
      });

      await expect(
        app.page.getByTestId(
          "dashboard-assignment-activity-empty"
        )
      ).toHaveText(
        "No recent assignment activity."
      );
    });

    test("manual assignment appears", async ({ app }) => {
      await app.page.evaluate(() => {
        const game = gameService.create({
          date: "2099-09-01",
          time: "6:00 PM",
          field: "Activity Dashboard Field",
          level: "12U",
          homeTeam:
            "Activity Dashboard Home",
          awayTeam:
            "Activity Dashboard Away",
          gameType: "single"
        }).data;

        const crew =
          crewService.getAll()[0];

        assignmentService.assignCrew(
          game.id,
          crew.id
        );

        renderPage("dashboard");
      });

      await expect(
        app.page.getByTestId(
          "dashboard-assignment-activity-action"
        ).first()
      ).toHaveText("Assigned");

      await expect(
        app.page.getByTestId(
          "dashboard-assignment-activity-matchup"
        ).first()
      ).toHaveText(
        "Activity Dashboard Away @ Activity Dashboard Home"
      );
    });

    test("claim approval appears", async ({ app }) => {
      await app.page.evaluate(() => {
        const game = gameService.create({
          date: "2099-09-02",
          time: "7:00 PM",
          field: "Claim Activity Field",
          level: "12U",
          homeTeam:
            "Claim Activity Home",
          awayTeam:
            "Claim Activity Away",
          gameType: "single"
        }).data;

        assignmentService.openForClaim(
          game.id
        );

        const assignment =
          assignmentService
            .getAssignments(game)[0];

        const crew =
          crewService.getAll()[0];

        assignment.claimedBy = crew.id;
        assignment.status =
          "pending_approval";

        assignmentService.approveClaim(
          game.id
        );

        renderPage("dashboard");
      });

      await expect(
        app.page.getByTestId(
          "dashboard-assignment-activity-action"
        ).first()
      ).toHaveText("Claim Approved");
    });

    test("activity is newest first", async ({ app }) => {
      await app.page.evaluate(() => {
        activityService.log({
          type: "assignment",
          action: "assigned",
          matchup: "First Away @ First Home",
          message: "First",
          createdAt:
            "2099-09-01T12:00:00.000Z"
        });

        activityService.log({
          type: "assignment",
          action: "cleared",
          matchup:
            "Second Away @ Second Home",
          message: "Second",
          createdAt:
            "2099-09-01T13:00:00.000Z"
        });

        renderPage("dashboard");
      });

      const matchups =
        app.page.getByTestId(
          "dashboard-assignment-activity-matchup"
        );

      await expect(matchups.nth(0)).toHaveText(
        "Second Away @ Second Home"
      );

      await expect(matchups.nth(1)).toHaveText(
        "First Away @ First Home"
      );
    });

    test("shows only five recent activities", async ({ app }) => {
      await app.page.evaluate(() => {
        for (let index = 0; index < 7; index += 1) {
          activityService.log({
            type: "assignment",
            action: "assigned",
            matchup:
              `Away ${index} @ Home ${index}`,
            message:
              `Assignment ${index}`
          });
        }

        renderPage("dashboard");
      });

      await expect(
        app.page.getByTestId(
          "dashboard-assignment-activity-item"
        )
      ).toHaveCount(5);
    });
  }
);
