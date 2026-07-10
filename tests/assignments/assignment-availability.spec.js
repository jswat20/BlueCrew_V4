const {
  test,
  expect
} = require("@playwright/test");

const {
  AssignmentDrawerPage
} = require("../pages/AssignmentDrawerPage");

const GAME_DATE = "2026-08-15";
const OTHER_DATE = "2026-08-16";
const POSITION = "Plate";

async function setupAssignmentAvailability(
  page,
  {
    firstStatus = "available",
    secondStatus = "maybe",
    thirdStatus = "unavailable",
    availabilityDate = GAME_DATE,
    gameDate = GAME_DATE,
    existingCrewIndex = null
  } = {}
) {
  await page.goto("/");

  const setup = await page.evaluate(
    ({
      firstStatus,
      secondStatus,
      thirdStatus,
      availabilityDate,
      gameDate,
      existingCrewIndex
    }) => {
      authService.loginAsAdmin();
      document.body.dataset.role = "admin";

      if (window.BlueCrew?.test) {
        window.BlueCrew.test.currentRole = "admin";
      }

      if (window.qaService) {
        qaService.setRole("admin");
      }

      const testRunId =
        `${Date.now()}-${Math.random()
          .toString(16)
          .slice(2)}`;

      const testCrew = [
        {
          id: `availability-available-${testRunId}`,
          firstName: "Available",
          lastName: "Umpire",
          email:
            `available-${testRunId}@test.com`,
          active: true,
          levels: ["12U"],
          availability: {},
          dateAvailability: {}
        },
        {
          id: `availability-maybe-${testRunId}`,
          firstName: "Maybe",
          lastName: "Umpire",
          email:
            `maybe-${testRunId}@test.com`,
          active: true,
          levels: ["12U"],
          availability: {},
          dateAvailability: {}
        },
        {
          id: `availability-unavailable-${testRunId}`,
          firstName: "Unavailable",
          lastName: "Umpire",
          email:
            `unavailable-${testRunId}@test.com`,
          active: true,
          levels: ["12U"],
          availability: {},
          dateAvailability: {}
        }
      ];

      testCrew.forEach(member => {
        crew.push(member);
      });

      if (typeof saveCrew === "function") {
        saveCrew();
      }

      const statuses = [
        firstStatus,
        secondStatus,
        thirdStatus
      ];

      testCrew.forEach((member, index) => {
        const result =
          availabilityService.setAvailability({
            crewId: member.id,
            date: availabilityDate,
            status: statuses[index]
          });

        if (!result) {
          throw new Error(
            `Unable to set availability for ${member.id}.`
          );
        }
      });

      const createResult = gameService.create({
        date: gameDate,
        time: "6:00 PM",
        field: "Availability Field",
        level: "12U",
        homeTeam:
          `Availability Home ${testRunId}`,
        awayTeam:
          `Availability Away ${testRunId}`,
        gameType: "single"
      });

      if (
        !createResult?.success ||
        !createResult.data
      ) {
        throw new Error(
          createResult?.message ||
          "Unable to create availability test game."
        );
      }

      const game = createResult.data;

      if (
        Number.isInteger(existingCrewIndex) &&
        testCrew[existingCrewIndex]
      ) {
        const assignment =
          game.assignments?.[0];

        if (!assignment) {
          throw new Error(
            "Created game has no assignment slot."
          );
        }

        assignment.crewId =
          testCrew[existingCrewIndex].id;

        assignment.status = "assigned";

        game.crewId =
          testCrew[existingCrewIndex].id;

        game.assignmentStatus = "assigned";

        if (typeof saveGames === "function") {
          saveGames();
        }
      }

      return {
        gameId: game.id,
        gameDate: game.date,
        crew: testCrew.map(member => ({
          id: String(member.id),
          name: crewService.getName(member)
        }))
      };
    },
    {
      firstStatus,
      secondStatus,
      thirdStatus,
      availabilityDate,
      gameDate,
      existingCrewIndex
    }
  );

  await page.evaluate(gameId => {
    openAssignmentDrawer(gameId);
  }, setup.gameId);

  const drawer =
    new AssignmentDrawerPage(page);

  await drawer.expectOpen();

  return {
    drawer,
    ...setup
  };
}

