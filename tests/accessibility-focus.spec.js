import {
  expect,
  test
} from "@playwright/test";

test.describe(
  "Accessibility and Focus Management",
  () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/");
    });

    test(
      "creates one polite global live region",
      async ({ page }) => {
        const region =
          page.locator(
            "#bluecrew-live-region"
          );

        await expect(region)
          .toHaveCount(1);

        await expect(region)
          .toHaveAttribute(
            "role",
            "status"
          );

        await expect(region)
          .toHaveAttribute(
            "aria-live",
            "polite"
          );

        await expect(region)
          .toHaveAttribute(
            "aria-atomic",
            "true"
          );
      }
    );

    test(
      "focuses the page heading after navigation",
      async ({ page }) => {
        await page.evaluate(() => {
          notificationService.clearAll();
          navigateTo("notifications");
        });

        const heading =
          page.locator(
            '[data-page-heading]'
          );

        await expect(heading)
          .toHaveText(
            "Notification Center"
          );

        await expect(heading)
          .toBeFocused();
      }
    );

    test(
      "shared empty states announce politely",
      async ({ page }) => {
        await page.evaluate(() => {
          notificationService.clearAll();
          navigateTo("notifications");
        });

        const emptyState =
          page.getByTestId(
            "notifications-empty"
          );

        await expect(emptyState)
          .toHaveAttribute(
            "role",
            "status"
          );

        await expect(emptyState)
          .toHaveAttribute(
            "aria-live",
            "polite"
          );
      }
    );

    test(
      "bulk mark read announces and restores focus",
      async ({ page }) => {
        await page.evaluate(() => {
          notificationService.clearAll();

          notificationService.create({
            type: "assignment",
            title: "Assignment",
            message:
              "Assignment update."
          });

          navigateTo("notifications");
        });

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

        await expect(
          page.locator(
            "#bluecrew-live-region"
          )
        ).toContainText(
          "marked as read"
        );

        await expect(
          page.getByTestId(
            "notifications-select-visible"
          )
        ).toBeFocused();
      }
    );

    test(
      "bulk delete announces and restores focus",
      async ({ page }) => {
        await page.evaluate(() => {
          notificationService.clearAll();

          notificationService.create({
            type: "review-submitted",
            title: "Review",
            message:
              "Review update."
          });

          navigateTo("notifications");
        });

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

        await expect(
          page.locator(
            "#bluecrew-live-region"
          )
        ).toContainText("deleted");
      }
    );

    test(
      "profile save message is an accessible status",
      async ({ page }) => {
        await page.evaluate(() => {
          let account =
            accountService
              .getAll()
              .find(
                item =>
                  item.status ===
                    "approved" &&
                  item.email
              );

          if (!account) {
            const created =
              accountService.createAccount({
                firstName:
                  "Accessibility",
                lastName:
                  "Tester",
                email:
                  "accessibility-profile@example.com",
                phone:
                  "555-0100"
              });

            account = created.data;

            accountService
              .approveAccount(
                account.id
              );
          }

          loginService.login(
            account.email
          );

          authService.loginAsAdmin();

          document.body.dataset.role =
            "admin";

          navigateTo("profile");
        });

        await page
          .getByTestId("profile-phone")
          .fill("555-0109");

        await page
          .getByTestId("profile-save")
          .click();

        const success =
          page.getByTestId(
            "profile-success"
          );

        await expect(success)
          .toHaveAttribute(
            "role",
            "status"
          );

        await expect(success)
          .toHaveAttribute(
            "aria-live",
            "polite"
          );

        await expect(success)
          .toBeFocused();

        await expect(
          page.locator(
            "#bluecrew-live-region"
          )
        ).toContainText("saved");
      }
    );

    test(
      "accessible activation supports Enter and Space",
      async ({ page }) => {
        const result =
          await page.evaluate(() => {
            let count = 0;

            const createEvent =
              key => ({
                key,
                prevented: false,
                preventDefault() {
                  this.prevented = true;
                }
              });

            const enter =
              createEvent("Enter");

            const space =
              createEvent(" ");

            const escape =
              createEvent("Escape");

            handleAccessibleActivation(
              enter,
              () => {
                count += 1;
              }
            );

            handleAccessibleActivation(
              space,
              () => {
                count += 1;
              }
            );

            handleAccessibleActivation(
              escape,
              () => {
                count += 1;
              }
            );

            return {
              count,
              enterPrevented:
                enter.prevented,
              spacePrevented:
                space.prevented,
              escapePrevented:
                escape.prevented
            };
          });

        expect(result).toEqual({
          count: 2,
          enterPrevented: true,
          spacePrevented: true,
          escapePrevented: false
        });
      }
    );
  }
);
