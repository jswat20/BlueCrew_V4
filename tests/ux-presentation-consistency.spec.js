import {
  expect,
  test
} from "@playwright/test";

test.describe(
  "Shared UX Presentation",
  () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/");
    });

    test(
      "shared helpers render escaped presentation markup",
      async ({ page }) => {
        const result =
          await page.evaluate(() => ({
            header:
              renderPageHeader({
                title: "<Notifications>",
                subtitle:
                  "Operational updates",
                badge: "2 unread"
              }),
            card:
              renderCardHeader({
                title: "Staffing",
                badge: 3
              }),
            empty:
              renderEmptyState({
                title: "Nothing here",
                message:
                  "<No matching items>"
              }),
            status:
              renderStatusBadge({
                label: "Approved",
                status: "approved"
              })
          }));

        expect(result.header)
          .toContain(
            "&lt;Notifications&gt;"
          );

        expect(result.card)
          .toContain(
            "presentation-card-header"
          );

        expect(result.empty)
          .toContain(
            "&lt;No matching items&gt;"
          );

        expect(result.status)
          .toContain(
            "status-badge-approved"
          );
      }
    );

    test(
      "notification center uses shared page and empty presentation",
      async ({ page }) => {
        await page.evaluate(() => {
          notificationService.clearAll();
          navigateTo("notifications");
        });

        await expect(
          page.locator(
            ".presentation-page-header"
          )
        ).toHaveCount(1);

        await expect(
          page.getByTestId(
            "notifications-empty"
          )
        ).toHaveClass(
          /presentation-empty-state/
        );
      }
    );

    test(
      "workbench notification card uses shared card header",
      async ({ page }) => {
        await page.evaluate(() => {
          notificationService.clearAll();

          notificationService.create({
            type: "assignment",
            title: "Assignment",
            message:
              "Assignment update."
          });

          navigateTo(
            "assigner-workbench"
          );
        });

        await expect(
          page
            .getByTestId(
              "workbench-notifications"
            )
            .locator(
              ".presentation-card-header"
            )
        ).toHaveCount(1);
      }
    );

    test(
      "season dashboard metric cards use shared headers",
      async ({ page }) => {
        await page.evaluate(() => {
          navigateTo(
            "season-dashboard"
          );
        });

        await expect(
          page
            .getByTestId(
              "season-dashboard-operations"
            )
            .locator(
              ".presentation-card-header"
            )
        ).toHaveCount(1);

        await expect(
          page
            .getByTestId(
              "season-dashboard-staffing"
            )
            .locator(
              ".presentation-card-header"
            )
        ).toHaveCount(1);
      }
    );
  }
);
