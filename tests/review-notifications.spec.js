import {
  expect,
  test
} from "@playwright/test";

test.describe(
  "Review Notifications",
  () => {
    test.beforeEach(
      async ({ page }) => {
        await page.goto("/");

        await page.evaluate(() => {
          notificationService
            .clearAll();
        });
      }
    );

    test(
      "submitting a review creates one admin notification",
      async ({ page }) => {
        const result =
          await page.evaluate(() => {
            const originalUpdate =
              gameService.update;

            const originalGetById =
              gameService.getById;

            const originalAccount =
              loginService
                .getCurrentAccount;

            const game = {
              id:
                "review-submit-game",
              awayTeam: "Visitors",
              homeTeam: "Home",
              completed: true,
              crewId: "crew-review",
              assignments: [
                {
                  crewId:
                    "crew-review",
                  status: "assigned"
                }
              ],
              review: {
                status: "draft"
              }
            };

            loginService
              .getCurrentAccount =
              () => ({
                id: "review-account",
                crewId: "crew-review",
                firstName: "Review",
                lastName: "Umpire"
              });

            gameService.getById =
              id =>
                id === game.id
                  ? game
                  : null;

            gameService.update =
              (
                id,
                changes
              ) => {
                Object.assign(
                  game,
                  changes
                );

                return {
                  success: true,
                  data: game
                };
              };

            const command =
              portalService
                .submitGameForReview(
                  game.id
                );

            const notifications =
              notificationService
                .getNotifications();

            gameService.update =
              originalUpdate;

            gameService.getById =
              originalGetById;

            loginService
              .getCurrentAccount =
              originalAccount;

            return {
              command,
              notifications
            };
          });

        expect(result.command.success)
          .toBe(true);

        expect(result.notifications)
          .toHaveLength(1);

        expect(
          result.notifications[0]
        ).toEqual(
          expect.objectContaining({
            type: "review-submitted",
            title:
              "Game Submitted for Review",
            relatedId:
              "review-submit-game",
            audience: "admin",
            destination: {
              page: "game-hub",
              context: {
                gameId:
                  "review-submit-game"
              }
            }
          })
        );
      }
    );

    test(
      "repeated submission does not duplicate the notification",
      async ({ page }) => {
        const count =
          await page.evaluate(() => {
            const originalUpdate =
              gameService.update;

            const originalGetById =
              gameService.getById;

            const originalAccount =
              loginService
                .getCurrentAccount;

            const game = {
              id:
                "review-idempotent-game",
              awayTeam: "Visitors",
              homeTeam: "Home",
              completed: true,
              crewId: "crew-review",
              assignments: [
                {
                  crewId:
                    "crew-review",
                  status: "assigned"
                }
              ],
              review: {
                status: "draft"
              }
            };

            loginService
              .getCurrentAccount =
              () => ({
                crewId: "crew-review",
                firstName: "Review",
                lastName: "Umpire"
              });

            gameService.getById =
              id =>
                id === game.id
                  ? game
                  : null;

            gameService.update =
              (
                id,
                changes
              ) => {
                Object.assign(
                  game,
                  changes
                );

                return {
                  success: true,
                  data: game
                };
              };

            portalService
              .submitGameForReview(
                game.id
              );

            portalService
              .submitGameForReview(
                game.id
              );

            const notifications =
              notificationService
                .getNotifications();

            gameService.update =
              originalUpdate;

            gameService.getById =
              originalGetById;

            loginService
              .getCurrentAccount =
              originalAccount;

            return notifications.length;
          });

        expect(count).toBe(1);
      }
    );

    test(
      "review notification opens the exact game",
      async ({ page }) => {
        const notificationId =
          await page.evaluate(() => {
            const result =
              notificationService.create({
                type:
                  "review-submitted",
                title:
                  "Game Submitted for Review",
                message:
                  "Visitors @ Home is ready.",
                relatedId:
                  "review-navigation-game",
                audience: "admin",
                destination: {
                  page: "game-hub",
                  context: {
                    gameId:
                      "review-navigation-game",
                    reviewMode: true
                  }
                }
              });

            renderPage(
              "notifications"
            );

            return result.data.id;
          });

        await page
          .locator(
            `[data-testid="notification-action"]` +
            `[data-notification-id="${notificationId}"]`
          )
          .click();

        const state =
          await page.evaluate(() => ({
            page: currentPage,
            context:
              currentPageContext
          }));

        expect(state).toEqual({
          page: "game-hub",
          context: {
            gameId:
              "review-navigation-game",
            reviewMode: true
          }
        });
      }
    );
  }
);

