import { expect, test } from "@playwright/test";

test.describe("Assigner Workbench 9B", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("needs assignment drill-down preserves context", async ({
    page
  }) => {
    const result = await page.evaluate(() => {
      const original =
        dashboardService.getWorkbench;

      dashboardService.getWorkbench = () => ({
        sections: {
          needsAssignment: [
            {
              id: "game-workbench-open",
              matchup: "Visitors @ Home"
            }
          ],
          pendingClaims: [],
          awaitingReview: [],
          returnedReviews: [],
          todaysPriorities: [],
          recentActivity: []
        },
        counts: {
          needsAssignment: 1,
          pendingClaims: 0,
          awaitingReview: 0,
          returnedReviews: 0,
          todaysPriorities: 0,
          recentActivity: 0
        },
        totalActionItems: 1,
        requiresAttention: true,
        isEmpty: false
      });

      navigateTo("assigner-workbench");

      dashboardService.getWorkbench =
        original;

      return true;
    });

    expect(result).toBe(true);

    await page
      .getByTestId(
        "workbench-needs-assignment-item"
      )
      .click();

    const context = await page.evaluate(() => ({
      page: currentPage,
      context: currentPageContext
    }));

    expect(context.page).toBe("schedule");
    expect(context.context).toEqual(
      expect.objectContaining({
        filter: "open",
        gameId: "game-workbench-open"
      })
    );
  });

  test("claim and review actions preserve queue context", async ({
    page
  }) => {
    await page.evaluate(() => {
      handleWorkbenchAction(
        "pending-claim",
        {
          gameId: "claim-game",
          assignmentId: "assignment-1"
        }
      );
    });

    let state = await page.evaluate(() => ({
      page: currentPage,
      context: currentPageContext
    }));

    expect(state.page).toBe("claims-queue");
    expect(state.context).toEqual({
      status: "pending",
      assignmentId: "assignment-1",
      gameId: "claim-game"
    });

    await page.evaluate(() => {
      handleWorkbenchAction(
        "awaiting-review",
        {
          gameId: "submitted-game"
        }
      );
    });

    state = await page.evaluate(() => ({
      page: currentPage,
      context: currentPageContext
    }));

    expect(state.page).toBe("review-queue");
    expect(state.context).toEqual({
      filter: "submitted",
      status: "submitted",
      gameId: "submitted-game"
    });

    await page.evaluate(() => {
      handleWorkbenchAction(
        "returned-review",
        {
          gameId: "returned-game"
        }
      );
    });

    state = await page.evaluate(() => ({
      page: currentPage,
      context: currentPageContext
    }));

    expect(state.page).toBe("review-queue");
    expect(state.context).toEqual({
      filter: "returned",
      status: "returned",
      gameId: "returned-game"
    });
  });

  test("activity opens its game or falls back to notifications", async ({
    page
  }) => {
    await page.evaluate(() => {
      handleWorkbenchAction(
        "activity",
        {
          gameId: "activity-game"
        }
      );
    });

    let state = await page.evaluate(() => ({
      page: currentPage,
      context: currentPageContext
    }));

    expect(state.page).toBe("game-hub");
    expect(state.context).toEqual({
      gameId: "activity-game"
    });

    await page.evaluate(() => {
      handleWorkbenchAction(
        "activity",
        {}
      );
    });

    state = await page.evaluate(() => ({
      page: currentPage,
      context: currentPageContext
    }));

    expect(state.page).toBe("notifications");
  });

  test("renders one global empty state", async ({
    page
  }) => {
    await page.evaluate(() => {
      const original =
        dashboardService.getWorkbench;

      dashboardService.getWorkbench = () => ({
        sections: {
          needsAssignment: [],
          pendingClaims: [],
          awaitingReview: [],
          returnedReviews: [],
          todaysPriorities: [],
          recentActivity: []
        },
        counts: {
          needsAssignment: 0,
          pendingClaims: 0,
          awaitingReview: 0,
          returnedReviews: 0,
          todaysPriorities: 0,
          recentActivity: 0
        },
        totalActionItems: 0,
        requiresAttention: false,
        isEmpty: true
      });

      navigateTo("assigner-workbench");

      dashboardService.getWorkbench =
        original;
    });

    await expect(
      page.getByTestId(
        "assigner-workbench-empty"
      )
    ).toHaveCount(0);

    await expect(
      page.getByTestId(
        "workbench-needs-assignment"
      )
    ).toBeVisible();

    await expect(
      page.getByTestId(
        "workbench-needs-assignment-empty"
      )
    ).toBeVisible();
  });

  test("refresh hook rerenders current workbench data", async ({
    page
  }) => {
    const initialCount =
      await page.evaluate(() => {
        navigateTo("assigner-workbench");

        return document.querySelector(
          '[data-testid="assigner-workbench"]'
        )
          ? 1
          : 0;
      });

    expect(initialCount).toBe(1);

    await page.evaluate(() => {
      refreshWorkbenchIfActive();
    });

    await expect(
      page.getByTestId("assigner-workbench")
    ).toBeVisible();
  });

  test("navigation is restricted to administrator and assigner roles", async ({
    page
  }) => {
    const access = await page.evaluate(() => ({
      administrator:
        authorizationService.canView(
          "assigner-workbench",
          "administrator"
        ),
      assigner:
        authorizationService.canView(
          "assigner-workbench",
          "assigner"
        ),
      umpire:
        authorizationService.canView(
          "assigner-workbench",
          "umpire"
        )
    }));

    expect(access).toEqual({
      administrator: true,
      assigner: true,
      umpire: false
    });
  });
});

