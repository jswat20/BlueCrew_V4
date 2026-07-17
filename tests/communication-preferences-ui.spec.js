import {
  expect,
  test
} from "@playwright/test";

test.describe(
  "Communication Preferences UI",
  () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/");

      await page.evaluate(() => {
        authService.loginAsAdmin();
        loginService.logout();
        notificationService.clearAll();

        const email =
          `communication-ui-${Date.now()}-${Math.random()}@test.com`;

        const created =
          accountService.createAccount({
            firstName: "Communication",
            lastName: "UI",
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
      "profile toggles save automatically",
      async ({ page }) => {
        await page.evaluate(() =>
          navigateTo("profile", {
            section: "communication"
          })
        );

        const toggle =
          page.getByTestId(
            "communication-assignments"
          );

        await expect(toggle).toBeChecked();

        await toggle.uncheck();

        await expect(
          page.getByTestId(
            "profile-success"
          )
        ).toHaveText(
          "Communication preference saved."
        );

        await expect(
          page.getByTestId(
            "communication-assignments"
          )
        ).not.toBeChecked();

        expect(
          await page.evaluate(() =>
            loginService
              .getCurrentAccount()
              .communicationPreferences
              .assignments
          )
        ).toBe(false);
      }
    );

    test(
      "profile navigation opens communication preferences",
      async ({ page }) => {
        await page.evaluate(() =>
          navigateTo("dashboard")
        );

        await page
          .getByTestId(
            "nav-profile"
          )
          .click();

        await expect(
          page.getByTestId(
            "profile-communication"
          )
        ).toBeVisible();

        expect(
          await page.evaluate(() =>
            window.BlueCrew.test.currentPage
          )
        ).toBe("profile");
      }
    );

    test(
      "workbench displays muted categories",
      async ({ page }) => {
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
                ...profile
                  .communicationPreferences,
                assignments: false,
                reviews: false
              }
            }
          );

          navigateTo(
            "assigner-workbench"
          );
        });

        await expect(
          page.getByTestId(
            "workbench-muted-assignments"
          )
        ).toHaveText(
          "Assignments muted"
        );

        await expect(
          page.getByTestId(
            "workbench-muted-reviews"
          )
        ).toHaveText(
          "Reviews muted"
        );
      }
    );

    test(
      "reporting summarizes notification preferences",
      async ({ page }) => {
        const report =
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
                  ...profile
                    .communicationPreferences,
                  assignments: false,
                  claims: false
                }
              }
            );

            return reportingService
              .getCommunicationPreferencesReport();
          });

        expect(report).toEqual(
          expect.objectContaining({
            notificationsEnabled: 4,
            notificationsDisabled: 2,
            enabledCount: 4,
            disabledCount: 2
          })
        );

        expect(
          report.mutedCategoryCount
        ).toBe(2);

        expect(
          report.visibleNotificationCount
        ).toBe(0);
      }
    );
  }
);