test.describe(
  "Assignment Drawer date availability",
  () => {
    test(
      "unavailable crew option displays Unavailable",
      async ({ page }) => {
        const { drawer, crew } =
          await setupAssignmentAvailability(page);

        await drawer.expectOptionText(
          POSITION,
          crew[2].id,
          `${crew[2].name} — Unavailable`
        );
      }
    );

    test(
      "maybe crew option displays Maybe",
      async ({ page }) => {
        const { drawer, crew } =
          await setupAssignmentAvailability(page);

        await drawer.expectOptionText(
          POSITION,
          crew[1].id,
          `${crew[1].name} — Maybe`
        );
      }
    );

    test(
      "available crew remains selectable",
      async ({ page }) => {
        const { drawer, crew } =
          await setupAssignmentAvailability(page);

        await drawer.selectById(
          POSITION,
          crew[0].id
        );

        expect(
          await drawer.selected(POSITION)
        ).toBe(crew[0].id);

        await drawer.expectAvailability(
          POSITION,
          "available"
        );
      }
    );

    test(
      "unavailable crew remains selectable",
      async ({ page }) => {
        const { drawer, crew } =
          await setupAssignmentAvailability(page);

        await drawer.selectById(
          POSITION,
          crew[2].id
        );

        expect(
          await drawer.selected(POSITION)
        ).toBe(crew[2].id);
      }
    );

    test(
      "maybe crew remains selectable",
      async ({ page }) => {
        const { drawer, crew } =
          await setupAssignmentAvailability(page);

        await drawer.selectById(
          POSITION,
          crew[1].id
        );

        expect(
          await drawer.selected(POSITION)
        ).toBe(crew[1].id);
      }
    );

    test(
      "selected unavailable crew displays an unavailable badge",
      async ({ page }) => {
        const { drawer, crew } =
          await setupAssignmentAvailability(page);

        await drawer.selectById(
          POSITION,
          crew[2].id
        );

        await drawer.expectAvailability(
          POSITION,
          "unavailable"
        );
      }
    );

    test(
      "selected maybe crew displays a maybe badge",
      async ({ page }) => {
        const { drawer, crew } =
          await setupAssignmentAvailability(page);

        await drawer.selectById(
          POSITION,
          crew[1].id
        );

        await drawer.expectAvailability(
          POSITION,
          "maybe"
        );
      }
    );

    test(
      "availability is resolved using the game date",
      async ({ page }) => {
        const {
          drawer,
          crew,
          gameDate
        } =
          await setupAssignmentAvailability(
            page,
            {
              thirdStatus: "unavailable",
              availabilityDate: GAME_DATE,
              gameDate: GAME_DATE
            }
          );

        expect(gameDate).toBe(GAME_DATE);

        await drawer.expectOptionText(
          POSITION,
          crew[2].id,
          `${crew[2].name} — Unavailable`
        );

        await drawer.selectById(
          POSITION,
          crew[2].id
        );

        await drawer.expectAvailability(
          POSITION,
          "unavailable"
        );
      }
    );

    test(
      "availability for a different date does not affect the current game",
      async ({ page }) => {
        const { drawer, crew } =
          await setupAssignmentAvailability(
            page,
            {
              thirdStatus: "unavailable",
              availabilityDate: OTHER_DATE,
              gameDate: GAME_DATE
            }
          );

        await drawer.expectOptionText(
          POSITION,
          crew[2].id,
          crew[2].name
        );

        await drawer.selectById(
          POSITION,
          crew[2].id
        );

        await drawer.expectAvailability(
          POSITION,
          "available"
        );
      }
    );

    test(
      "existing assignment save behavior still works",
      async ({ page }) => {
        const {
          drawer,
          crew,
          gameId
        } =
          await setupAssignmentAvailability(
            page,
            {
              existingCrewIndex: 2
            }
          );

        expect(
          await drawer.selected(POSITION)
        ).toBe(crew[2].id);

        await drawer.expectAvailability(
          POSITION,
          "unavailable"
        );

        await drawer.save();
        await drawer.expectClosed();

        const savedAssignment =
          await page.evaluate(gameId => {
            const game =
              gameService.getById(gameId);

            const assignment =
              game.assignments.find(
                item =>
                  item.position === "Plate"
              );

            return {
              crewId: String(
                assignment?.crewId || ""
              ),
              status:
                assignment?.status || ""
            };
          }, gameId);

        expect(savedAssignment.crewId).toBe(
          crew[2].id
        );

        expect(savedAssignment.status).toBe(
          "assigned"
        );
      }
    );
  }
);