import {
  expect,
  test
} from "@playwright/test";

test.describe(
  "Operations Center telemetry rail",
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

          renderPage(
            "operations-center"
          );
        });
      }
    );

    test(
      "renders telemetry instrumentation",
      async ({ page }) => {
        await expect(
          page.getByTestId(
            "operations-status-rail"
          )
        ).toBeVisible();

        await expect(
          page.getByTestId(
            "operations-health-state"
          )
        ).toBeVisible();

        await expect(
          page.getByTestId(
            "operations-queue-health"
          )
        ).toBeVisible();

        await expect(
          page.getByTestId(
            "operations-progress"
          )
        ).toBeVisible();

        await expect(
          page.getByTestId(
            "operations-recent-activity"
          )
        ).toBeVisible();
      }
    );

    test(
      "renders five queue health signals",
      async ({ page }) => {
        await expect(
          page.getByTestId(
            "operations-queue-health-item"
          )
        ).toHaveCount(5);
      }
    );

    test(
      "does not repeat queue counts",
      async ({ page }) => {
        const health =
          page.getByTestId(
            "operations-queue-health"
          );

        await expect(
          health
        ).not.toContainText(
          "outstanding"
        );

        await expect(
          health
        ).toContainText(
          /Clear|Active|Action/
        );
      }
    );

    test(
      "preserves progress hooks",
      async ({ page }) => {
        await expect(
          page.getByTestId(
            "operations-progress-percent"
          )
        ).toBeVisible();

        await expect(
          page.getByTestId(
            "operations-progress-summary"
          )
        ).toBeVisible();

        await expect(
          page.getByTestId(
            "operations-progress-bar"
          )
        ).toBeVisible();
      }
    );

    test(
      "renders feed or feed empty state",
      async ({ page }) => {
        const feedItems =
          page.getByTestId(
            "operations-activity-item"
          );

        if (
          await feedItems.count()
        ) {
          await expect(
            page.getByTestId(
              "operations-activity-list"
            )
          ).toBeVisible();
        } else {
          await expect(
            page.getByTestId(
              "operations-recent-activity-empty"
            )
          ).toBeVisible();
        }
      }
    );
  }
);
