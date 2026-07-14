import {
  test,
  expect
} from "./fixtures/app.fixture.js";

const {
  AvailabilityPage
} = require(
  "./pages/AvailabilityPage.js"
);

test.describe(
  "Availability UX",
  () => {
    test.beforeEach(async ({ app }) => {
      await app.page.evaluate(() => {
        crewService.getAll().forEach(
          member => {
            member.dateAvailability = {};
          }
        );

        if (
          typeof saveCrew === "function"
        ) {
          saveCrew();
        }

        notificationService.clearAll();

        authService.loginAsAdmin();
        document.body.dataset.role =
          "admin";
      });
    });

    test(
      "marks a weekend unavailable",
      async ({ app }) => {
        const page =
          new AvailabilityPage(app.page);

        await page.open();

        await page.dateInput.fill(
          "2099-08-05"
        );

        await app.page
          .getByTestId(
            "availability-weekend-unavailable"
          )
          .click();

        await page.expectEntry({
          date: "2099-08-08",
          status: "unavailable"
        });

        await page.expectEntry({
          date: "2099-08-09",
          status: "unavailable"
        });
      }
    );

    test(
      "marks the next seven days available",
      async ({ app }) => {
        const page =
          new AvailabilityPage(app.page);

        await page.open();

        await page.dateInput.fill(
          "2099-09-01"
        );

        await app.page
          .getByTestId(
            "availability-next-seven-available"
          )
          .click();

        await page.expectEntry({
          date: "2099-09-01",
          status: "available"
        });

        await page.expectEntry({
          date: "2099-09-07",
          status: "available"
        });
      }
    );

    test(
      "copies the previous week",
      async ({ app }) => {
        const page =
          new AvailabilityPage(app.page);

        await app.page.evaluate(() => {
          const member =
            crewService.getAll()[0];

          availabilityService
            .setAvailability({
              crewId: member.id,
              date: "2099-10-01",
              status: "unavailable"
            });

          availabilityService
            .setAvailability({
              crewId: member.id,
              date: "2099-10-02",
              status: "maybe"
            });
        });

        await page.open();

        await page.dateInput.fill(
          "2099-10-08"
        );

        await app.page
          .getByTestId(
            "availability-copy-previous-week"
          )
          .click();

        await page.expectEntry({
          date: "2099-10-08",
          status: "unavailable"
        });

        await page.expectEntry({
          date: "2099-10-09",
          status: "maybe"
        });
      }
    );

    test(
      "requires confirmation for an assigned date",
      async ({ app }) => {
        const page =
          new AvailabilityPage(app.page);

        const crewId =
          await app.page.evaluate(() => {
            const member =
              crewService.getAll()[0];

            gameService.getAll().push({
              id:
                "availability-conflict-game",
              date: "2099-11-10",
              time: "6:00 PM",
              status: "scheduled",
              crewId: member.id,
              assignments: []
            });

            return member.id;
          });

        await page.open();

        await page.save({
          crewId,
          date: "2099-11-10",
          status: "unavailable"
        });

        await expect(
          app.page.locator(
            ".modal-dialog"
          )
        ).toBeVisible();

        await app.page
          .locator("#modal-confirm")
          .click();

        await page.expectEntry({
          date: "2099-11-10",
          status: "unavailable"
        });
      }
    );

    test(
      "cancelling conflict leaves availability unchanged",
      async ({ app }) => {
        const page =
          new AvailabilityPage(app.page);

        const crewId =
          await app.page.evaluate(() => {
            const member =
              crewService.getAll()[0];

            gameService.getAll().push({
              id:
                "availability-cancel-conflict",
              date: "2099-12-10",
              time: "7:00 PM",
              status: "scheduled",
              crewId: member.id,
              assignments: []
            });

            return member.id;
          });

        await page.open();

        await page.save({
          crewId,
          date: "2099-12-10",
          status: "unavailable"
        });

        await app.page
          .locator("#modal-cancel")
          .click();

        await expect(
          page.entryForDate(
            "2099-12-10"
          )
        ).toHaveCount(0);
      }
    );

    test(
      "assigned availability entries are protected",
      async ({ app }) => {
        const page =
          new AvailabilityPage(app.page);

        await app.page.evaluate(() => {
          const member =
            crewService.getAll()[0];

          availabilityService
            .setAvailability({
              crewId: member.id,
              date: "2099-12-20",
              status: "available"
            });

          gameService.getAll().push({
            id:
              "availability-protected-game",
            date: "2099-12-20",
            time: "5:00 PM",
            status: "scheduled",
            crewId: member.id,
            assignments: []
          });
        });

        await page.open();

        const entry =
          page.entryForDate(
            "2099-12-20"
          );

        await expect(entry).toHaveAttribute(
          "data-assigned",
          "true"
        );

        await expect(
          entry.getByTestId(
            "availability-assigned-badge"
          )
        ).toBeVisible();

        await expect(
          entry.getByText(
            "Assignment protected"
          )
        ).toBeVisible();

        await expect(
          app.page.getByTestId(
            "availability-edit-2099-12-20"
          )
        ).toHaveCount(0);
      }
    );

    test(
      "creates availability notifications",
      async ({ app }) => {
        const page =
          new AvailabilityPage(app.page);

        await page.open();

        await page.dateInput.fill(
          "2099-07-01"
        );

        await app.page
          .getByTestId(
            "availability-next-seven-available"
          )
          .click();

        const notifications =
          await app.page.evaluate(() => {
            return notificationService
              .getAll();
          });

        expect(notifications).toHaveLength(
          1
        );

        expect(
          notifications[0].type
        ).toBe("availability-range");

        expect(
          notifications[0].audience
        ).toBe("umpire");
      }
    );
  }
);
