
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

  test("daily brief opens Operations", async ({
    app
  }) => {
    await app.page.evaluate(() => {
      renderPage("dashboard");
    });

    await app.page
      .getByTestId(
        "dashboard-open-operations"
      )
      .click();

    await expect(
      app.page.locator("body")
    ).toHaveAttribute(
      "data-page",
      "operations-center"
    );
  });

  test("daily brief metrics open the intended Operations queue", async ({
    app
  }) => {
    const drilldowns = [
      {
        metric: "open-assignments",
        queue: "assignments",
        label: "Assignments"
      },
      {
        metric: "pending-claims",
        queue: "claims",
        label: "Claims"
      },
      {
        metric: "pending-reviews",
        queue: "reviews",
        label: "Reviews"
      },
      {
        metric: "pending-accounts",
        queue: "accounts",
        label: "Accounts"
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

      await expect(
        app.page.getByTestId(
          `operations-queue-${drilldown.queue}`
        )
      ).toHaveAttribute(
        "aria-pressed",
        "true"
      );

      await expect(
        app.page.getByTestId(
          "operations-active-queue-label"
        )
      ).toHaveText(drilldown.label);
    }
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
