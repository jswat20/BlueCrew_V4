import {
  expect,
  test
} from "@playwright/test";

test.describe(
  "Operations Center workflow advancement",
  () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/");
    });

    test(
      "advances after approving a pending claim",
      async ({ page }) => {
        await page.evaluate(() => {
          function createSnapshot({
            currentTask,
            outstandingCount,
            completed,
            percent
          }) {
            return {
              currentTask,
              remainingTasks: [],
              queueCounts: {
                needsAssignment: 0,
                pendingClaims:
                  currentTask?.key ===
                    "pendingClaims"
                    ? currentTask.count
                    : 0,
                awaitingReview:
                  currentTask?.key ===
                    "awaitingReview"
                    ? currentTask.count
                    : 0,
                returnedReviews: 0,
                todaysPriorities: 0
              },
              recentActivity: [],
              operationalProgress: {
                completed,
                total: 5,
                percent
              },
              outstandingCount,
              isEmpty: !currentTask
            };
          }

          let approved = false;

          claimsQueueService.approveClaim =
            (
              gameId,
              assignmentId
            ) => {
              if (
                gameId ===
                  "workflow-claim-game" &&
                assignmentId ===
                  "workflow-assignment"
              ) {
                approved = true;
              }

              return {
                success: true,
                message: "Claim approved."
              };
            };

          dashboardService
            .getOperationsCenter = () =>
              approved
                ? createSnapshot({
                    currentTask: {
                      key: "awaitingReview",
                      title:
                        "Awaiting Review",
                      count: 1,
                      action:
                        "awaiting-review",
                      items: [
                        {
                          gameId:
                            "workflow-review-game",
                          matchup:
                            "Next Away @ Next Home"
                        }
                      ]
                    },
                    outstandingCount: 1,
                    completed: 4,
                    percent: 80
                  })
                : createSnapshot({
                    currentTask: {
                      key: "pendingClaims",
                      title:
                        "Pending Claims",
                      count: 1,
                      action:
                        "pending-claim",
                      items: [
                        {
                          gameId:
                            "workflow-claim-game",
                          assignmentId:
                            "workflow-assignment",
                          claimedByName:
                            "Test Umpire"
                        }
                      ]
                    },
                    outstandingCount: 1,
                    completed: 4,
                    percent: 80
                  });

          renderPage("operations-center");
        });

        await expect(
          page.getByTestId(
            "operations-workflow-current-queue"
          )
        ).toContainText("Pending Claims");

        await page
          .getByTestId(
            "operations-approve-claim"
          )
          .click();

        await expect(
          page.getByTestId(
            "operations-action-message"
          )
        ).toHaveText("Claim approved.");

        await expect(
          page.getByTestId(
            "operations-workflow-current-queue"
          )
        ).toContainText(
          "Awaiting Review"
        );

        await expect(
          page.getByTestId(
            "operations-current-task-action"
          )
        ).toBeVisible();

        await expect(
          page.getByTestId(
            "operations-quick-actions"
          )
        ).toHaveCount(0);

        const state =
          await page.evaluate(() => ({
            page: currentPage,
            context: currentPageContext
          }));

        expect(state.page)
          .toBe("operations-center");

        expect(
          state.context.operationsFlash
        ).toBeUndefined();
      }
    );

    test(
      "shows completion after rejecting the final claim",
      async ({ page }) => {
        await page.evaluate(() => {
          function createSnapshot({
            currentTask,
            outstandingCount,
            completed,
            percent
          }) {
            return {
              currentTask,
              remainingTasks: [],
              queueCounts: {
                needsAssignment: 0,
                pendingClaims:
                  currentTask?.key ===
                    "pendingClaims"
                    ? currentTask.count
                    : 0,
                awaitingReview: 0,
                returnedReviews: 0,
                todaysPriorities: 0
              },
              recentActivity: [],
              operationalProgress: {
                completed,
                total: 5,
                percent
              },
              outstandingCount,
              isEmpty: !currentTask
            };
          }

          let complete = false;

          claimsQueueService.rejectClaim =
            (
              gameId,
              assignmentId
            ) => {
              if (
                gameId ===
                  "final-workflow-game" &&
                assignmentId ===
                  "final-workflow-assignment"
              ) {
                complete = true;
              }

              return {
                success: true,
                message: "Claim rejected."
              };
            };

          dashboardService
            .getOperationsCenter = () =>
              complete
                ? createSnapshot({
                    currentTask: null,
                    outstandingCount: 0,
                    completed: 5,
                    percent: 100
                  })
                : createSnapshot({
                    currentTask: {
                      key: "pendingClaims",
                      title:
                        "Pending Claims",
                      count: 1,
                      action:
                        "pending-claim",
                      items: [
                        {
                          gameId:
                            "final-workflow-game",
                          assignmentId:
                            "final-workflow-assignment",
                          claimedByName:
                            "Final Umpire"
                        }
                      ]
                    },
                    outstandingCount: 1,
                    completed: 4,
                    percent: 80
                  });

          renderPage("operations-center");
        });

        await page
          .getByTestId(
            "operations-reject-claim"
          )
          .click();

        await expect(
          page.getByTestId(
            "operations-action-message"
          )
        ).toHaveText("Claim rejected.");

        await expect(
          page.getByTestId(
            "operations-center-empty"
          )
        ).toBeVisible();

        await expect(
          page.getByTestId(
            "operations-workflow-outstanding"
          )
        ).toContainText("0");

        await expect(
          page.getByTestId(
            "operations-workflow-progress"
          )
        ).toContainText("100%");

        await expect(
          page.getByTestId(
            "operations-workflow-current-queue"
          )
        ).toContainText("Complete");
      }
    );
  }
);
