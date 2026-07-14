import {
  expect,
  test
} from "@playwright/test";

test.describe(
  "Availability Notifications",
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

          if (window.BlueCrew?.test) {
            window.BlueCrew.test
              .currentRole =
              "admin";
          }
        });
      }
    );

    test(
      "material availability change creates one admin notification",
      async ({ page }) => {
        const result =
          await page.evaluate(async () => {
            const member =
              crewService.getAll()[0];

            availabilityService
              .clearAvailability(
                member.id,
                "2099-11-01"
              );

            availabilityPageState
              .selectedCrewId =
              String(member.id);

            availabilityPageState
              .selectedDate =
              "2099-11-01";

            availabilityPageState
              .selectedStatus =
              "unavailable";

            renderPage("availability");

            await handleSaveAvailability();

            return {
              crewId: member.id,
              notifications:
                notificationService
                  .getNotifications()
            };
          });

        expect(result.notifications)
          .toHaveLength(1);

        expect(
          result.notifications[0]
        ).toEqual(
          expect.objectContaining({
            type:
              "availability-saved",
            title:
              "Availability Updated",
            relatedId:
              String(result.crewId),
            audience: "admin",
            destination: {
              page: "availability",
              context: {
                crewId:
                  String(result.crewId),
                date: "2099-11-01"
              }
            }
          })
        );
      }
    );

    test(
      "saving the same status again creates no duplicate",
      async ({ page }) => {
        const count =
          await page.evaluate(async () => {
            const member =
              crewService.getAll()[0];

            availabilityService
              .setAvailability({
                crewId: member.id,
                date: "2099-11-02",
                status: "maybe"
              });

            notificationService
              .clearAll();

            availabilityPageState
              .selectedCrewId =
              String(member.id);

            availabilityPageState
              .selectedDate =
              "2099-11-02";

            availabilityPageState
              .selectedStatus =
              "maybe";

            renderPage("availability");

            await handleSaveAvailability();

            return notificationService
              .getNotifications()
              .length;
          });

        expect(count).toBe(0);
      }
    );

    test(
      "notification opens availability with exact context",
      async ({ page }) => {
        const notificationId =
          await page.evaluate(() => {
            const member =
              crewService.getAll()[0];

            const result =
              notificationService.create({
                type:
                  "availability-saved",
                title:
                  "Availability Updated",
                message:
                  "Availability was updated.",
                relatedId:
                  String(member.id),
                audience: "admin",
                destination: {
                  page: "availability",
                  context: {
                    crewId:
                      String(member.id),
                    date:
                      "2099-11-03"
                  }
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
            `[data-notification-id="${notificationId}"]`
          )
          .click();

        const state =
          await page.evaluate(() => ({
            page: currentPage,
            context:
              currentPageContext
          }));

        expect(state).toEqual({
          page: "availability",
          context: expect.objectContaining({
            date: "2099-11-03"
          })
        });
      }
    );
  }
);