test.describe("Assigner Workbench priority presentation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("service selects the first populated operational section", async ({
    page
  }) => {
    const result = await page.evaluate(() => {
      const workbench =
        dashboardService.getWorkbench();

      const expected =
        workbench.priorityOrder.find(
          section =>
            workbench.counts[section.key] > 0
        ) || null;

      return {
        nextSection:
          workbench.nextSection,
        expected
      };
    });

    expect(result.nextSection)
      .toEqual(result.expected);
  });

  test("renders no more than one work-next card", async ({
    page
  }) => {
    await page.evaluate(() => {
      navigateTo("assigner-workbench");
    });

    const priorityCards =
      page.locator(
        '[data-priority="true"]'
      );

    expect(
      await priorityCards.count()
    ).toBeLessThanOrEqual(1);
  });

  test("shows view all when a section exceeds five items", async ({
    page
  }) => {
    await page.evaluate(() => {
      const original =
        dashboardService.getWorkbench;

      dashboardService.getWorkbench =
        () => ({
          sections: {
            needsAssignment:
              Array.from(
                { length: 6 },
                (_, index) => ({
                  id: `game-${index}`,
                  matchup:
                    `Visitors ${index} @ Home ${index}`
                })
              ),
            pendingClaims: [],
            awaitingReview: [],
            returnedReviews: [],
            todaysPriorities: [],
            recentActivity: []
          },
          counts: {
            needsAssignment: 6,
            pendingClaims: 0,
            awaitingReview: 0,
            returnedReviews: 0,
            todaysPriorities: 0,
            recentActivity: 0
          },
          priorityOrder: [
            {
              key: "needsAssignment",
              title: "Needs Assignment"
            }
          ],
          nextSection: {
            key: "needsAssignment",
            title: "Needs Assignment"
          },
          totalActionItems: 6,
          requiresAttention: true,
          isEmpty: false
        });

      navigateTo("assigner-workbench");

      dashboardService.getWorkbench =
        original;
    });

    await expect(
      page.getByTestId(
        "workbench-needs-assignment-item"
      )
    ).toHaveCount(5);

    await expect(
      page.getByTestId(
        "workbench-needs-assignment-view-all"
      )
    ).toHaveText("View all 6");
  });

  test("view all preserves the existing queue destination", async ({
    page
  }) => {
    await page.evaluate(() => {
      const original =
        dashboardService.getWorkbench;

      dashboardService.getWorkbench =
        () => ({
          sections: {
            needsAssignment:
              Array.from(
                { length: 6 },
                (_, index) => ({
                  id: `game-${index}`,
                  matchup:
                    `Visitors ${index} @ Home ${index}`
                })
              ),
            pendingClaims: [],
            awaitingReview: [],
            returnedReviews: [],
            todaysPriorities: [],
            recentActivity: []
          },
          counts: {
            needsAssignment: 6,
            pendingClaims: 0,
            awaitingReview: 0,
            returnedReviews: 0,
            todaysPriorities: 0,
            recentActivity: 0
          },
          priorityOrder: [],
          nextSection: {
            key: "needsAssignment",
            title: "Needs Assignment"
          },
          totalActionItems: 6,
          requiresAttention: true,
          isEmpty: false
        });

      navigateTo("assigner-workbench");

      dashboardService.getWorkbench =
        original;
    });

    await page
      .getByTestId(
        "workbench-needs-assignment-view-all"
      )
      .click();

    const state = await page.evaluate(() => ({
      page: currentPage,
      context: currentPageContext
    }));

    expect(state.page).toBe("schedule");

    expect(state.context).toEqual(
      expect.objectContaining({
        filter: "open"
      })
    );
  });
});
