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
              message: "First update.",
              createdAt:
                "2026-07-17T12:00:00.000Z"
            });

            notificationService.create({
              title: "Second",
              message: "Second update.",
              createdAt:
                "2026-07-17T12:00:00.000Z"
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
      "administrator dashboard omits the crew notification bell",
      async ({ page }) => {
        await page.evaluate(() => {
          notificationService.create({
            title: "Dashboard update",
            message:
              "Open from dashboard."
          });

          renderPage("dashboard");
        });

        await expect(page.getByTestId("dashboard-notification-bell")).toHaveCount(0);
        await expect(page.getByTestId("nav-notifications")).toBeHidden();
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
      "notification summary refreshes after notification is read",
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

        expect(await page.evaluate(() => dashboardService.getNotificationsSummary().unreadCount)).toBe(1);

        await page.evaluate(id => {
          notificationService.markAsRead(
            id
          );

          renderPage("dashboard");
        }, notificationId);

        expect(await page.evaluate(() => dashboardService.getNotificationsSummary().unreadCount)).toBe(0);
      }
    );
  }
);
