import {
  expect,
  test
} from "@playwright/test";

test.describe(
  "Operations Center live feed",
  () => {
    test.beforeEach(
      async ({ page }) => {
        await page.goto("/");

        await page.evaluate(() => {
          if (
            typeof authService !==
              "undefined" &&
            typeof authService
              .loginAsAdmin ===
              "function"
          ) {
            authService.loginAsAdmin();
          }
        });
      }
    );

    test(
      "includes mixed operational activity types",
      async ({ page }) => {
        const result =
          await page.evaluate(() => {
            const stamp =
              Date.now();

            const events = [
              ["assignment", "assigned"],
              ["account", "account_created"],
              ["import", "games_imported"],
              ["review", "review_approved"],
              ["claim", "claim_submitted"],
              [
                "availability",
                "availability_updated"
              ],
              ["game", "game_updated"],
              ["schedule", "schedule_updated"],
              ["conflict", "conflict_detected"],
              ["profile", "profile_updated"],
              ["login", "signed_in"],
              [
                "communication",
                "message_sent"
              ]
            ];

            const ids =
              events.map(
                ([type], index) =>
                  `operations-${type}-${stamp}-${index}`
              );

            events.forEach(
              (
                [type, action],
                index
              ) => {
                activityService.log({
                  id: ids[index],
                  type,
                  action,
                  message:
                    `${type} activity recorded.`
                });
              }
            );

            const feed =
              dashboardService
                .getRecentOperationalActivity(
                  events.length
                );

            return {
              ids,
              matching:
                feed.filter(
                  item =>
                    ids.includes(
                      item.id
                    )
                )
            };
          });

        expect(
          result.matching
            .map(
              item => item.type
            )
        ).toEqual(
          expect.arrayContaining([
            "assignment",
            "account",
            "import",
            "review",
            "claim",
            "availability",
            "game",
            "schedule",
            "conflict",
            "profile",
            "login",
            "communication"
          ])
        );
      }
    );

    test(
      "returns presentation-ready normalized fields",
      async ({ page }) => {
        const result =
          await page.evaluate(() => {
            const id =
              `operations-normalized-${Date.now()}`;

            activityService.log({
              id,
              type: "account",
              action:
                "account_approved",
              message:
                "Umpire account approved."
            });

            return dashboardService
              .getOperationsCenter()
              .recentActivity
              .find(
                item =>
                  item.id === id
              );
          });

        expect(result).toEqual(
          expect.objectContaining({
            type: "account",
            category: "Accounts",
            actionLabel:
              "Account Approved",
            message:
              "Umpire account approved.",
            createdAt:
              expect.any(String)
          })
        );
      }
    );

    test(
      "renders non-assignment events in the live feed",
      async ({ page }) => {
        const id =
          await page.evaluate(() => {
            const activityId =
              `operations-feed-${Date.now()}`;

            activityService.log({
              id: activityId,
              type: "import",
              action:
                "games_imported",
              message:
                "Twelve games added to the schedule."
            });

            renderPage(
              "operations-center"
            );

            return activityId;
          });

        const item =
          page.locator(
            `[data-activity-id="${id}"]`
          );

        await expect(
          item
        ).toBeVisible();

        await expect(
          item
        ).toContainText(
          "Games Imported"
        );

        await expect(
          item
        ).toContainText(
          "Twelve games added to the schedule."
        );
      }
    );

    test(
      "keeps dashboard assignment activity filtered",
      async ({ page }) => {
        const result =
          await page.evaluate(() => {
            const stamp =
              Date.now();

            activityService.log({
              id:
                `dashboard-account-${stamp}`,
              type: "account",
              action:
                "account_created",
              message:
                "Account should not enter assignment feed."
            });

            activityService.log({
              id:
                `dashboard-assignment-${stamp}`,
              type: "assignment",
              action: "assigned",
              message:
                "Assignment should remain visible."
            });

            return dashboardService
              .getRecentAssignmentActivity(
                10
              )
              .map(
                item => item.id
              );
          });

        expect(
          result.some(
            id =>
              id.startsWith(
                "dashboard-account-"
              )
          )
        ).toBe(false);

        expect(
          result.some(
            id =>
              id.startsWith(
                "dashboard-assignment-"
              )
          )
        ).toBe(true);
      }
    );

    test(
      "limits Operations Center feed density",
      async ({ page }) => {
        const count =
          await page.evaluate(() => {
            for (
              let index = 0;
              index < 12;
              index += 1
            ) {
              activityService.log({
                id:
                  `operations-limit-${Date.now()}-${index}`,
                type: "game",
                action:
                  "game_updated",
                message:
                  `Game ${index} updated.`
              });
            }

            return dashboardService
              .getOperationsCenter()
              .recentActivity
              .length;
          });

        expect(count).toBeLessThanOrEqual(
          8
        );
      }
    );
  }
);
