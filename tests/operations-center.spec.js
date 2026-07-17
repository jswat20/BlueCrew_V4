import {
  expect,
  test
} from "@playwright/test";

test.describe("Operations Center", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("returns one presentation-ready service object", async ({
    page
  }) => {
    const result = await page.evaluate(() =>
      dashboardService.getOperationsCenter()
    );

    expect(result).toEqual(
      expect.objectContaining({
        currentTask:
          expect.anything(),
        remainingTasks:
          expect.any(Array),
        queueCounts:
          expect.any(Object),
        recentActivity:
          expect.any(Array),
        operationalProgress:
          expect.any(Object),
        outstandingCount:
          expect.any(Number),
        isEmpty:
          expect.any(Boolean)
      })
    );

    expect(
      JSON.stringify(result)
    ).not.toContain("<section");
  });

  test("selects the highest-priority outstanding task", async ({
    page
  }) => {
    const result = await page.evaluate(() => {
      const workbench =
        dashboardService.getWorkbench();

      const operations =
        dashboardService
          .getOperationsCenter();

      const expected =
        workbench.priorityOrder.find(
          section =>
            workbench.counts[
              section.key
            ] > 0
        ) || null;

      return {
        currentKey:
          operations.currentTask?.key ||
          null,
        expectedKey:
          expected?.key || null
      };
    });

    expect(result.currentKey)
      .toBe(result.expectedKey);
  });

  test("remaining tasks preserve deterministic priority order", async ({
    page
  }) => {
    const result = await page.evaluate(() => {
      const workbench =
        dashboardService.getWorkbench();

      const operations =
        dashboardService
          .getOperationsCenter();

      return {
        actual:
          operations.remainingTasks
            .map(task => task.key),

        expected:
          workbench.priorityOrder
            .filter(
              section =>
                workbench.counts[
                  section.key
                ] > 0
            )
            .slice(1)
            .map(section => section.key)
      };
    });

    expect(result.actual)
      .toEqual(result.expected);
  });

  test("renders queue summaries, progress, and recent activity", async ({
    page
  }) => {
    await page.evaluate(() => {
      renderPage("operations-center");
    });

    await expect(
      page.getByTestId(
        "operations-center"
      )
    ).toBeVisible();

    await expect(
      page.getByTestId(
        "operations-current-task"
      )
    ).toBeVisible();

    await expect(
      page.getByTestId(
        "operations-remaining-tasks"
      )
    ).toBeVisible();

    await expect(
      page.getByTestId(
        "operations-queue-summary"
      )
    ).toHaveCount(0);

    await expect(
      page.getByTestId(
        "operations-progress"
      )
    ).toBeVisible();

    await expect(
      page.getByTestId(
        "operations-recent-activity"
      )
    ).toBeVisible();
  });

  test("current task navigates through the existing workflow action", async ({
    page
  }) => {
    await page.evaluate(() => {
      const original =
        dashboardService
          .getOperationsCenter;

      dashboardService
        .getOperationsCenter = () => ({
          currentTask: {
            key: "needsAssignment",
            title: "Needs Assignment",
            count: 1,
            action: "needs-assignment",
            items: [
              {
                id:
                  "operations-game-1",
                gameId:
                  "operations-game-1",
                matchup:
                  "Visitors @ Home"
              }
            ]
          },
          remainingTasks: [],
          queueCounts: {
            needsAssignment: 1,
            pendingClaims: 0,
            awaitingReview: 0,
            returnedReviews: 0,
            todaysPriorities: 0
          },
          recentActivity: [],
          operationalProgress: {
            completed: 4,
            total: 5,
            percent: 80
          },
          outstandingCount: 1,
          isEmpty: false
        });

      renderPage("operations-center");

      dashboardService
        .getOperationsCenter =
        original;
    });

    await page
      .getByTestId(
        "operations-current-task-action"
      )
      .click();

    const state =
      await page.evaluate(() => ({
        page: currentPage,
        context: currentPageContext
      }));

    expect(state.page)
      .toBe("schedule");

    expect(state.context)
      .toEqual(
        expect.objectContaining({
          filter: "open",
          gameId:
            "operations-game-1"
        })
      );
  });

  test("renders the completed-work empty state", async ({
    page
  }) => {
    await page.evaluate(() => {
      const original =
        dashboardService
          .getOperationsCenter;

      dashboardService
        .getOperationsCenter = () => ({
          currentTask: null,
          remainingTasks: [],
          queueCounts: {
            needsAssignment: 0,
            pendingClaims: 0,
            awaitingReview: 0,
            returnedReviews: 0,
            todaysPriorities: 0
          },
          recentActivity: [],
          operationalProgress: {
            completed: 5,
            total: 5,
            percent: 100
          },
          outstandingCount: 0,
          isEmpty: true
        });

      renderPage("operations-center");

      dashboardService
        .getOperationsCenter =
        original;
    });

    await expect(
      page.getByTestId(
        "operations-center-empty"
      )
    ).toBeVisible();
  });

  test("refresh hook rerenders when active", async ({
    page
  }) => {
    await page.evaluate(() => {
      renderPage("operations-center");
      window.refreshOperationsCenterIfActive();
    });

    await expect(
      page.getByTestId(
        "operations-center"
      )
    ).toBeVisible();
  });

  test("is restricted to administrator and assigner roles", async ({
    page
  }) => {
    const access =
      await page.evaluate(() => ({
        administrator:
          authorizationService.canView(
            "operations-center",
            "administrator"
          ),
        assigner:
          authorizationService.canView(
            "operations-center",
            "assigner"
          ),
        umpire:
          authorizationService.canView(
            "operations-center",
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
