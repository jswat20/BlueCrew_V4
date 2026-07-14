import {
  test,
  expect
} from "@playwright/test";

test.describe(
  "Game Lifecycle Schedule Actions",
  () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/");

      await page.evaluate(() => {
        authService.loginAsAdmin();
        notificationService.clearAll();
      });
    });

    test(
      "assigner can postpone a scheduled game",
      async ({ page }) => {
        const result =
          await page.evaluate(() => {
            const id =
              `postpone-${Date.now()}`;

            gameService.create({
              id,
              date: "2099-06-01",
              time: "18:00",
              homeTeam: "Home",
              awayTeam: "Away"
            });

            const command =
              portalService.postponeGame(id);

            const game =
              gameService.getById(id);

            const notifications =
              notificationService.getAll();

            const snapshot = {
              command,
              status:
                gameService.getStatus(game),
              postponedAt:
                game.postponedAt,
              notification:
                notifications.find(
                  item =>
                    item.relatedId === id &&
                    item.type ===
                      "game-postponed"
                )
            };

            gameService.delete(id);
            notificationService.clearAll();

            return snapshot;
          });

        expect(result.command.success).toBe(
          true
        );

        expect(result.status).toBe(
          "postponed"
        );

        expect(result.postponedAt).toBeTruthy();

        expect(
          result.notification?.title
        ).toBe("Game Postponed");

        expect(
          result.notification?.audience
        ).toBe("umpire");
      }
    );

    test(
      "assigner can cancel a scheduled game",
      async ({ page }) => {
        const result =
          await page.evaluate(() => {
            const id =
              `cancel-${Date.now()}`;

            gameService.create({
              id,
              date: "2099-06-02",
              time: "18:00",
              homeTeam: "Home",
              awayTeam: "Away"
            });

            const command =
              portalService.cancelGame(id);

            const game =
              gameService.getById(id);

            const notifications =
              notificationService.getAll();

            const snapshot = {
              command,
              status:
                gameService.getStatus(game),
              cancelledAt:
                game.cancelledAt,
              notification:
                notifications.find(
                  item =>
                    item.relatedId === id &&
                    item.type ===
                      "game-cancelled"
                )
            };

            gameService.delete(id);
            notificationService.clearAll();

            return snapshot;
          });

        expect(result.command.success).toBe(
          true
        );

        expect(result.status).toBe(
          "cancelled"
        );

        expect(result.cancelledAt).toBeTruthy();

        expect(
          result.notification?.title
        ).toBe("Game Cancelled");
      }
    );

    test(
      "cancelled games are excluded from dashboard operations",
      async ({ page }) => {
        const result =
          await page.evaluate(() => {
            const activeId =
              `active-${Date.now()}`;

            const cancelledId =
              `cancelled-${Date.now()}`;

            gameService.create({
              id: activeId,
              date: "2099-06-03",
              time: "18:00",
              homeTeam: "Active Home",
              awayTeam: "Active Away"
            });

            gameService.create({
              id: cancelledId,
              date: "2099-06-04",
              time: "18:00",
              homeTeam: "Cancelled Home",
              awayTeam: "Cancelled Away"
            });

            portalService.cancelGame(
              cancelledId
            );

            const upcoming =
              dashboardService
                .getUpcomingGames();

            const snapshot = {
              activeIncluded:
                upcoming.some(
                  game =>
                    game.id === activeId
                ),
              cancelledIncluded:
                upcoming.some(
                  game =>
                    game.id === cancelledId
                )
            };

            gameService.delete(activeId);
            gameService.delete(cancelledId);
            notificationService.clearAll();

            return snapshot;
          });

        expect(
          result.activeIncluded
        ).toBe(true);

        expect(
          result.cancelledIncluded
        ).toBe(false);
      }
    );

    test(
      "completed games cannot be postponed or cancelled",
      async ({ page }) => {
        const result =
          await page.evaluate(() => {
            const id =
              `completed-${Date.now()}`;

            gameService.create({
              id,
              date: "2099-06-05",
              time: "18:00",
              homeTeam: "Home",
              awayTeam: "Away"
            });

            gameService.transitionStatus(
              id,
              "completed",
              {
                completed: true
              }
            );

            const postponed =
              portalService.postponeGame(id);

            const cancelled =
              portalService.cancelGame(id);

            const status =
              gameService.getStatus(id);

            gameService.delete(id);

            return {
              postponed,
              cancelled,
              status
            };
          });

        expect(
          result.postponed.success
        ).toBe(false);

        expect(
          result.cancelled.success
        ).toBe(false);

        expect(result.status).toBe(
          "completed"
        );
      }
    );
  }
);
