import {
  expect,
  test
} from "@playwright/test";

test.describe(
  "Notification Productivity Service",
  () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/");

      await page.evaluate(() => {
        notificationService.clearAll();
        authService.loginAsAdmin();
      });
    });

    test(
      "filters by status and category",
      async ({ page }) => {
        const result =
          await page.evaluate(() => {
            notificationService.create({
              type: "assignment-created",
              title: "New Assignment",
              message: "Assigned game."
            });

            const claim =
              notificationService.create({
                type: "claim-approved",
                title: "Claim Approved",
                message: "Claim updated."
              }).data;

            notificationService
              .markAsRead(claim.id);

            return notificationService
              .getNotifications({
                status: "unread",
                category: "assignments"
              });
          });

        expect(result).toHaveLength(1);
        expect(result[0].title)
          .toBe("New Assignment");
      }
    );

    test(
      "searches title message actor and game text",
      async ({ page }) => {
        const result =
          await page.evaluate(() => {
            notificationService.create({
              type: "review-submitted",
              title: "Review Ready",
              message:
                "Tigers @ Bears is ready.",
              actorName: "Alex Smith"
            });

            notificationService.create({
              type: "availability-saved",
              title:
                "Availability Updated",
              message:
                "Weekend availability changed."
            });

            return notificationService
              .getNotifications({
                search: "tigers"
              });
          });

        expect(result).toHaveLength(1);
        expect(result[0].title)
          .toBe("Review Ready");
      }
    );

    test(
      "sorts newest and oldest",
      async ({ page }) => {
        const result =
          await page.evaluate(() => {
            notificationService.create({
              title: "Older",
              message: "Older message.",
              createdAt:
                "2026-07-01T12:00:00.000Z"
            });

            notificationService.create({
              title: "Newer",
              message: "Newer message.",
              createdAt:
                "2026-07-10T12:00:00.000Z"
            });

            return {
              newest:
                notificationService
                  .getNotifications({
                    sort: "newest"
                  }),
              oldest:
                notificationService
                  .getNotifications({
                    sort: "oldest"
                  })
            };
          });

        expect(result.newest[0].title)
          .toBe("Newer");

        expect(result.oldest[0].title)
          .toBe("Older");
      }
    );

    test(
      "marks selected notifications read",
      async ({ page }) => {
        const result =
          await page.evaluate(() => {
            const first =
              notificationService.create({
                title: "First",
                message: "First message."
              }).data;

            notificationService.create({
              title: "Second",
              message: "Second message."
            });

            const command =
              notificationService
                .markAsReadBulk([
                  first.id
                ]);

            return {
              command,
              unread:
                notificationService
                  .getUnread()
            };
          });

        expect(
          result.command.data.updatedCount
        ).toBe(1);

        expect(result.unread)
          .toHaveLength(1);

        expect(result.unread[0].title)
          .toBe("Second");
      }
    );

    test(
      "deletes selected notifications",
      async ({ page }) => {
        const result =
          await page.evaluate(() => {
            const first =
              notificationService.create({
                title: "Delete",
                message: "Delete me."
              }).data;

            notificationService.create({
              title: "Keep",
              message: "Keep me."
            });

            const command =
              notificationService
                .deleteBulk([
                  first.id
                ]);

            return {
              command,
              remaining:
                notificationService
                  .getNotifications()
            };
          });

        expect(
          result.command.data.deletedCount
        ).toBe(1);

        expect(result.remaining)
          .toHaveLength(1);

        expect(result.remaining[0].title)
          .toBe("Keep");
      }
    );

    test(
      "summarizes unread categories and oldest unread",
      async ({ page }) => {
        const result =
          await page.evaluate(() => {
            notificationService.create({
              type: "assignment",
              title: "Assignment",
              message: "Assignment update.",
              createdAt:
                "2026-07-01T12:00:00.000Z"
            });

            notificationService.create({
              type: "claim-submitted",
              title: "Claim",
              message: "Claim update.",
              createdAt:
                "2026-07-05T12:00:00.000Z"
            });

            notificationService.create({
              type: "claim-approved",
              title: "Claim Approved",
              message: "Another claim.",
              createdAt:
                "2026-07-10T12:00:00.000Z"
            });

            return {
              categories:
                notificationService
                  .getUnreadByCategory(),
              oldest:
                notificationService
                  .getOldestUnread()
            };
          });

        expect(result.categories)
          .toEqual({
            assignments: 1,
            claims: 2
          });

        expect(result.oldest.title)
          .toBe("Assignment");
      }
    );
  }
);
