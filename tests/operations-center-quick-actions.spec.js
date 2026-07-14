import {
  expect,
  test
} from "@playwright/test";

test.describe(
  "Operations Center quick actions",
  () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/");
    });

    test(
      "assigns the recommended crew and recalculates",
      async ({ page }) => {
        await page.evaluate(() => {
          const game = {
            id: "quick-assignment-game",
            awayTeam: "Visitors",
            homeTeam: "Home",
            date: "2028-06-01",
            time: "6:00 PM"
          };

          window.__operationsQuickActionCalls = [];

          gameService.getById = id =>
            String(id) === String(game.id)
              ? game
              : null;

          recommendationService
            .getBestCrewForGame = suppliedGame => ({
              crewId: "recommended-crew",
              gameId: suppliedGame.id
            });

          assignmentService.assignCrew = (
            gameId,
            crewId
          ) => {
            window.__operationsQuickActionCalls.push({
              type: "assign",
              gameId,
              crewId
            });

            return {
              success: true,
              message: "Crew assigned."
            };
          };

          dashboardService
            .getOperationsCenter = () => ({
              currentTask: {
                key: "needsAssignment",
                title: "Needs Assignment",
                count: 1,
                action: "needs-assignment",
                items: [
                  {
                    id: game.id,
                    gameId: game.id,
                    matchup:
                      "Visitors @ Home"
                  }
                ]
              },
              remainingTasks: [],
              queueCounts: {
                needsAssignment: 1,
                pendingClaims: 0,
                awaitingReview: 0,
                returnedReviews: 0,
                todaysPriorities: 0
              },
              recentActivity: [],
              operationalProgress: {
                completed: 4,
                total: 5,
                percent: 80
              },
              outstandingCount: 1,
              isEmpty: false
            });

          renderPage("operations-center");
        });

        await page
          .getByTestId(
            "operations-assign-recommended"
          )
          .click();

        const calls =
          await page.evaluate(
            () =>
              window.__operationsQuickActionCalls
          );

        expect(calls).toEqual([
          {
            type: "assign",
            gameId:
              "quick-assignment-game",
            crewId:
              "recommended-crew"
          }
        ]);

        await expect(
          page.getByTestId(
            "operations-center"
          )
        ).toBeVisible();
      }
    );

    test(
      "approves the exact pending claim",
      async ({ page }) => {
        await page.evaluate(() => {
          window.__operationsQuickActionCalls = [];

          claimsQueueService.approveClaim = (
            gameId,
            assignmentId
          ) => {
            window.__operationsQuickActionCalls.push({
              type: "approve",
              gameId,
              assignmentId
            });

            return {
              success: true,
              message: "Claim approved."
            };
          };

          dashboardService
            .getOperationsCenter = () => ({
              currentTask: {
                key: "pendingClaims",
                title: "Pending Claims",
                count: 1,
                action: "pending-claim",
                items: [
                  {
                    gameId:
                      "quick-claim-game",
                    assignmentId:
                      "quick-assignment"
                  }
                ]
              },
              remainingTasks: [],
              queueCounts: {
                needsAssignment: 0,
                pendingClaims: 1,
                awaitingReview: 0,
                returnedReviews: 0,
                todaysPriorities: 0
              },
              recentActivity: [],
              operationalProgress: {
                completed: 4,
                total: 5,
                percent: 80
              },
              outstandingCount: 1,
              isEmpty: false
            });

          renderPage("operations-center");
        });

        await page
          .getByTestId(
            "operations-approve-claim"
          )
          .click();

        const calls =
          await page.evaluate(
            () =>
              window.__operationsQuickActionCalls
          );

        expect(calls).toEqual([
          {
            type: "approve",
            gameId:
              "quick-claim-game",
            assignmentId:
              "quick-assignment"
          }
        ]);
      }
    );

    test(
      "rejects the exact pending claim",
      async ({ page }) => {
        await page.evaluate(() => {
          window.__operationsQuickActionCalls = [];

          claimsQueueService.rejectClaim = (
            gameId,
            assignmentId
          ) => {
            window.__operationsQuickActionCalls.push({
              type: "reject",
              gameId,
              assignmentId
            });

            return {
              success: true,
              message: "Claim rejected."
            };
          };

          dashboardService
            .getOperationsCenter = () => ({
              currentTask: {
                key: "pendingClaims",
                title: "Pending Claims",
                count: 1,
                action: "pending-claim",
                items: [
                  {
                    gameId:
                      "reject-claim-game",
                    assignmentId:
                      "reject-assignment"
                  }
                ]
              },
              remainingTasks: [],
              queueCounts: {
                needsAssignment: 0,
                pendingClaims: 1,
                awaitingReview: 0,
                returnedReviews: 0,
                todaysPriorities: 0
              },
              recentActivity: [],
              operationalProgress: {
                completed: 4,
                total: 5,
                percent: 80
              },
              outstandingCount: 1,
              isEmpty: false
            });

          renderPage("operations-center");
        });

        await page
          .getByTestId(
            "operations-reject-claim"
          )
          .click();

        const calls =
          await page.evaluate(
            () =>
              window.__operationsQuickActionCalls
          );

        expect(calls).toEqual([
          {
            type: "reject",
            gameId:
              "reject-claim-game",
            assignmentId:
              "reject-assignment"
          }
        ]);
      }
    );

    test(
      "review tasks remain navigation-only",
      async ({ page }) => {
        await page.evaluate(() => {
          dashboardService
            .getOperationsCenter = () => ({
              currentTask: {
                key: "awaitingReview",
                title: "Awaiting Review",
                count: 1,
                action: "awaiting-review",
                items: [
                  {
                    gameId:
                      "review-navigation-game"
                  }
                ]
              },
              remainingTasks: [],
              queueCounts: {
                needsAssignment: 0,
                pendingClaims: 0,
                awaitingReview: 1,
                returnedReviews: 0,
                todaysPriorities: 0
              },
              recentActivity: [],
              operationalProgress: {
                completed: 4,
                total: 5,
                percent: 80
              },
              outstandingCount: 1,
              isEmpty: false
            });

          renderPage("operations-center");
        });

        await expect(
          page.getByTestId(
            "operations-quick-actions"
          )
        ).toHaveCount(0);

        await expect(
          page.getByTestId(
            "operations-current-task-action"
          )
        ).toBeVisible();
      }
    );

    test(
      "failed commands keep the task visible",
      async ({ page }) => {
        await page.evaluate(() => {
          claimsQueueService.approveClaim =
            () => ({
              success: false,
              message:
                "Claim could not be approved."
            });

          dashboardService
            .getOperationsCenter = () => ({
              currentTask: {
                key: "pendingClaims",
                title: "Pending Claims",
                count: 1,
                action: "pending-claim",
                items: [
                  {
                    gameId:
                      "failed-claim-game",
                    assignmentId:
                      "failed-assignment"
                  }
                ]
              },
              remainingTasks: [],
              queueCounts: {
                needsAssignment: 0,
                pendingClaims: 1,
                awaitingReview: 0,
                returnedReviews: 0,
                todaysPriorities: 0
              },
              recentActivity: [],
              operationalProgress: {
                completed: 4,
                total: 5,
                percent: 80
              },
              outstandingCount: 1,
              isEmpty: false
            });

          renderPage("operations-center");
        });

        await page
          .getByTestId(
            "operations-approve-claim"
          )
          .click();

        await expect(
          page.getByTestId(
            "operations-action-message"
          )
        ).toHaveText(
          "Claim could not be approved."
        );

        await expect(
          page.getByTestId(
            "operations-current-task"
          )
        ).toBeVisible();
      }
    );
  }
);
