import {
  expect,
  test
} from "@playwright/test";

test.describe(
  "Assignment Decline",
  () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/");
    });

    test(
      "requires a reason",
      async ({ page }) => {
        const result =
          await page.evaluate(() => {
            authService.loginAsAdmin();

            const crewMember =
              crewService.getAll()[0];

            const game =
              gameService.create({
                date: "2099-10-01",
                time: "6:00 PM",
                locationComplex:
                  "Decline Complex",
                locationField:
                  "Decline Field",
                field: "Decline Field",
                level: "12U",
                awayTeam:
                  "Decline Away",
                homeTeam:
                  "Decline Home",
                gameType: "single"
              }).data;

            assignmentService.assignCrew(
              game.id,
              crewMember.id
            );

            return assignmentService
              .declineAssignment(
                game.id,
                crewMember.id,
                "   "
              );
          });

        expect(result).toEqual(
          expect.objectContaining({
            success: false,
            message:
              "Enter a reason for declining the assignment."
          })
        );
      }
    );

    test(
      "removes only the declining umpire and records the reason",
      async ({ page }) => {
        const result =
          await page.evaluate(() => {
            authService.loginAsAdmin();
            notificationService.clearAll();

            const crewMembers =
              crewService.getAll();

            const game =
              gameService.create({
                date: "2099-10-02",
                time: "7:00 PM",
                locationComplex:
                  "Decline Complex",
                locationField:
                  "Decline Field",
                field: "Decline Field",
                level: "14U",
                awayTeam:
                  "Reason Away",
                homeTeam:
                  "Reason Home",
                gameType: "twoMan"
              }).data;

            const assignments =
              assignmentService
                .getAssignments(game);

            assignmentService
              .assignToAssignment(
                game.id,
                assignments[0].id,
                crewMembers[0].id
              );

            assignmentService
              .assignToAssignment(
                game.id,
                assignments[1].id,
                crewMembers[1].id
              );

            const decline =
              assignmentService
                .declineAssignment(
                  game.id,
                  crewMembers[0].id,
                  "Work conflict"
                );

            const savedGame =
              gameService.getById(game.id);

            return {
              decline,
              gameId: game.id,
              first:
                savedGame.assignments[0],
              second:
                savedGame.assignments[1],
              declineRecord:
                savedGame
                  .assignmentDeclines
                  .at(-1),
              notifications:
                notificationService.getAll()
            };
          });

        expect(result.decline.success)
          .toBe(true);

        expect(result.first).toEqual(
          expect.objectContaining({
            crewId: "",
            status: "needs_assignment",
            declineReason:
              "Work conflict"
          })
        );

        expect(result.second.crewId)
          .toBeTruthy();

        expect(result.declineRecord)
          .toEqual(
            expect.objectContaining({
              reason: "Work conflict",
              resultingStatus:
                "needs_assignment"
            })
          );

        expect(result.notifications)
          .toContainEqual(
            expect.objectContaining({
              type:
                "assignment-declined",
              audience: "admin",
              relatedId: result.gameId
            })
          );
      }
    );

    test(
      "reopens a claimed position and persists after reload",
      async ({ page }) => {
        const seeded =
          await page.evaluate(() => {
            authService.loginAsAdmin();

            const crewMember =
              crewService.getAll()[0];

            const game =
              gameService.create({
                date: "2099-10-03",
                time: "5:30 PM",
                locationComplex:
                  "Claim Complex",
                locationField:
                  "Claim Field",
                field: "Claim Field",
                level: "10U",
                awayTeam:
                  "Claim Away",
                homeTeam:
                  "Claim Home",
                gameType: "single"
              }).data;

            assignmentService
              .openForClaims(game.id);

            assignmentService
              .claimGame(
                game.id,
                crewMember.id
              );

            assignmentService
              .approveClaim(game.id);

            const result =
              assignmentService
                .declineAssignment(
                  game.id,
                  crewMember.id,
                  "Family commitment"
                );

            return {
              gameId: game.id,
              result
            };
          });

        expect(seeded.result.success)
          .toBe(true);

        await page.reload();

        const persisted =
          await page.evaluate(
            gameId => {
              const game =
                gameService.getById(gameId);

              return {
                status:
                  assignmentService
                    .getAssignments(game)[0]
                    .status,
                crewId:
                  assignmentService
                    .getAssignments(game)[0]
                    .crewId,
                decline:
                  game.assignmentDeclines
                    .at(-1)
              };
            },
            seeded.gameId
          );

        expect(persisted.status)
          .toBe("open_for_claim");

        expect(persisted.crewId)
          .toBe("");

        expect(persisted.decline)
          .toEqual(
            expect.objectContaining({
              reason:
                "Family commitment",
              resultingStatus:
                "open_for_claim"
            })
          );
      }
    );
  }
);
