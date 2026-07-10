const {
  test,
  expect
} = require("@playwright/test");

async function openApp(page) {
  await page.goto("/");
  await page.waitForFunction(() => {
    return (
      typeof recommendationService !== "undefined" &&
      typeof availabilityService !== "undefined" &&
      typeof crewBuilderService !== "undefined" &&
      typeof assignmentService !== "undefined"
    );
  });
}

async function setupScenario(
  page,
  statuses = {},
  options = {}
) {
  return page.evaluate(
    ({ statuses, options }) => {
      const members = crewService
        .getAll()
        .slice(0, 3);

      if (members.length < 3) {
        throw new Error(
          "Recommendation availability tests require at least three crew members."
        );
      }

      const date =
        options.date || "2099-08-15";

      const otherDate =
        options.otherDate || "2099-08-16";

      const game = {
        id: "recommendation-availability-game",
        date,
        time: "6:00 PM",
        level: "Varsity",
        homeTeam: "Home",
        awayTeam: "Away",
        gameType: "single",
        crewSize: 1,
        crewId: "",
        assignmentStatus: "unassigned",
        assignments: [
          {
            id:
              "recommendation-availability-game-plate",
            gameId:
              "recommendation-availability-game",
            position: "Plate",
            crewId: "",
            status: "open",
            locked: false,
            claimedBy: ""
          }
        ]
      };

      /*
       * Isolate the test game so existing schedule data cannot
       * create conflicts or workload differences.
       */
      const allGames = gameService.getAll();

      allGames.splice(
        0,
        allGames.length,
        game
      );

      members.forEach((member, index) => {
        member.active = true;
        member.levels = [];

        /*
         * Keep legacy game-specific availability equal so only
         * date availability determines the score difference.
         */
        if (!member.availability) {
          member.availability = {};
        }

        member.availability[game.id] = "unknown";

        availabilityService.clearAvailability(
          member.id,
          date
        );

        availabilityService.clearAvailability(
          member.id,
          otherDate
        );

        const status =
          statuses[index] || "available";

        availabilityService.setAvailability({
          crewId: member.id,
          date,
          status
        });
      });

      return {
        gameId: game.id,
        assignmentId: game.assignments[0].id,
        date,
        otherDate,
        crewIds: members.map(member =>
          member.id
        )
      };
    },
    {
      statuses,
      options
    }
  );
}

async function getRecommendations(page, gameId) {
  return page.evaluate(id => {
    const game = gameService.getById(id);

    return recommendationService
      .getRecommendedCrewForGame(game)
      .map(item => ({
        crewId: item.crewId,
        score: item.score,
        availability: item.availability,
        dateAvailability:
          item.dateAvailability,
        eligible: item.eligible,
        available: item.available,
        conflict: item.conflict,
        reasons: item.reasons
      }));
  }, gameId);
}

