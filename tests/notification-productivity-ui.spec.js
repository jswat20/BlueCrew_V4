import {
  expect,
  test
} from "@playwright/test";

test.describe(
  "Notification Productivity UI",
  () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/");

      await page.evaluate(() => {
        notificationService.clearAll();
        authService.loginAsAdmin();

        uiStateService.clearSelections();

        notificationService.create({
          type: "assignment-created",
          title: "Older Assignment",
          message:
            "Tigers @ Bears assignment.",
          createdAt:
            "2026-07-01T12:00:00.000Z"
        });

        notificationService.create({
          type: "claim-submitted",
          title: "Newest Claim",
          message:
            "Lions @ Hawks claim.",
          createdAt:
            "2026-07-10T12:00:00.000Z"
        });

        notificationService.create({
          type: "review-submitted",
          title: "Review Ready",
          message:
            "Wolves @ Eagles review.",
          createdAt:
            "2026-07-05T12:00:00.000Z"
        });

        renderPage("notifications");
      });
    });

    test(
      "filters notifications by category",
      async ({ page }) => {
        await page
          .getByTestId(
            "notification-filter-claims"
          )
          .click();

        await expect(
          page.getByTestId(
            "notification-card"
          )
        ).toHaveCount(1);

        await expect(
          page.getByText("Newest Claim")
        ).toBeVisible();
      }
    );

    test(
      "searches visible notifications",
      async ({ page }) => {
        await page
          .getByTestId(
            "notification-search"
          )
          .fill("wolves");

        await expect(
          page.getByTestId(
            "notification-card"
          )
        ).toHaveCount(1);

        await expect(
          page.getByText("Review Ready")
        ).toBeVisible();
      }
    );

    test(
      "sorts notifications oldest first",
      async ({ page }) => {
        await page
          .getByTestId(
            "notification-sort"
          )
          .selectOption("oldest");

        await expect(
          page
            .getByTestId(
              "notification-card"
            )
            .first()
        ).toContainText(
          "Older Assignment"
        );
      }
    );

    test(
      "selects and clears visible notifications",
      async ({ page }) => {
        await page
          .getByTestId(
            "notification-filter-claims"
          )
          .click();

        await page
          .getByTestId(
            "notifications-select-visible"
          )
          .click();

        await expect(
          page.getByTestId(
            "notification-selection-count"
          )
        ).toContainText("1");

        await page
          .getByTestId(
            "notifications-clear-selection"
          )
          .click();

        await expect(
          page.getByTestId(
            "notification-selection-count"
          )
        ).toContainText("0");
      }
    );

    test(
      "marks selected notifications read",
      async ({ page }) => {
        await page
          .getByTestId(
            "notification-filter-claims"
          )
          .click();

        await page
          .getByTestId(
            "notifications-select-visible"
          )
          .click();

        await page
          .getByTestId(
            "notifications-mark-selected-read"
          )
          .click();

        const result =
          await page.evaluate(() =>
            notificationService
              .getNotifications({
                category: "claims"
              })[0]
          );

        expect(result.read).toBe(true);
      }
    );

    test(
      "deletes selected notifications",
      async ({ page }) => {
        await page
          .getByTestId(
            "notification-filter-reviews"
          )
          .click();

        await page
          .getByTestId(
            "notifications-select-visible"
          )
          .click();

        await page
          .getByTestId(
            "notifications-delete-selected"
          )
          .click();

        const reviews =
          await page.evaluate(() =>
            notificationService
              .getNotifications({
                category: "reviews"
              })
          );

        expect(reviews).toHaveLength(0);
      }
    );

    test(
      "shows filtered empty messaging",
      async ({ page }) => {
        await page
          .getByTestId(
            "notification-filter-accounts"
          )
          .click();

        await expect(
          page.getByTestId(
            "notifications-filtered-empty"
          )
        ).toBeVisible();
      }
    );
  }
);
