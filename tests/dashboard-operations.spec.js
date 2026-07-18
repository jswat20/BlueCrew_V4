
import {
  test,
  expect
} from "./fixtures/app.fixture.js";

test.describe("Dashboard Entry Experience", () => {
  async function resetDashboardData(page) {
    await page.evaluate(() => {
      games = [];
      saveGames();

      localStorage.removeItem(
        "bluecrew_accounts"
      );

      localStorage.removeItem(
        "bluecrew_notifications"
      );

      localStorage.removeItem(
        "bluecrew_activity"
      );

      uiStateService.clearSelections();
      authService.loginAsAdmin();

      document.body.dataset.role =
        "admin";

      if (window.BlueCrew?.test) {
        window.BlueCrew.test.currentRole =
          "admin";
      }
    });
  }

  async function createGame(
    page,
    overrides = {}
  ) {
    return page.evaluate(
      gameOverrides => {
        const today =
          new Date()
            .toISOString()
            .split("T")[0];

        return gameService.create({
          date: today,
          time: "6:00 PM",
          field: "Dashboard Field",
          level: "12U",
          homeTeam: "Dashboard Home",
          awayTeam: "Dashboard Away",
          gameType: "single",
          ...gameOverrides
        }).data;
      },
      overrides
    );
  }

  test.beforeEach(async ({ app }) => {
    await resetDashboardData(app.page);
  });

  test("renders the entry dashboard sections", async ({
    app
  }) => {
    await app.page.evaluate(() => {
      renderPage("dashboard");
    });

    await expect(
      app.page.getByTestId(
        "operations-dashboard"
      )
    ).toBeVisible();

    await expect(
      app.page.getByTestId(
        "dashboard-welcome"
      )
    ).toBeVisible();

    await expect(
      app.page.getByTestId(
        "operations-summary"
      )
    ).toBeVisible();

    await expect(
      app.page.getByTestId(
        "dashboard-today-games"
      )
    ).toBeVisible();

    await expect(
      app.page.getByTestId(
        "dashboard-notification-bell"
      )
    ).toBeVisible();

    await expect(
      app.page.getByTestId(
        "dashboard-assignment-activity"
      )
    ).toBeVisible();
  });

  test("does not render removed admin cards", async ({
    app
  }) => {
    await app.page.evaluate(() => {
      renderPage("dashboard");
    });

    await expect(
      app.page.getByTestId(
        "dashboard-availability"
      )
    ).toHaveCount(0);

    await expect(
      app.page.getByTestId(
        "dashboard-communication-preferences"
      )
    ).toHaveCount(0);

    await expect(
      app.page.getByTestId(
        "account-role-summary"
      )
    ).toHaveCount(0);

    await expect(
      app.page.getByTestId(
        "dashboard-needs-attention"
      )
    ).toHaveCount(0);
  });

  test("shows only today's games", async ({
    app
  }) => {
    const todayGame =
      await createGame(app.page);

    const futureGame =
      await createGame(
        app.page,
        {
          date: "2099-12-31",
          homeTeam: "Future Home",
          awayTeam: "Future Away"
        }
      );

    await app.page.evaluate(() => {
      renderPage("dashboard");
    });

    await expect(
      app.page.getByTestId(
        `dashboard-today-game-${
          todayGame.id
        }`
      )
    ).toBeVisible();

    await expect(
      app.page.getByTestId(
        `dashboard-today-game-${
          futureGame.id
        }`
      )
    ).toHaveCount(0);
  });

  test("shows today's game count", async ({
    app
  }) => {
    await createGame(app.page);
    await createGame(
      app.page,
      {
        time: "7:30 PM",
        homeTeam: "Second Home",
        awayTeam: "Second Away"
      }
    );

    await app.page.evaluate(() => {
      renderPage("dashboard");
    });

    await expect(
      app.page.getByTestId(
        "dashboard-summary-today-games-value"
      )
    ).toHaveText("2");
  });

  test("shows open assignment count", async ({
    app
  }) => {
    await createGame(app.page);

    await app.page.evaluate(() => {
      renderPage("dashboard");
    });

    await expect(
      app.page.getByTestId(
        "dashboard-summary-open-assignments-value"
      )
    ).toHaveText("1");
  });

  test("uses teal command metrics while preserving active edge highlights", async ({ app }) => {
    await createGame(app.page);

    await app.page.evaluate(() => {
      renderPage("dashboard");
    });

    const openPositions = app.page.getByTestId(
      "dashboard-summary-open-assignments"
    );
    const todayGames = app.page.getByTestId(
      "dashboard-summary-today-games"
    );

    await expect(openPositions).toHaveClass(/dashboard-brief-metric-priority/);
    await expect(openPositions).toHaveAttribute("data-attention", "true");
    await expect(todayGames).toHaveClass(/dashboard-brief-metric-context/);

    const visualState = await openPositions.evaluate(element => ({
      backgroundImage: getComputedStyle(element).backgroundImage,
      boxShadow: getComputedStyle(element).boxShadow
    }));
    expect(visualState.backgroundImage).toContain("linear-gradient");
    expect(visualState.boxShadow).toContain("rgb(255, 103, 92)");
  });

  test("uses single-line greeting and Daily Brief headings without a redundant action", async ({
    app
  }) => {
    await app.page.evaluate(() => {
      renderPage("dashboard");
    });

    await expect(app.page.getByTestId("dashboard-welcome-name")).toContainText(/Good (morning|afternoon|evening), Administrator/);
    await expect(app.page.getByRole("heading", { name: "The Daily Brief - Today At A Glance" })).toBeVisible();
    await expect(app.page.getByTestId("dashboard-open-operations")).toHaveCount(0);
    await expect(app.page.getByTestId("dashboard-summary-today-games")).toContainText("Games Today");
    await expect(app.page.getByTestId("dashboard-summary-open-assignments")).toContainText("Open Positions");
  });

  test("daily brief metrics open the intended Operations queue", async ({
    app
  }) => {
    const drilldowns = [
      {
        metric: "pending-claims",
        queue: "claims",
        dialog: "pending-claims"
      },
      {
        metric: "pending-reviews",
        queue: "reviews",
        dialog: "reviews"
      },
      {
        metric: "pending-accounts",
        queue: "accounts",
        dialog: "pending-accounts"
      }
    ];

    for (const drilldown of drilldowns) {
      await app.page.evaluate(() => {
        renderPage("dashboard");
      });

      await app.page
        .getByTestId(
          `dashboard-summary-${drilldown.metric}`
        )
        .click();

      await expect(app.page.locator("body")).toHaveAttribute(
        "data-page",
        "operations-center"
      );

      await expect(
        app.page.getByTestId("operations-recent-activity")
      ).toHaveAttribute("data-active-queue", drilldown.queue);

      await expect(
        app.page.getByTestId(`operations-detail-${drilldown.dialog}`)
      ).toBeVisible();
    }
  });

  test("Open Positions opens a focused editable Workbench list", async ({ app }) => {
    const game = await createGame(app.page);
    await app.page.evaluate(() => renderPage("dashboard"));

    await app.page.getByTestId("dashboard-summary-open-assignments").click();

    await expect(app.page.locator("body")).toHaveAttribute("data-page", "assigner-workbench");
    await expect(app.page.getByTestId("workbench-open-positions-focus")).toBeVisible();
    await expect(app.page.getByTestId(`workbench-open-game-${game.id}`)).toBeVisible();
    await expect(app.page.getByTestId(`workbench-manage-crew-${game.id}`)).toBeVisible();
  });

  test("today games opens the Schedule", async ({
    app
  }) => {
    await app.page.evaluate(() => {
      renderPage("dashboard");
    });

    await app.page
      .getByTestId(
        "dashboard-summary-today-games"
      )
      .click();

    await expect(
      app.page.locator("body")
    ).toHaveAttribute(
      "data-page",
      "schedule"
    );

    await expect(app.page.getByTestId("view-all-games")).toHaveClass(/active/);
    await expect(app.page.getByTestId("schedule-filter-today")).toHaveAttribute("aria-pressed", "true");
  });

  test("notification bell opens Notifications", async ({
    app
  }) => {
    await app.page.evaluate(() => {
      renderPage("dashboard");
    });

    await app.page
      .getByTestId(
        "dashboard-notification-bell"
      )
      .click();

    await expect(
      app.page.locator("body")
    ).toHaveAttribute(
      "data-page",
      "notifications"
    );
  });
});
