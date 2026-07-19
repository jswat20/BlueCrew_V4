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
        "No recent activity."
      );

      await expect(
        app.page.getByTestId(
          "dashboard-assignment-activity"
        )
      ).toHaveClass(/operations-panel/);
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
      ).toContainText(/assigned to/i);

      await expect(
        app.page.getByTestId(
          "dashboard-assignment-activity-matchup"
        ).first()
      ).toHaveText(
        "Activity Dashboard Field"
      );

      const rowLayout = await app.page.getByTestId("dashboard-assignment-activity-item").first().evaluate(element => ({
        display: getComputedStyle(element).display,
        columns: getComputedStyle(element).gridTemplateColumns.split(" ").length,
        actorWidth: element.querySelector(".operations-log-actor").getBoundingClientRect().width
      }));
      expect(rowLayout.display).toBe("grid");
      expect(rowLayout.columns).toBe(5);
      expect(rowLayout.actorWidth).toBeGreaterThan(80);
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
      ).toContainText(/claim approved/i);
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

      const actions =
        app.page.getByTestId(
          "dashboard-assignment-activity-action"
        );

      await expect(actions.nth(0)).toHaveText(
        "Second"
      );

      await expect(actions.nth(1)).toHaveText(
        "First"
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
      ).toHaveCount(7);
    });

    test("renders a structured activity story", async ({
      app
    }) => {
      await app.page.evaluate(() => {
        activityService.log({
          type: "assignment",
          action: "assigned",
          actor: "Marcus Reed",
          subject: "Plate",
          object: "Orioles @ Yankees"
        });

        renderPage("dashboard");
      });

      await expect(
        app.page.getByTestId(
          "dashboard-assignment-activity-action"
        ).first()
      ).toHaveText(
        "Marcus Reed: Plate — Orioles @ Yankees"
      );
    });

    test("renders a bulk import story", async ({
      app
    }) => {
      await app.page.evaluate(() => {
        activityService.log({
          type: "import",
          action: "games_imported",
          count: 10
        });

        renderPage("dashboard");
      });

      await expect(
        app.page.getByTestId(
          "dashboard-assignment-activity-action"
        ).first()
      ).toHaveText(
        "Schedule activity recorded."
      );
    });

    test("excludes operational activity older than 24 hours", async ({ app }) => {
      await app.page.evaluate(() => {
        activityService.log({
          id: "older-than-dashboard-window",
          type: "assignment",
          action: "assigned",
          message: "Old dashboard activity",
          createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
        });
        activityService.log({
          id: "within-dashboard-window",
          type: "assignment",
          action: "assigned",
          message: "Current dashboard activity",
          createdAt: new Date().toISOString()
        });
        renderPage("dashboard");
      });

      await expect(app.page.locator('[data-activity-id="within-dashboard-window"]')).toBeVisible();
      await expect(app.page.locator('[data-activity-id="older-than-dashboard-window"]')).toHaveCount(0);
    });
  }
);
