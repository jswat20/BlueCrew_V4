import {
  expect,
  test
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

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
      "shared button and error helpers expose the canonical contract",
      async ({ page }) => {
        const result = await page.evaluate(() => ({
          destructive: getPresentationButtonClass({
            variant: "destructive",
            compact: true,
            className: "legacy-action"
          }),
          fallback: getPresentationButtonClass({
            variant: "unknown"
          }),
          error: renderErrorState({
            title: "Import failed",
            message: "<Invalid row>",
            testId: "import-error"
          })
        }));

        expect(result.destructive).toBe(
          "button button-danger button-compact legacy-action"
        );
        expect(result.fallback).toBe(
          "button button-secondary"
        );
        expect(result.error).toContain('role="alert"');
        expect(result.error).toContain("&lt;Invalid row&gt;");
      }
    );

    test(
      "migrated schedule controls honor the final cascade boundary",
      async ({ page }) => {
        await page.evaluate(() => {
          navigateTo("schedule");
        });

        const primary = page.getByTestId("add-game");
        const secondary = page.getByTestId("previous-date");

        await expect(primary).toHaveCSS(
          "background-color",
          "rgb(21, 94, 239)"
        );
        await expect(primary).toHaveCSS(
          "color",
          "rgb(255, 255, 255)"
        );
        await expect(secondary).toHaveCSS(
          "background-color",
          "rgb(255, 255, 255)"
        );
        await expect(secondary).toHaveCSS(
          "min-height",
          "44px"
        );
      }
    );

    test(
      "primary navigation has no automated WCAG A or AA violations",
      async ({ page }) => {
        const results = await new AxeBuilder({ page })
          .include('[data-testid="navigation"]')
          .withTags(["wcag2a", "wcag2aa"])
          .analyze();

        expect(results.violations).toEqual([]);
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
