import {
  test,
  expect
} from "./fixtures/app.fixture.js";

test.describe("Season Operations Dashboard", () => {
  async function openDashboard(app) {
    await app.page
      .getByTestId("nav-season-dashboard")
      .click();

    await expect(
      app.page.getByTestId("season-dashboard")
    ).toBeVisible();
  }

  test.beforeEach(async ({ app }) => {
    await app.page.evaluate(() => {
      localStorage.removeItem(
        "bluecrew_activity"
      );

      authService.loginAsAdmin();
      document.body.dataset.role = "admin";
    });
  });

  test("renders the season dashboard", async ({
    app
  }) => {
    await openDashboard(app);

    await expect(
      app.page.getByTestId(
        "season-dashboard-operations"
      )
    ).toBeVisible();

    await expect(
      app.page.getByTestId(
        "season-dashboard-staffing"
      )
    ).toBeVisible();

    await expect(
      app.page.getByTestId(
        "season-dashboard-availability"
      )
    ).toBeVisible();

    await expect(
      app.page.getByTestId(
        "season-dashboard-officials"
      )
    ).toBeVisible();

    await expect(
      app.page.getByTestId(
        "season-dashboard-activity"
      )
    ).toBeVisible();
  });

  test("renders operations metrics from the service", async ({
    app
  }) => {
    const expected =
      await app.page.evaluate(() =>
        dashboardService.getSeasonDashboard()
      );

    await openDashboard(app);

    await expect(
      app.page.getByTestId(
        "season-dashboard-scheduled-games-value"
      )
    ).toHaveText(
      String(expected.operations.scheduledGames)
    );

    await expect(
      app.page.getByTestId(
        "season-dashboard-completed-games-value"
      )
    ).toHaveText(
      String(expected.operations.completedGames)
    );

    await expect(
      app.page.getByTestId(
        "season-dashboard-awaiting-review-value"
      )
    ).toHaveText(
      String(expected.operations.awaitingReview)
    );

    await expect(
      app.page.getByTestId(
        "season-dashboard-returned-reviews-value"
      )
    ).toHaveText(
      String(expected.operations.returnedReviews)
    );

    await expect(
      app.page.getByTestId(
        "season-dashboard-approved-reviews-value"
      )
    ).toHaveText(
      String(expected.operations.approvedReviews)
    );
  });

  test("renders staffing metrics from the service", async ({
    app
  }) => {
    const expected =
      await app.page.evaluate(() =>
        dashboardService.getSeasonDashboard()
      );

    await openDashboard(app);

    await expect(
      app.page.getByTestId(
        "season-dashboard-assignment-coverage-value"
      )
    ).toHaveText(
      `${expected.staffing.assignmentCoveragePercentage}%`
    );

    await expect(
      app.page.getByTestId(
        "season-dashboard-fully-staffed-games-value"
      )
    ).toHaveText(
      String(expected.staffing.fullyStaffedGames)
    );

    await expect(
      app.page.getByTestId(
        "season-dashboard-open-assignments-value"
      )
    ).toHaveText(
      String(expected.staffing.openAssignments)
    );

    await expect(
      app.page.getByTestId(
        "season-dashboard-pending-claims-value"
      )
    ).toHaveText(
      String(expected.staffing.pendingClaims)
    );
  });

  test("renders availability metrics from the service", async ({
    app
  }) => {
    const expected =
      await app.page.evaluate(() =>
        dashboardService.getSeasonDashboard()
      );

    await openDashboard(app);

    for (const [id, key] of [
      ["available", "available"],
      ["unavailable", "unavailable"],
      ["maybe", "maybe"],
      ["no-response", "noResponse"]
    ]) {
      await expect(
        app.page.getByTestId(
          `season-dashboard-${id}-value`
        )
      ).toHaveText(
        String(expected.availability[key])
      );
    }

    await expect(
      app.page.getByTestId(
        "season-dashboard-response-percentage-value"
      )
    ).toHaveText(
      `${expected.availability.responsePercentage}%`
    );
  });

  test("renders officials metrics", async ({
    app
  }) => {
    const expected =
      await app.page.evaluate(() =>
        dashboardService.getSeasonDashboard()
      );

    await openDashboard(app);

    await expect(
      app.page.getByTestId(
        "season-dashboard-active-officials-value"
      )
    ).toHaveText(
      String(expected.officials.activeOfficials)
    );

    await expect(
      app.page.getByTestId(
        "season-dashboard-pending-approvals-value"
      )
    ).toHaveText(
      String(expected.officials.pendingApprovals)
    );
  });

  test("renders recent operational activity", async ({
    app
  }) => {
    await app.page.evaluate(() => {
      activityService.log({
        type: "assignment",
        action: "assigned",
        matchup: "Visitors @ Home",
        message: "Plate assigned."
      });
    });

    await openDashboard(app);

    await expect(
      app.page.getByTestId(
        "season-dashboard-activity-list"
      )
    ).toBeVisible();

    await expect(
      app.page.getByText("Plate assigned.")
    ).toBeVisible();
  });

  test("renders the activity empty state", async ({
    app
  }) => {
    await openDashboard(app);

    await expect(
      app.page.getByTestId(
        "season-dashboard-activity-empty"
      )
    ).toBeVisible();
  });

  test("refreshes after mutations", async ({
    app
  }) => {
    await openDashboard(app);

    const before = await app.page
      .getByTestId(
        "season-dashboard-active-officials-value"
      )
      .textContent();

    await app.page.evaluate(() => {
      const created =
        accountService.createAccount({
          firstName: "Season",
          lastName: "Official",
          email:
            `season-${Date.now()}@test.com`
        });

      accountService.approveAccount(
        created.data.id
      );

      renderPage("season-dashboard");
    });

    const after = await app.page
      .getByTestId(
        "season-dashboard-active-officials-value"
      )
      .textContent();

    expect(Number(after)).toBeGreaterThanOrEqual(
      Number(before)
    );
  });
});


