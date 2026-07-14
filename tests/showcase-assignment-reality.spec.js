import {
  expect,
  test
} from "@playwright/test";

test.describe("Showcase Assignment Reality", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");

    await page.evaluate(() => {
      demoDataService.loadLeague();
    });
  });

  test("populates every important assignment state", async ({
    page
  }) => {
    const result = await page.evaluate(() => {
      const assignments =
        gameService
          .getAll()
          .flatMap(game =>
            assignmentService
              .getAssignments(game)
          );

      const count = status =>
        assignments.filter(
          assignment =>
            assignment.status === status
        ).length;

      return {
        assigned:
          count(AssignmentStatus.ASSIGNED),
        locked:
          count(AssignmentStatus.LOCKED),
        needsAssignment:
          count(
            AssignmentStatus.NEEDS_ASSIGNMENT
          ),
        openForClaim:
          count(
            AssignmentStatus.OPEN_FOR_CLAIM
          ),
        pendingApproval:
          count(
            AssignmentStatus.PENDING_APPROVAL
          )
      };
    });

    expect(result.assigned).toBeGreaterThan(0);
    expect(result.locked).toBeGreaterThan(0);

    expect(
      result.needsAssignment
    ).toBeGreaterThan(0);

    expect(
      result.openForClaim
    ).toBeGreaterThan(0);

    expect(
      result.pendingApproval
    ).toBeGreaterThan(0);
  });

  test("populates pending, approved, and rejected claims", async ({
    page
  }) => {
    const result = await page.evaluate(() => ({
      pending:
        claimsQueueService
          .getPendingClaims()
          .length,
      approved:
        claimsQueueService
          .getApprovedClaims()
          .length,
      rejected:
        claimsQueueService
          .getRejectedClaims()
          .length
    }));

    expect(result.pending).toBeGreaterThan(0);
    expect(result.approved).toBeGreaterThan(0);
    expect(result.rejected).toBeGreaterThan(0);
  });

  test("creates realistic workload imbalance", async ({
    page
  }) => {
    const workloads = await page.evaluate(() => {
      const counts = {};

      gameService
        .getAll()
        .forEach(game => {
          assignmentService
            .getAssignments(game)
            .forEach(assignment => {
              if (!assignment.crewId) return;

              counts[assignment.crewId] =
                (counts[assignment.crewId] || 0) + 1;
            });
        });

      return Object.values(counts);
    });

    expect(workloads.length).toBeGreaterThan(10);

    expect(
      Math.max(...workloads)
    ).toBeGreaterThan(
      Math.min(...workloads)
    );
  });

  test("creates partially staffed games", async ({
    page
  }) => {
    const result = await page.evaluate(() =>
      gameService
        .getAll()
        .filter(game => {
          const assignments =
            assignmentService
              .getAssignments(game);

          return (
            assignments.some(
              assignment =>
                Boolean(assignment.crewId)
            ) &&
            assignments.some(
              assignment =>
                !assignment.crewId
            )
          );
        })
        .length
    );

    expect(result).toBeGreaterThan(0);
  });

  test("creates at least one same-time crew conflict", async ({
    page
  }) => {
    const result = await page.evaluate(() => {
      const crewId =
        "showcase-crew-001";

      const assignedGames =
        gameService
          .getAll()
          .filter(game =>
            assignmentService
              .getAssignments(game)
              .some(
                assignment =>
                  assignment.crewId === crewId
              )
          );

      return assignedGames.some(
        (game, index) =>
          assignedGames
            .slice(index + 1)
            .some(
              other =>
                other.date === game.date &&
                other.time === game.time
            )
      );
    });

    expect(result).toBe(true);
  });

  test("populates administrator operational queues", async ({
    page
  }) => {
    const result = await page.evaluate(() => {
      authService.loginAsAdmin();

      return {
        pendingClaims:
          claimsQueueService
            .getPendingClaims()
            .length,
        openGames:
          gameService
            .getAll()
            .filter(game =>
              assignmentService
                .getAssignments(game)
                .some(
                  assignment =>
                    !assignment.crewId
                )
            )
            .length
      };
    });

    expect(
      result.pendingClaims
    ).toBeGreaterThan(0);

    expect(
      result.openGames
    ).toBeGreaterThan(0);
  });
});
