import {
  expect,
  test
} from "@playwright/test";

test.describe(
  "Account Notifications",
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
        });
      }
    );

    test(
      "approval creates one targeted notification",
      async ({ page }) => {
        const result =
          await page.evaluate(() => {
            const created =
              accountService
                .createAccount({
                  firstName:
                    "Approval",
                  lastName:
                    "Notification",
                  email:
                    `account-approval-${Date.now()}@test.com`,
                  role: "umpire"
                });

            const command =
              accountService
                .approveAccount(
                  created.data.id
                );

            return {
              accountId:
                created.data.id,
              command,
              notifications:
                notificationService
                  .getAll()
            };
          });

        expect(result.command.success)
          .toBe(true);

        expect(result.notifications)
          .toHaveLength(1);

        expect(
          result.notifications[0]
        ).toEqual(
          expect.objectContaining({
            type:
              "account-approved",
            audience: "umpire",
            recipientAccountId:
              result.accountId,
            relatedId:
              result.accountId,
            title:
              "Account Approved",
            destination: {
              page: "profile",
              context: {}
            }
          })
        );
      }
    );

    test(
      "rejection creates one targeted notification",
      async ({ page }) => {
        const result =
          await page.evaluate(() => {
            const created =
              accountService
                .createAccount({
                  firstName:
                    "Rejection",
                  lastName:
                    "Notification",
                  email:
                    `account-rejection-${Date.now()}@test.com`,
                  role: "umpire"
                });

            const command =
              accountService
                .rejectAccount(
                  created.data.id
                );

            return {
              accountId:
                created.data.id,
              command,
              notifications:
                notificationService
                  .getAll()
            };
          });

        expect(result.command.success)
          .toBe(true);

        expect(result.notifications)
          .toHaveLength(1);

        expect(
          result.notifications[0]
        ).toEqual(
          expect.objectContaining({
            type:
              "account-rejected",
            audience: "umpire",
            recipientAccountId:
              result.accountId,
            relatedId:
              result.accountId,
            title:
              "Account Rejected"
          })
        );
      }
    );

    test(
      "targeted notification is visible only to its account",
      async ({ page }) => {
        const result =
          await page.evaluate(() => {
            const target =
              accountService
                .createAccount({
                  firstName: "Target",
                  lastName: "Account",
                  email:
                    `target-${Date.now()}@test.com`
                }).data;

            const other =
              accountService
                .createAccount({
                  firstName: "Other",
                  lastName: "Account",
                  email:
                    `other-${Date.now()}@test.com`
                }).data;

            accountService
              .approveAccount(target.id);

            loginService.login(
              other.email
            );

            authService.loginAsUmpire();

            const otherCount =
              notificationService
                .getUnreadCount();

            loginService.login(
              target.email
            );

            authService.loginAsUmpire();

            const targetCount =
              notificationService
                .getUnreadCount();

            return {
              otherCount,
              targetCount
            };
          });

        expect(result.otherCount)
          .toBe(0);

        expect(result.targetCount)
          .toBe(1);
      }
    );

    test(
      "account notification opens profile",
      async ({ page }) => {
        const id =
          await page.evaluate(() => {
            const result =
              notificationService.create({
                type:
                  "account-approved",
                title:
                  "Account Approved",
                message:
                  "Approved.",
                audience: "admin",
                destination: {
                  page: "profile",
                  context: {}
                }
              });

            renderPage(
              "notifications"
            );

            return result.data.id;
          });

        await page
          .locator(
            `[data-testid="notification-action"]` +
            `[data-notification-id="${id}"]`
          )
          .click();

        const state =
          await page.evaluate(() => ({
            page: currentPage
          }));

        expect(state.page)
          .toBe("profile");
      }
    );
  }
);