test.describe(
  "Review approval notifications",
  () => {
    test.beforeEach(
      async ({ page }) => {
        await page.goto("/");

        await page.evaluate(() => {
          notificationService
            .clearAll();

          authService.loginAsAdmin();

          document.body.dataset.role =
            "admin";

          if (window.BlueCrew?.test) {
            window.BlueCrew.test
              .currentRole =
              "admin";
          }
        });
      }
    );

    test(
      "approving a submitted review creates one umpire notification",
      async ({ page }) => {
        const result =
          await page.evaluate(() => {
            const game =
              gameService.create({
                date: "2099-10-01",
                time: "6:00 PM",
                field:
                  "Approval Notification Field",
                level: "12U",
                homeTeam:
                  "Approval Home",
                awayTeam:
                  "Approval Away",
                gameType: "single"
              }).data;

            const crew =
              crewService.getAll()[0];

            const assignments =
              assignmentService
                .getAssignments(game);

            assignments[0].crewId =
              crew.id;
            assignments[0].position =
              "Plate";
            assignments[0].status =
              "assigned";

            game.crewId = crew.id;
            game.assignmentStatus =
              "assigned";
            game.completed = true;
            game.completionStatus =
              "completed";
            game.status = "completed";

            gameService.save();

            const originalAccount =
              loginService
                .getCurrentAccount;

            loginService
              .getCurrentAccount =
              () => ({
                id:
                  "review-approval-account",
                crewId: crew.id,
                firstName: "Review",
                lastName: "Umpire"
              });

            const submitResult =
              portalService
                .submitGameForReview(
                  game.id
                );

            loginService
              .getCurrentAccount =
              originalAccount;

            if (!submitResult.success) {
              return {
                gameId: game.id,
                command: submitResult,
                notifications:
                  notificationService
                    .getNotifications()
              };
            }

            notificationService
              .clearAll();

            authService.loginAsAdmin();

            const command =
              portalService.approveReview(
                game.id
              );

            return {
              gameId: game.id,
              command,
              notifications:
                notificationService
                  .getNotifications()
            };
          });

        expect(result.command.success)
          .toBe(true);

        expect(result.notifications)
          .toHaveLength(1);

        expect(
          result.notifications[0]
        ).toEqual(
          expect.objectContaining({
            type: "review-approved",
            title:
              "Game Review Approved",
            relatedId: result.gameId,
            audience: "umpire",
            destination: {
              page: "game-hub",
              context: {
                gameId: result.gameId
              }
            }
          })
        );
      }
    );

    test(
      "failed approval creates no notification",
      async ({ page }) => {
        const result =
          await page.evaluate(() => {
            const command =
              portalService.approveReview(
                "missing-review-game"
              );

            return {
              command,
              notifications:
                notificationService
                  .getNotifications()
            };
          });

        expect(result.command.success)
          .toBe(false);

        expect(result.notifications)
          .toHaveLength(0);
      }
    );

    test(
      "approved review notification opens the exact game",
      async ({ page }) => {
        const notificationId =
          await page.evaluate(() => {
            const result =
              notificationService.create({
                type:
                  "review-approved",
                title:
                  "Game Review Approved",
                message:
                  "Approval Away @ Approval Home has been approved.",
                relatedId:
                  "approved-review-game",
                audience: "umpire",
                destination: {
                  page: "game-hub",
                  context: {
                    gameId:
                      "approved-review-game"
                  }
                }
              });

            renderPage(
              "notifications"
            );

            return result.data.id;
          });

        await page
          .locator(
            `[data-testid="notification-action"]` +
            `[data-notification-id="${notificationId}"]`
          )
          .click();

        const state =
          await page.evaluate(() => ({
            page: currentPage,
            context:
              currentPageContext
          }));

        expect(state).toEqual({
          page: "game-hub",
          context: {
            gameId:
              "approved-review-game"
          }
        });
      }
    );
  }
);
