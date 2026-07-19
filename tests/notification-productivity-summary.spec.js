import {
  expect,
  test
} from "@playwright/test";

test.describe(
  "Notification Productivity Summaries",
  () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/");

      await page.evaluate(() => {
        notificationService.clearAll();
        authService.loginAsAdmin();

        const account =
          loginService
            .getCurrentAccount();

        if (account) {
          account.communicationPreferences = {
            ...account
              .communicationPreferences,
            claims: false
          };
        }

        notificationService.create({
          type: "assignment-created",
          title: "Older Assignment",
          message: "Assignment update.",
          createdAt:
            "2026-07-01T12:00:00.000Z"
        });

        notificationService.create({
          type: "review-submitted",
          title: "Newest Review",
          message: "Review update.",
          createdAt:
            "2026-07-10T12:00:00.000Z"
        });
      });
    });

    test(
      "dashboard summary exposes categories and counts",
      async ({ page }) => {
        const summary =
          await page.evaluate(() =>
            dashboardService
              .getNotificationsSummary()
          );

        expect(summary.unreadCount)
          .toBe(2);

        expect(summary.unreadByCategory)
          .toEqual({
            assignments: 1,
            reviews: 1
          });

        expect(
          summary.visibleNotificationCount
        ).toBe(2);

        expect(
          summary.newestNotification.title
        ).toBe("Newest Review");

        expect(
          summary.oldestUnread.title
        ).toBe("Older Assignment");
      }
    );

    test(
      "dashboard bell exposes the unread total",
      async ({ page }) => {
        await page.evaluate(() => {
          navigateTo("dashboard");
        });

        await expect(
          page.getByTestId(
            "dashboard-notification-count"
          )
        ).toHaveText("2");

        await page
          .getByTestId(
            "dashboard-notification-bell"
          )
          .click();

        const state =
          await page.evaluate(() => ({
            page: currentPage,
            filter:
              uiStateService
                .getNotificationFilter()
          }));

        expect(state).toEqual({
          page: "notifications",
          filter: "all"
        });
      }
    );

    test(
      "workbench presents notifications as a direct clickable list",
      async ({ page }) => {
        await page.evaluate(() => {
          navigateTo(
            "assigner-workbench"
          );
        });

        await expect(page.getByTestId("workbench-notification-item")).toHaveCount(2);
        await expect(page.getByTestId("workbench-newest-notification")).toHaveCount(0);
        await expect(page.getByTestId("workbench-unread-by-category")).toHaveCount(0);
      }
    );

    test(
      "reporting includes notification productivity totals",
      async ({ page }) => {
        const report =
          await page.evaluate(() =>
            reportingService
              .getCommunicationPreferencesReport()
          );

        expect(report.unreadByCategory)
          .toEqual({
            assignments: 1,
            reviews: 1
          });

        expect(
          report.visibleNotificationCount
        ).toBe(2);

        expect(
          report.mutedCategoryCount
        ).toBeGreaterThanOrEqual(0);
      }
    );
  }
);
