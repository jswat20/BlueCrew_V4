import {
  expect,
  test
} from "@playwright/test";

test.describe(
  "Operations Center work deck",
  () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/");

      await page.evaluate(() => {
        authService.loginAsAdmin();
        document.body.dataset.role =
          "admin";

        renderPage("operations-center");
      });
    });

    test(
      "service exposes flattened work items",
      async ({ page }) => {
        const result =
          await page.evaluate(() => {
            const operations =
              dashboardService
                .getOperationsCenter();

            return {
              actual:
                operations
                  .activeWorkItems
                  .length,

              expected:
                operations
                  .activeTasks
                  .reduce(
                    (
                      total,
                      task
                    ) =>
                      total +
                      task.items.length,
                    0
                  )
            };
          });

        expect(result.actual)
          .toBe(result.expected);
      }
    );

    test(
      "renders a unified work queue",
      async ({ page }) => {
        await expect(
          page.getByTestId(
            "operations-work-queue"
          )
        ).toBeVisible();

        await expect(
          page.getByTestId(
            "operations-work-queue-title"
          )
        ).toHaveText("All Work");
      }
    );

    test(
      "changes work queue with channel",
      async ({ page }) => {
        await page
          .getByTestId(
            "operations-queue-reviews"
          )
          .click();

        await expect(
          page.getByTestId(
            "operations-work-queue-title"
          )
        ).toHaveText("Reviews");

        await expect(
          page.getByTestId(
            "operations-work-queue"
          )
        ).toHaveAttribute(
          "data-active-queue",
          "reviews"
        );
      }
    );

    test(
      "rendered item count matches service",
      async ({ page }) => {
        const expected =
          await page.evaluate(() =>
            dashboardService
              .getOperationsCenter()
              .activeWorkItems
              .length
          );

        await expect(
          page.getByTestId(
            "operations-work-item"
          )
        ).toHaveCount(expected);

        await expect(
          page.getByTestId(
            "operations-work-queue-count"
          )
        ).toHaveText(
          String(expected)
        );
      }
    );

    test(
      "first item is the priority action",
      async ({ page }) => {
        const rows =
          page.getByTestId(
            "operations-work-item"
          );

        if (await rows.count() === 0) {
          await expect(
            page.getByTestId(
              "operations-work-queue-empty"
            )
          ).toBeVisible();

          return;
        }

        await expect(
          rows.first()
        ).toHaveAttribute(
          "data-priority",
          "true"
        );

        await expect(
          page.getByTestId(
            "operations-current-task-action"
          )
        ).toBeVisible();
      }
    );
  }
);