test.describe(
  "Availability-aware recommendations",
  () => {
    test.beforeEach(async ({ page }) => {
      await openApp(page);
    });

    test(
      "available crew ranks above Maybe crew",
      async ({ page }) => {
        const setup = await setupScenario(
          page,
          [
            "maybe",
            "available",
            "unavailable"
          ]
        );

        const recommendations =
          await getRecommendations(
            page,
            setup.gameId
          );

        expect(recommendations[0].crewId)
          .toBe(setup.crewIds[1]);

        expect(recommendations[0].dateAvailability)
          .toBe("available");
      }
    );

    test(
      "Maybe crew ranks above Unavailable crew",
      async ({ page }) => {
        const setup = await setupScenario(
          page,
          [
            "unavailable",
            "maybe",
            "unavailable"
          ]
        );

        const recommendations =
          await getRecommendations(
            page,
            setup.gameId
          );

        expect(recommendations[0].crewId)
          .toBe(setup.crewIds[1]);

        expect(recommendations[0].dateAvailability)
          .toBe("maybe");
      }
    );

    test(
      "availability is resolved using the game date",
      async ({ page }) => {
        const setup = await setupScenario(
          page,
          [
            "maybe",
            "available",
            "available"
          ]
        );

        const result = await page.evaluate(
          ({ gameId, crewId }) => {
            const game =
              gameService.getById(gameId);

            const member =
              crewService.getById(crewId);

            return recommendationService
              .scoreCrewForGame(
                member,
                game
              );
          },
          {
            gameId: setup.gameId,
            crewId: setup.crewIds[0]
          }
        );

        expect(result.dateAvailability)
          .toBe("maybe");
      }
    );

    test(
      "availability on another date does not affect ranking",
      async ({ page }) => {
        const setup = await setupScenario(
          page,
          [
            "available",
            "available",
            "available"
          ]
        );

        await page.evaluate(
          ({ crewId, otherDate }) => {
            availabilityService.setAvailability({
              crewId,
              date: otherDate,
              status: "unavailable"
            });
          },
          {
            crewId: setup.crewIds[0],
            otherDate: setup.otherDate
          }
        );

        const recommendation =
          await page.evaluate(
            ({ gameId, crewId }) => {
              const game =
                gameService.getById(gameId);

              return recommendationService
                .getRecommendedCrewForGame(game)
                .find(
                  item =>
                    String(item.crewId) ===
                    String(crewId)
                );
            },
            {
              gameId: setup.gameId,
              crewId: setup.crewIds[0]
            }
          );

        expect(
          recommendation.dateAvailability
        ).toBe("available");
      }
    );

    test(
      "Maybe status reduces score by 20",
      async ({ page }) => {
        const setup = await setupScenario(
          page,
          [
            "available",
            "maybe",
            "available"
          ]
        );

        const recommendations =
          await getRecommendations(
            page,
            setup.gameId
          );

        const available =
          recommendations.find(
            item =>
              String(item.crewId) ===
              String(setup.crewIds[0])
          );

        const maybe =
          recommendations.find(
            item =>
              String(item.crewId) ===
              String(setup.crewIds[1])
          );

        expect(available.score - maybe.score)
          .toBe(20);
      }
    );

    test(
      "Unavailable reduces score more than Maybe",
      async ({ page }) => {
        const setup = await setupScenario(
          page,
          [
            "available",
            "maybe",
            "unavailable"
          ]
        );

        const recommendations =
          await getRecommendations(
            page,
            setup.gameId
          );

        const available =
          recommendations.find(
            item =>
              String(item.crewId) ===
              String(setup.crewIds[0])
          );

        const maybe =
          recommendations.find(
            item =>
              String(item.crewId) ===
              String(setup.crewIds[1])
          );

        const unavailable =
          recommendations.find(
            item =>
              String(item.crewId) ===
              String(setup.crewIds[2])
          );

        expect(available.score - maybe.score)
          .toBe(20);

        expect(maybe.score - unavailable.score)
          .toBe(40);

        expect(unavailable.score)
          .toBeLessThan(maybe.score);
      }
    );

    test(
      "Maybe reason is informational",
      async ({ page }) => {
        const setup = await setupScenario(
          page,
          [
            "maybe",
            "available",
            "available"
          ]
        );

        const recommendations =
          await getRecommendations(
            page,
            setup.gameId
          );

        const result =
          recommendations.find(
            item =>
              String(item.crewId) ===
              String(setup.crewIds[0])
          );

        expect(result.reasons).toContain(
          "Crew member marked Maybe for this date."
        );
      }
    );

    test(
      "Unavailable reason is informational",
      async ({ page }) => {
        const setup = await setupScenario(
          page,
          [
            "unavailable",
            "available",
            "available"
          ]
        );

        const recommendations =
          await getRecommendations(
            page,
            setup.gameId
          );

        const result =
          recommendations.find(
            item =>
              String(item.crewId) ===
              String(setup.crewIds[0])
          );

        expect(result.reasons).toContain(
          "Crew member marked Unavailable for this date."
        );
      }
    );

    test(
      "date availability does not make crew ineligible",
      async ({ page }) => {
        const setup = await setupScenario(
          page,
          [
            "unavailable",
            "available",
            "available"
          ]
        );

        const recommendations =
          await getRecommendations(
            page,
            setup.gameId
          );

        const unavailable =
          recommendations.find(
            item =>
              String(item.crewId) ===
              String(setup.crewIds[0])
          );

        expect(unavailable.eligible)
          .toBe(true);
      }
    );

    test(
      "date availability does not create a conflict",
      async ({ page }) => {
        const setup = await setupScenario(
          page,
          [
            "unavailable",
            "available",
            "available"
          ]
        );

        const recommendations =
          await getRecommendations(
            page,
            setup.gameId
          );

        const unavailable =
          recommendations.find(
            item =>
              String(item.crewId) ===
              String(setup.crewIds[0])
          );

        expect(unavailable.conflict)
          .toBe(false);
      }
    );

    test(
      "canAssign and isAvailable remain true for date-unavailable crew",
      async ({ page }) => {
        const setup = await setupScenario(
          page,
          [
            "unavailable",
            "available",
            "available"
          ]
        );

        const result = await page.evaluate(
          ({ gameId, crewId }) => {
            const game =
              gameService.getById(gameId);

            return {
              canAssign:
                availabilityService.canAssign(
                  crewId,
                  game
                ),
              isAvailable:
                availabilityService.isAvailable(
                  crewId,
                  game
                )
            };
          },
          {
            gameId: setup.gameId,
            crewId: setup.crewIds[0]
          }
        );

        expect(result.canAssign.success)
          .toBe(true);

        expect(result.isAvailable)
          .toBe(true);
      }
    );

    test(
      "manual assignment of unavailable crew still works",
      async ({ page }) => {
        const setup = await setupScenario(
          page,
          [
            "unavailable",
            "available",
            "available"
          ]
        );

        const result = await page.evaluate(
          ({
            gameId,
            assignmentId,
            crewId
          }) => {
            return assignmentService
              .assignToAssignment(
                gameId,
                assignmentId,
                crewId
              );
          },
          {
            gameId: setup.gameId,
            assignmentId:
              setup.assignmentId,
            crewId: setup.crewIds[0]
          }
        );

        expect(result.success).toBe(true);
      }
    );

    test(
      "auto-fill prefers available crew",
      async ({ page }) => {
        const setup = await setupScenario(
          page,
          [
            "maybe",
            "unavailable",
            "available"
          ]
        );

        const result = await page.evaluate(
          gameId => {
            const game =
              gameService.getById(gameId);

            crewBuilderService.createDraft(game);
            crewBuilderService.autoFill();

            return crewBuilderService
              .getDraft()
              .assignments[0]
              .crewId;
          },
          setup.gameId
        );

        expect(String(result)).toBe(
          String(setup.crewIds[2])
        );
      }
    );

    test(
      "auto-fill uses Maybe when no available valid candidate exists",
      async ({ page }) => {
        const setup = await setupScenario(
          page,
          [
            "unavailable",
            "maybe",
            "unavailable"
          ]
        );

        const result = await page.evaluate(
          gameId => {
            const game =
              gameService.getById(gameId);

            crewBuilderService.createDraft(game);
            crewBuilderService.autoFill();

            return crewBuilderService
              .getDraft()
              .assignments[0]
              .crewId;
          },
          setup.gameId
        );

        expect(String(result)).toBe(
          String(setup.crewIds[1])
        );
      }
    );

    test(
      "auto-fill may use unavailable crew when it is the only valid candidate",
      async ({ page }) => {
        const setup = await setupScenario(
          page,
          [
            "unavailable",
            "available",
            "available"
          ]
        );

        await page.evaluate(
          crewIds => {
            const first =
              crewService.getById(crewIds[0]);

            const second =
              crewService.getById(crewIds[1]);

            const third =
              crewService.getById(crewIds[2]);

            first.active = true;
            first.levels = [];

            second.active = false;
            third.active = false;
          },
          setup.crewIds
        );

        const result = await page.evaluate(
          gameId => {
            const game =
              gameService.getById(gameId);

            crewBuilderService.createDraft(game);
            crewBuilderService.autoFill();

            return crewBuilderService
              .getDraft()
              .assignments[0]
              .crewId;
          },
          setup.gameId
        );

        expect(String(result)).toBe(
          String(setup.crewIds[0])
        );
      }
    );
  }
);