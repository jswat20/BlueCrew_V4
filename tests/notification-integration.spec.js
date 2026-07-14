import {
  expect,
  test
} from "@playwright/test";

test.describe(
  "Notification integration",
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
      "dashboard service aggregates unread count",
      async ({ page }) => {
        const summary =
          await page.evaluate(() => {
            notificationService.create({
              title: "First",
              message: "First update."
            });

            notificationService.create({
              title: "Second",
              message: "Second update."
            });

            return dashboardService
              .getNotificationsSummary();
          });

        expect(summary).toEqual(
          expect.objectContaining({
            unreadCount: 2,
            hasUnread: true,
            destination: {
              page: "notifications",
              context: {}
            }
          })
        );

        expect(
          summary.visibleNotificationCount
        ).toBe(2);

        expect(
          summary.unreadByCategory
        ).toEqual({
          other: 2
        });

        expect(
          summary.newestNotification.title
        ).toBe("Second");

        expect(
          summary.oldestUnread.title
        ).toBe("First");
      }
    );

    test(
      "dashboard card shows count and opens Notification Center",
      async ({ page }) => {
        await page.evaluate(() => {
          notificationService.create({
            title: "Dashboard update",
            message:
              "Open from dashboard."
          });

          renderPage("dashboard");
        });

        await expect(
          page.getByTestId(
            "dashboard-notifications-count"
          )
        ).toHaveText("1");

        await page
          .getByTestId(
            "dashboard-open-notifications"
          )
          .click();

        await expect(
          page.getByTestId(
            "notifications"
          )
        ).toBeVisible();

        const state =
          await page.evaluate(() => ({
            page: currentPage,
            context:
              currentPageContext
          }));

        expect(state).toEqual({
          page: "notifications",
          context: {
            filter: "all"
          }
        });
      }
    );

    test(
      "workbench notification queue opens Notification Center",
      async ({ page }) => {
        await page.evaluate(() => {
          notificationService.create({
            title: "Workbench update",
            message:
              "Open from workbench."
          });

          navigateTo(
            "assigner-workbench"
          );
        });

        await expect(
          page.getByTestId(
            "workbench-notifications-count"
          )
        ).toHaveText("1");

        await page
          .getByTestId(
            "workbench-open-notifications"
          )
          .click();

        await expect(
          page.getByTestId(
            "notifications"
          )
        ).toBeVisible();

        const state =
          await page.evaluate(() => ({
            page: currentPage,
            context:
              currentPageContext
          }));

        expect(state).toEqual({
          page: "notifications",
          context: {}
        });
      }
    );

    test(
      "dashboard count refreshes after notification is read",
      async ({ page }) => {
        const notificationId =
          await page.evaluate(() => {
            const result =
              notificationService.create({
                title: "Read update",
                message:
                  "Read this update."
              });

            renderPage("dashboard");

            return result.data.id;
          });

        await expect(
          page.getByTestId(
            "dashboard-notifications-count"
          )
        ).toHaveText("1");

        await page.evaluate(id => {
          notificationService.markAsRead(
            id
          );

          renderPage("dashboard");
        }, notificationId);

        await expect(
          page.getByTestId(
            "dashboard-notifications-count"
          )
        ).toHaveText("0");
      }
    );
  }
);
