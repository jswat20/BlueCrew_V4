import {
  expect,
  test
} from "@playwright/test";

test.describe(
  "Operations Center queues",
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
      "exposes all queue definitions",
      async ({ page }) => {
        const queues =
          await page.evaluate(() =>
            dashboardService
              .getOperationsCenter()
              .queues
              .map(queue => queue.id)
          );

        expect(queues).toEqual([
          "all",
          "assignments",
          "claims",
          "reviews",
          "accounts",
          "conflicts"
        ]);
      }
    );

    test(
      "defaults to All Work",
      async ({ page }) => {
        await expect(
          page.getByTestId(
            "operations-queue-all"
          )
        ).toHaveAttribute(
          "aria-pressed",
          "true"
        );

        await expect(
          page.getByTestId(
            "operations-active-queue-label"
          )
        ).toHaveText("All Work");
      }
    );

    test(
      "selects Claims",
      async ({ page }) => {
        await page
          .getByTestId(
            "operations-queue-claims"
          )
          .click();

        await expect(
          page.getByTestId(
            "operations-queue-claims"
          )
        ).toHaveAttribute(
          "aria-pressed",
          "true"
        );

        await expect(
          page.getByTestId(
            "operations-queue-all"
          )
        ).toHaveAttribute(
          "aria-pressed",
          "false"
        );

        await expect(
          page.getByTestId(
            "operations-active-queue-label"
          )
        ).toHaveText("Claims");
      }
    );

    test(
      "selects Reviews",
      async ({ page }) => {
        await page
          .getByTestId(
            "operations-queue-reviews"
          )
          .click();

        await expect(
          page.getByTestId(
            "operations-queue-reviews"
          )
        ).toHaveAttribute(
          "aria-pressed",
          "true"
        );

        await expect(
          page.getByTestId(
            "operations-active-queue-label"
          )
        ).toHaveText("Reviews");
      }
    );

    test(
      "filters claim work in the service",
      async ({ page }) => {
        const keys =
          await page.evaluate(() =>
            dashboardService
              .getOperationsCenter(
                "claims"
              )
              .activeTasks
              .map(task => task.key)
          );

        expect(
          keys.every(
            key =>
              key === "pendingClaims"
          )
        ).toBe(true);
      }
    );

    test(
      "filters review work in the service",
      async ({ page }) => {
        const keys =
          await page.evaluate(() =>
            dashboardService
              .getOperationsCenter(
                "reviews"
              )
              .activeTasks
              .map(task => task.key)
          );

        expect(
          keys.every(
            key =>
              [
                "awaitingReview",
                "returnedReviews"
              ].includes(key)
          )
        ).toBe(true);
      }
    );

    test(
      "filters assignment work in the service",
      async ({ page }) => {
        const keys =
          await page.evaluate(() =>
            dashboardService
              .getOperationsCenter(
                "assignments"
              )
              .activeTasks
              .map(task => task.key)
          );

        expect(
          keys.every(
            key =>
              [
                "todaysPriorities",
                "needsAssignment"
              ].includes(key)
          )
        ).toBe(true);
      }
    );

    test(
      "falls back to All Work",
      async ({ page }) => {
        const queue =
          await page.evaluate(() =>
            dashboardService
              .getOperationsCenter(
                "invalid"
              )
              .activeQueue
          );

        expect(queue).toBe("all");
      }
    );
  }
);