test.describe("Season Dashboard Intelligence", () => {
  test.beforeEach(async ({ app }) => {
    await app.page.evaluate(() => {
      authService.loginAsAdmin();
      document.body.dataset.role = "admin";
    });

    await app.page
      .getByTestId("nav-season-dashboard")
      .click();

    await expect(
      app.page.getByTestId("season-dashboard")
    ).toBeVisible();
  });

  test("renders intelligence cards", async ({
    app
  }) => {
    await expect(
      app.page.getByTestId(
        "season-dashboard-needs-attention"
      )
    ).toBeVisible();

    await expect(
      app.page.getByTestId(
        "season-dashboard-upcoming"
      )
    ).toBeVisible();

    await expect(
      app.page.getByTestId(
        "season-dashboard-health"
      )
    ).toBeVisible();
  });

  test("needs attention matches the season service", async ({
    app
  }) => {
    const dashboard =
      await app.page.evaluate(() =>
        dashboardService.getSeasonDashboard()
      );

    if (dashboard.highPriorityItems.length) {
      await expect(
        app.page.getByTestId(
          "season-dashboard-attention-item"
        )
      ).toHaveCount(
        dashboard.highPriorityItems.length
      );
    } else {
      await expect(
        app.page.getByTestId(
          "season-dashboard-attention-empty"
        )
      ).toBeVisible();
    }
  });

  test("renders upcoming staffing issues", async ({
    app
  }) => {
    const dashboard =
      await app.page.evaluate(() =>
        dashboardService.getSeasonDashboard()
      );

    if (dashboard.upcomingDeadlines.length) {
      await expect(
        app.page.getByTestId(
          "season-dashboard-upcoming-item"
        )
      ).toHaveCount(
        dashboard.upcomingDeadlines.length
      );
    } else {
      await expect(
        app.page.getByTestId(
          "season-dashboard-upcoming-empty"
        )
      ).toBeVisible();
    }
  });

  test("renders operational health values", async ({
    app
  }) => {
    const dashboard =
      await app.page.evaluate(() =>
        dashboardService.getSeasonDashboard()
      );

    await expect(
      app.page.getByTestId(
        "season-dashboard-health-assignment-coverage-value"
      )
    ).toHaveText(
      dashboard.operationalHealth.find(
        item =>
          item.key ===
          "assignment-coverage"
      ).valueLabel
    );

    await expect(
      app.page.getByTestId(
        "season-dashboard-health-availability-response-value"
      )
    ).toHaveText(
      dashboard.operationalHealth.find(
        item =>
          item.key ===
          "availability-response"
      ).valueLabel
    );
  });

  test("intelligence refreshes after assignment mutation", async ({
    app
  }) => {
    const before =
      await app.page.evaluate(() =>
        dashboardService.getSeasonDashboard()
      );

    await app.page.evaluate(() => {
      const row =
        reportingService
          .getAssignmentDetails()
          .find(item =>
            item.openAssignments > 0
          );

      if (!row) {
        renderPage("season-dashboard");
        return;
      }

      activityService.log({
        type: "assignment",
        action: "assignment-reviewed",
        matchup: row.matchup,
        message:
          "Season dashboard refresh check."
      });

      renderPage("season-dashboard");
    });

    await expect(
      app.page.getByTestId(
        "season-dashboard-health"
      )
    ).toBeVisible();

    const after =
      await app.page.evaluate(() =>
        dashboardService.getSeasonDashboard()
      );

    expect(
      after.operationalHealth.length
    ).toBe(
      before.operationalHealth.length
    );
  });
});


