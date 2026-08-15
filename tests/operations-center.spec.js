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

    expect(result.currentTask === null || typeof result.currentTask === "object").toBe(true);
    for (const value of [result.queueCounts.all, result.outstandingCount, result.totalOutstandingCount, result.queueCounts.conflicts]) {
      expect(Number.isFinite(value)).toBe(true);
    }

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
        "operations-status-strip"
      )
    ).toBeVisible();

    await expect(
      page.getByTestId(
        "operations-upcoming-work"
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

  test("open-position KPI navigates through the current staffing workflow", async ({
    page
  }) => {
    await page.evaluate(() => renderPage("operations-center"));

    await page
      .getByTestId(
        "operations-metric-open-positions"
      )
      .click();

    const state =
      await page.evaluate(() => ({
        page: currentPage,
        context: currentPageContext
      }));

    expect(state.page)
      .toBe("assigner-workbench");
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
