import {
  expect,
  test
} from "@playwright/test";

test.describe(
  "Operations Center queue-aware telemetry",
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
      "defaults to overall telemetry",
      async ({ page }) => {
        await page.evaluate(() => {
          renderPage(
            "operations-center"
          );
        });

        await expect(
          page.getByTestId(
            "operations-telemetry-title"
          )
        ).toHaveText(
          "Operational State"
        );

        await expect(
          page.getByTestId(
            "operations-feed-title"
          )
        ).toHaveText(
          "Live Feed"
        );
      }
    );

    test(
      "shows assignment telemetry",
      async ({ page }) => {
        await page.evaluate(() => {
          renderPage(
            "operations-center",
            {
              operationsQueue:
                "assignments"
            }
          );
        });

        await expect(
          page.getByTestId(
            "operations-telemetry-title"
          )
        ).toHaveText(
          "Assignment Channel"
        );

        await expect(
          page.getByTestId(
            "operations-feed-title"
          )
        ).toHaveText(
          "Staffing Feed"
        );

        await expect(
          page.getByTestId(
            "operations-progress"
          )
        ).toHaveAttribute(
          "data-active-queue",
          "assignments"
        );
      }
    );

    test(
      "focuses the selected queue signal",
      async ({ page }) => {
        await page.evaluate(() => {
          renderPage(
            "operations-center",
            {
              operationsQueue:
                "reviews"
            }
          );
        });

        const reviews =
          page.getByTestId(
            "operations-queue-health-item"
          ).filter({
            hasText: "Reviews"
          });

        await expect(
          reviews
        ).toHaveAttribute(
          "data-focused",
          "true"
        );

        await expect(
          reviews
        ).toContainText(
          "Focused"
        );

        const assignments =
          page.getByTestId(
            "operations-queue-health-item"
          ).filter({
            hasText: "Assignments"
          });

        await expect(
          assignments
        ).toHaveAttribute(
          "data-focused",
          "false"
        );
      }
    );

    test(
      "shows conflict-specific telemetry",
      async ({ page }) => {
        await page.evaluate(() => {
          renderPage(
            "operations-center",
            {
              operationsQueue:
                "conflicts"
            }
          );
        });

        await expect(
          page.getByTestId(
            "operations-telemetry-title"
          )
        ).toHaveText(
          "Conflict Channel"
        );

        await expect(
          page.getByTestId(
            "operations-feed-title"
          )
        ).toHaveText(
          "Conflict Feed"
        );

        await expect(
          page.getByTestId(
            "operations-recent-activity"
          )
        ).toHaveAttribute(
          "data-active-queue",
          "conflicts"
        );
      }
    );

    test(
      "updates after selecting another queue",
      async ({ page }) => {
        await page.evaluate(() => {
          renderPage(
            "operations-center"
          );
        });

        await page
          .getByTestId(
            "operations-queue-claims"
          )
          .click();

        await expect(
          page.getByTestId(
            "operations-telemetry-title"
          )
        ).toHaveText(
          "Claims Channel"
        );

        await expect(
          page.getByTestId(
            "operations-feed-title"
          )
        ).toHaveText(
          "Claims Feed"
        );

        await expect(
          page.getByTestId(
            "operations-progress"
          )
        ).toHaveAttribute(
          "data-active-queue",
          "claims"
        );
      }
    );
  }
);
