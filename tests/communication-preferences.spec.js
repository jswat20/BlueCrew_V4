import {
  expect,
  test
} from "@playwright/test";

test.describe(
  "Communication Preferences",
  () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/");

      await page.evaluate(() => {
        authService.loginAsAdmin();
        loginService.logout();
        notificationService.clearAll();

        const email =
          `communication-${Date.now()}-${Math.random()}@test.com`;

        const created =
          accountService.createAccount({
            firstName: "Communication",
            lastName: "Tester",
            email,
            role: "admin"
          });

        if (!created.success) {
          throw new Error(created.message);
        }

        const approved =
          accountService.approveAccount(
            created.data.id
          );

        if (!approved.success) {
          throw new Error(approved.message);
        }

        const login =
          loginService.login(email);

        if (!login.success) {
          throw new Error(login.message);
        }

        notificationService.clearAll();
      });
    });

    test(
      "accounts expose normalized communication defaults",
      async ({ page }) => {
        const preferences =
          await page.evaluate(() =>
            loginService
              .getCurrentAccount()
              .communicationPreferences
          );

        expect(preferences).toEqual({
          assignments: true,
          claims: true,
          reviews: true,
          availability: true,
          accounts: true,
          activityDigest: true,
          soundEnabled: true,
          desktopNotifications: false
        });
      }
    );

    test(
      "profile updates persist communication preferences",
      async ({ page }) => {
        const result =
          await page.evaluate(() => {
            const account =
              loginService.getCurrentAccount();

            const profile =
              accountService.getProfile(
                account.id
              );

            const saved =
              accountService.updateProfile(
                account.id,
                {
                  ...profile,
                  communicationPreferences: {
                    ...account
                      .communicationPreferences,
                    assignments: false,
                    reviews: false,
                    soundEnabled: false
                  }
                }
              );

            return {
              success: saved.success,
              preferences:
                accountService.getById(
                  account.id
                )
                  .communicationPreferences
            };
          });

        expect(result.success).toBe(true);

        expect(result.preferences).toEqual(
          expect.objectContaining({
            assignments: false,
            reviews: false,
            soundEnabled: false,
            claims: true,
            availability: true
          })
        );
      }
    );

    test(
      "muted notifications are not persisted or counted",
      async ({ page }) => {
        const result =
          await page.evaluate(() => {
            const account =
              loginService.getCurrentAccount();

            const profile =
              accountService.getProfile(
                account.id
              );

            accountService.updateProfile(
              account.id,
              {
                ...profile,
                communicationPreferences: {
                  ...account
                    .communicationPreferences,
                  assignments: false
                }
              }
            );

            const creation =
              notificationService.create({
                type: "assignment-created",
                audience: "admin",
                title: "Assignment Created",
                message:
                  "This notification is muted."
              });

            return {
              creation,
              notifications:
                notificationService
                  .getNotifications(),
              unreadCount:
                notificationService
                  .getUnreadCount(),
              dashboard:
                dashboardService
                  .getNotificationsSummary()
            };
          });

        expect(
          result.creation.suppressed
        ).toBe(true);

        expect(result.notifications)
          .toHaveLength(0);

        expect(result.unreadCount).toBe(0);
        expect(result.dashboard.unreadCount)
          .toBe(0);
        expect(result.dashboard.hasUnread)
          .toBe(false);
      }
    );

    test(
      "enabled notification categories still persist",
      async ({ page }) => {
        const result =
          await page.evaluate(() => {
            const creation =
              notificationService.create({
                type: "claim-submitted",
                audience: "admin",
                title: "Claim Submitted",
                message:
                  "A claim requires review."
              });

            return {
              creation,
              unreadCount:
                notificationService
                  .getUnreadCount()
            };
          });

        expect(
          result.creation.suppressed
        ).not.toBe(true);

        expect(result.unreadCount).toBe(1);
      }
    );

    test(
      "returned reviews remain compatible when reviews are muted",
      async ({ page }) => {
        const result =
          await page.evaluate(() => {
            const account =
              loginService.getCurrentAccount();

            const profile =
              accountService.getProfile(
                account.id
              );

            accountService.updateProfile(
              account.id,
              {
                ...profile,
                communicationPreferences: {
                  ...account
                    .communicationPreferences,
                  reviews: false
                }
              }
            );

            const creation =
              notificationService.create({
                type: "returned-review",
                audience: "admin",
                title: "Review Returned",
                message:
                  "Changes are required."
              });

            return {
              creation,
              unreadCount:
                notificationService
                  .getUnreadCount()
            };
          });

        expect(
          result.creation.suppressed
        ).not.toBe(true);

        expect(result.unreadCount).toBe(1);
      }
    );
  }
);
