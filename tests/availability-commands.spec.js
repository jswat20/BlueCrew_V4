const {
  test,
  expect
} = require("@playwright/test");

async function openApp(page) {
  await page.goto("/");

  await page.waitForFunction(() => {
    return (
      typeof availabilityService !==
        "undefined" &&
      typeof crewService !== "undefined" &&
      typeof gameService !== "undefined"
    );
  });
}

async function getCrewId(page) {
  return page.evaluate(() => {
    const member = crewService.getAll()[0];

    if (!member) {
      throw new Error(
        "Availability command tests require a crew member."
      );
    }

    member.dateAvailability = {};

    if (typeof saveCrew === "function") {
      saveCrew();
    }

    return member.id;
  });
}

test.describe(
  "Availability Service Commands",
  () => {
    test.beforeEach(async ({ page }) => {
      await openApp(page);
    });

    test(
      "sets availability across a date range",
      async ({ page }) => {
        const crewId =
          await getCrewId(page);

        const result = await page.evaluate(
          crewId =>
            availabilityService
              .setAvailabilityRange({
                crewId,
                startDate: "2099-04-01",
                endDate: "2099-04-03",
                status: "unavailable"
              }),
          crewId
        );

        expect(result.success).toBe(true);
        expect(result.data.dates).toHaveLength(3);

        const statuses =
          await page.evaluate(crewId => {
            return [
              "2099-04-01",
              "2099-04-02",
              "2099-04-03"
            ].map(date =>
              availabilityService
                .getAvailability(
                  crewId,
                  date
                )
            );
          }, crewId);

        expect(statuses).toEqual([
          "unavailable",
          "unavailable",
          "unavailable"
        ]);
      }
    );

    test(
      "rejects an invalid date range",
      async ({ page }) => {
        const crewId =
          await getCrewId(page);

        const result = await page.evaluate(
          crewId =>
            availabilityService
              .setAvailabilityRange({
                crewId,
                startDate: "2099-04-05",
                endDate: "2099-04-01",
                status: "available"
              }),
          crewId
        );

        expect(result).toEqual({
          success: false,
          message:
            "Enter a valid availability date range.",
          data: null
        });
      }
    );

    test(
      "copies seven days to another week",
      async ({ page }) => {
        const crewId =
          await getCrewId(page);

        const result = await page.evaluate(
          crewId => {
            const statuses = [
              "unavailable",
              "maybe",
              "available",
              "unavailable",
              "available",
              "maybe",
              "unavailable"
            ];

            statuses.forEach(
              (status, index) => {
                const date =
                  new Date(
                    Date.UTC(
                      2099,
                      3,
                      7 + index
                    )
                  )
                    .toISOString()
                    .slice(0, 10);

                availabilityService
                  .setAvailability({
                    crewId,
                    date,
                    status
                  });
              }
            );

            return availabilityService
              .copyAvailabilityWeek({
                crewId,
                sourceStartDate:
                  "2099-04-07",
                targetStartDate:
                  "2099-04-14"
              });
          },
          crewId
        );

        expect(result.success).toBe(true);
        expect(result.data.dates).toHaveLength(7);

        const copied =
          await page.evaluate(crewId => {
            return [
              "2099-04-14",
              "2099-04-15",
              "2099-04-16",
              "2099-04-17",
              "2099-04-18",
              "2099-04-19",
              "2099-04-20"
            ].map(date =>
              availabilityService
                .getAvailability(
                  crewId,
                  date
                )
            );
          }, crewId);

        expect(copied).toEqual([
          "unavailable",
          "maybe",
          "available",
          "unavailable",
          "available",
          "maybe",
          "unavailable"
        ]);
      }
    );

    test(
      "detects an assignment on a date",
      async ({ page }) => {
        const crewId =
          await getCrewId(page);

        const result = await page.evaluate(
          crewId => {
            const games = gameService.getAll();

            games.push({
              id:
                "availability-assignment-test",
              date: "2099-05-10",
              time: "6:00 PM",
              status: "scheduled",
              crewId: "",
              assignments: [
                {
                  id:
                    "availability-assignment-slot",
                  gameId:
                    "availability-assignment-test",
                  position: "Plate",
                  crewId,
                  status: "assigned",
                  locked: false
                }
              ]
            });

            return {
              assigned:
                availabilityService
                  .hasAssignmentOnDate(
                    crewId,
                    "2099-05-10"
                  ),
              unassigned:
                availabilityService
                  .hasAssignmentOnDate(
                    crewId,
                    "2099-05-11"
                  )
            };
          },
          crewId
        );

        expect(result).toEqual({
          assigned: true,
          unassigned: false
        });
      }
    );

    test(
      "builds a range summary",
      async ({ page }) => {
        const crewId =
          await getCrewId(page);

        const summary =
          await page.evaluate(crewId => {
            availabilityService
              .setAvailability({
                crewId,
                date: "2099-06-01",
                status: "available"
              });

            availabilityService
              .setAvailability({
                crewId,
                date: "2099-06-02",
                status: "maybe"
              });

            availabilityService
              .setAvailability({
                crewId,
                date: "2099-06-03",
                status: "unavailable"
              });

            return availabilityService
              .getAvailabilitySummary(
                crewId,
                {
                  startDate: "2099-06-01",
                  endDate: "2099-06-04"
                }
              );
          }, crewId);

        expect(summary.total).toBe(4);

        expect(summary.counts).toEqual({
          available: 2,
          unavailable: 1,
          maybe: 1,
          assigned: 0
        });

        expect(
          summary.nextUnavailableDate
        ).toBe("2099-06-03");
      }
    );

    test(
      "range updates persist after reload",
      async ({ page }) => {
        const crewId =
          await getCrewId(page);

        await page.evaluate(crewId => {
          availabilityService
            .setAvailabilityRange({
              crewId,
              startDate: "2099-07-01",
              endDate: "2099-07-02",
              status: "maybe"
            });
        }, crewId);

        await page.reload();

        await page.waitForFunction(() => {
          return (
            typeof availabilityService !==
              "undefined"
          );
        });

        const statuses =
          await page.evaluate(crewId => {
            return [
              availabilityService
                .getAvailability(
                  crewId,
                  "2099-07-01"
                ),
              availabilityService
                .getAvailability(
                  crewId,
                  "2099-07-02"
                )
            ];
          }, crewId);

        expect(statuses).toEqual([
          "maybe",
          "maybe"
        ]);
      }
    );
  }
);