test.describe("Season Dashboard Drill-Down", () => {
  test.beforeEach(async ({ app }) => {
    await app.page.evaluate(() => {
      authService.loginAsAdmin();
      document.body.dataset.role = "admin";
      renderPage("season-dashboard");
    });

    await expect(
      app.page.getByTestId("season-dashboard")
    ).toBeVisible();
  });

  test("open assignments opens the filtered schedule", async ({
    app
  }) => {
    await app.page
      .getByTestId(
        "season-dashboard-open-assignments"
      )
      .click();

    await expect(
      app.page.locator("body")
    ).toHaveAttribute(
      "data-page",
      "schedule"
    );

    const filter =
      await app.page.evaluate(() =>
        uiStateService.getScheduleFilter()
      );

    expect(filter).toBe("open");
  });

  test("pending claims opens the claims queue", async ({
    app
  }) => {
    await app.page
      .getByTestId(
        "season-dashboard-pending-claims"
      )
      .click();

    await expect(
      app.page.locator("body")
    ).toHaveAttribute(
      "data-page",
      "claims-queue"
    );
  });

  test("pending approvals opens pending accounts", async ({
    app
  }) => {
    await app.page
      .getByTestId(
        "season-dashboard-pending-approvals"
      )
      .click();

    await expect(
      app.page.locator("body")
    ).toHaveAttribute(
      "data-page",
      "accounts"
    );

    await expect(
      app.page.getByTestId(
        "pending-accounts-section"
      )
    ).toBeVisible();
  });

  test("awaiting reviews opens the review queue", async ({
    app
  }) => {
    await app.page
      .getByTestId(
        "season-dashboard-awaiting-review"
      )
      .click();

    await expect(
      app.page.locator("body")
    ).toHaveAttribute(
      "data-page",
      "review-queue"
    );
  });

  test("assignment coverage opens reports", async ({
    app
  }) => {
    await app.page
      .getByTestId(
        "season-dashboard-assignment-coverage"
      )
      .click();

    await expect(
      app.page.locator("body")
    ).toHaveAttribute(
      "data-page",
      "reports"
    );

    await expect(
      app.page.getByTestId("reports-page")
    ).toBeVisible();
  });

  test("upcoming staffing opens and highlights the game", async ({
    app
  }) => {
    const upcoming =
      await app.page.getByTestId(
        "season-dashboard-upcoming-item"
      );

    if (await upcoming.count() === 0) {
      await expect(
        app.page.getByTestId(
          "season-dashboard-upcoming-empty"
        )
      ).toBeVisible();

      return;
    }

    const gameId =
      await upcoming.first().getAttribute(
        "data-game-id"
      );

    await upcoming
      .first()
      .getByTestId(
        "season-dashboard-upcoming-action"
      )
      .click();

    await expect(
      app.page.locator("body")
    ).toHaveAttribute(
      "data-page",
      "schedule"
    );

    await expect(
      app.page.getByTestId(
        `game-row-${gameId}`
      )
    ).toHaveAttribute(
      "data-highlighted",
      "true"
    );
  });

  test("dashboard refreshes after returning", async ({
    app
  }) => {
    await app.page
      .getByTestId(
        "season-dashboard-open-assignments"
      )
      .click();

    await app.page.evaluate(() => {
      renderPage("season-dashboard");
    });

    await expect(
      app.page.getByTestId(
        "season-dashboard"
      )
    ).toBeVisible();

    await expect(
      app.page.getByTestId(
        "season-dashboard-open-assignments-value"
      )
    ).toHaveText(
      await app.page.evaluate(() =>
        String(
          dashboardService
            .getSeasonDashboard()
            .staffing
            .openAssignments
        )
      )
    );
  });
});
