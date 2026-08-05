import {
  expect,
  test
} from "./fixtures/app.fixture.js";

test.describe(
  "Upcoming Game Reminders",
  () => {
    test(
      "creates one 24-hour reminder and does not duplicate it",
      async ({ app }) => {
        const account =
          await app.loginAsApprovedUmpire();

        const result =
          await app.page.evaluate(account => {
            notificationService.clearAll();

            authService.loginAsAdmin();

            const now =
              new Date(
                "2099-10-10T12:00:00"
              );

            const gameDateTime =
              new Date(now);

            gameDateTime.setHours(
              gameDateTime.getHours() + 12
            );

            const hour =
              gameDateTime.getHours();

            const period =
              hour >= 12 ? "PM" : "AM";

            const displayHour =
              hour % 12 || 12;

            const time =
              `${displayHour}:00 ${period}`;

            const date =
              gameDateTime
                .toISOString()
                .slice(0, 10);

            const game =
              gameService.create({
                date,
                time,
                locationComplex:
                  "Reminder Complex",
                locationField:
                  "Reminder Field",
                field:
                  "Reminder Field",
                level: "12U",
                awayTeam:
                  "Reminder Away",
                homeTeam:
                  "Reminder Home",
                gameType: "single"
              }).data;

            assignmentService.assignCrew(
              game.id,
              account.crewId
            );

            notificationService.clearAll();

            authService.loginAsUmpire();

            const first =
              notificationService
                .generateUpcomingGameReminders(
                  now
                );

            const second =
              notificationService
                .generateUpcomingGameReminders(
                  now
                );

            return {
              first,
              second,
              notifications:
                notificationService
                  .getAll()
                  .filter(
                    notification =>
                      notification.relatedId ===
                      game.id
                  )
            };
          }, account);

        expect(result.first.createdCount)
          .toBe(1);

        expect(result.second.createdCount)
          .toBe(0);

        expect(result.second.duplicateCount)
          .toBe(1);

        expect(result.notifications)
          .toHaveLength(1);

        expect(result.notifications[0])
          .toEqual(
            expect.objectContaining({
              type:
                "assignment-reminder-24h",
              audience: "umpire",
              reminderKey:
                expect.stringContaining(
                  ":24h"
                )
            })
          );
      }
    );

    test(
      "creates a separate two-hour reminder",
      async ({ app }) => {
        const account =
          await app.loginAsApprovedUmpire();

        const result =
          await app.page.evaluate(account => {
            notificationService.clearAll();

            authService.loginAsAdmin();

            const game =
              gameService.create({
                date: "2099-11-15",
                time: "6:00 PM",
                locationComplex:
                  "Soon Complex",
                locationField:
                  "Soon Field",
                field: "Soon Field",
                level: "14U",
                awayTeam: "Soon Away",
                homeTeam: "Soon Home",
                gameType: "single"
              }).data;

            assignmentService.assignCrew(
              game.id,
              account.crewId
            );

            notificationService.clearAll();

            authService.loginAsUmpire();

            notificationService
              .generateUpcomingGameReminders(
                new Date(
                  "2099-11-14T20:00:00"
                )
              );

            notificationService
              .generateUpcomingGameReminders(
                new Date(
                  "2099-11-15T16:30:00"
                )
              );

            return notificationService
              .getAll()
              .filter(
                notification =>
                  notification.relatedId ===
                  game.id
              );
          }, account);

        expect(result).toHaveLength(2);

        expect(
          result.map(
            notification =>
              notification.type
          )
        ).toEqual(
          expect.arrayContaining([
            "assignment-reminder-24h",
            "assignment-reminder-2h"
          ])
        );
      }
    );

    test(
      "does not remind for past or unassigned games",
      async ({ app }) => {
        const account =
          await app.loginAsApprovedUmpire();

        const result =
          await app.page.evaluate(account => {
            notificationService.clearAll();

            authService.loginAsAdmin();

            const pastGame =
              gameService.create({
                date: "2099-12-01",
                time: "1:00 PM",
                locationComplex:
                  "Past Complex",
                locationField:
                  "Past Field",
                field: "Past Field",
                level: "10U",
                awayTeam: "Past Away",
                homeTeam: "Past Home",
                gameType: "single"
              }).data;

            assignmentService.assignCrew(
              pastGame.id,
              account.crewId
            );

            gameService.create({
              date: "2099-12-02",
              time: "6:00 PM",
              locationComplex:
                "Open Complex",
              locationField:
                "Open Field",
              field: "Open Field",
              level: "10U",
              awayTeam: "Open Away",
              homeTeam: "Open Home",
              gameType: "single"
            });

            notificationService.clearAll();

            authService.loginAsUmpire();

            const generated =
              notificationService
                .generateUpcomingGameReminders(
                  new Date(
                    "2099-12-02T3:00:00 PM"
                  )
                );

            return {
              generated,
              notifications:
                notificationService.getAll()
            };
          }, account);

        expect(result.generated.createdCount)
          .toBe(0);

        expect(result.notifications)
          .toHaveLength(0);
      }
    );
  }
);
