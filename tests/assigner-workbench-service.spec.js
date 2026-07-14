import { expect, test } from "@playwright/test";

test.describe("Assigner Workbench Service", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("returns one presentation-ready workbench object", async ({
    page
  }) => {
    const result = await page.evaluate(() => {
      const workbench =
        dashboardService.getWorkbench();

      return {
        workbench,
        expected: {
          needsAssignment:
            assignmentService
              .getNeedsAssignmentGames()
              .length,

          pendingClaims:
            claimsQueueService
              .getPendingClaims()
              .length,

          awaitingReview:
            reviewService
              .getSubmittedGames()
              .length,

          returnedReviews:
            reviewService
              .getReturnedGames()
              .length,

          recentActivity:
            dashboardService
              .getRecentAssignmentActivity()
              .length
        }
      };
    });

    const { workbench, expected } = result;

    expect(workbench).toEqual(
      expect.objectContaining({
        sections: expect.any(Object),
        counts: expect.any(Object),
        totalActionItems: expect.any(Number),
        requiresAttention: expect.any(Boolean),
        isEmpty: expect.any(Boolean)
      })
    );

    expect(workbench.sections).toEqual(
      expect.objectContaining({
        needsAssignment: expect.any(Array),
        pendingClaims: expect.any(Array),
        awaitingReview: expect.any(Array),
        returnedReviews: expect.any(Array),
        todaysPriorities: expect.any(Array),
        recentActivity: expect.any(Array)
      })
    );

    expect(workbench.counts).toEqual(
      expect.objectContaining(expected)
    );
  });

  test("derives summary state from section counts", async ({
    page
  }) => {
    const result = await page.evaluate(() => {
      const workbench =
        dashboardService.getWorkbench();

      const actionCount =
        workbench.counts.needsAssignment +
        workbench.counts.pendingClaims +
        workbench.counts.awaitingReview +
        workbench.counts.returnedReviews +
        workbench.counts.todaysPriorities;

      return {
        totalActionItems:
          workbench.totalActionItems,

        expectedActionItems:
          actionCount,

        requiresAttention:
          workbench.requiresAttention,

        expectedRequiresAttention:
          actionCount > 0,

        isEmpty:
          workbench.isEmpty,

        expectedEmpty:
          Object.values(workbench.counts)
            .every(count => count === 0)
      };
    });

    expect(result.totalActionItems)
      .toBe(result.expectedActionItems);

    expect(result.requiresAttention)
      .toBe(result.expectedRequiresAttention);

    expect(result.isEmpty)
      .toBe(result.expectedEmpty);
  });

  test("returns data only and no rendered HTML", async ({
    page
  }) => {
    const serialized = await page.evaluate(() =>
      JSON.stringify(
        dashboardService.getWorkbench()
      )
    );

    expect(serialized).not.toContain("<section");
    expect(serialized).not.toContain("<article");
    expect(serialized).not.toContain("<button");
  });
});
