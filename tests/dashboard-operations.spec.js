import { test, expect } from "./fixtures/app.fixture.js";

test.describe("Operations Dashboard", () => {
  async function resetDashboardData(page) {
    await page.evaluate(() => {
      games = [];
      saveGames();

      localStorage.removeItem("bluecrew_accounts");

      uiStateService.clearSelections();
      authService.loginAsAdmin();

      document.body.dataset.role = "admin";

      if (window.BlueCrew?.test) {
        window.BlueCrew.test.currentRole = "admin";
      }
    });
  }

  async function createUpcomingGame(page, overrides = {}) {
    return page.evaluate(gameOverrides => {
      const date = new Date();
      date.setDate(date.getDate() + 1);

      return gameService.create({
        date: date.toISOString().split("T")[0],
        time: "6:00 PM",
        field: "Field 1",
        level: "12U",
        homeTeam: "Dashboard Home",
        awayTeam: "Dashboard Away",
        gameType: "single",
        ...gameOverrides
      }).data;
    }, overrides);
  }

  test.beforeEach(async ({ app }) => {
    await resetDashboardData(app.page);
  });

  test("renders the operations dashboard sections", async ({ app }) => {
    await app.page.evaluate(() => renderPage("dashboard"));

    await expect(
      app.page.getByTestId("operations-dashboard")
    ).toBeVisible();

    await expect(
      app.page.getByTestId("operations-summary")
    ).toBeVisible();

    await expect(
      app.page.getByTestId("dashboard-needs-attention")
    ).toBeVisible();

    await expect(
      app.page.getByTestId("dashboard-upcoming-games")
    ).toBeVisible();
  });

  test("shows upcoming games and open assignment counts", async ({ app }) => {
    const game = await createUpcomingGame(app.page);

    await app.page.evaluate(() => renderPage("dashboard"));

    await expect(
      app.page.getByTestId(
        "dashboard-summary-upcoming-games-value"
      )
    ).toHaveText("1");

    await expect(
      app.page.getByTestId(
        "dashboard-summary-open-assignments-value"
      )
    ).toHaveText("1");

    await expect(
      app.page.getByTestId(`dashboard-upcoming-game-${game.id}`)
    ).toBeVisible();

    await expect(
      app.page.getByTestId(
        "dashboard-attention-open-assignments-count"
      )
    ).toHaveText("1");
  });

  test("counts open assignment slots rather than games", async ({ app }) => {
    await createUpcomingGame(app.page, {
      gameType: "double"
    });

    const count = await app.page.evaluate(() => {
      const game = gameService.getAll()[0];

      game.assignments = [
        {
          id: `${game.id}-plate`,
          position: "Plate",
          crewId: "",
          claimedBy: "",
          status: AssignmentStatus.NEEDS_ASSIGNMENT,
          locked: false
        },
        {
          id: `${game.id}-base`,
          position: "Base",
          crewId: "",
          claimedBy: "",
          status: AssignmentStatus.NEEDS_ASSIGNMENT,
          locked: false
        }
      ];

      saveGames();
      renderPage("dashboard");

      return dashboardService.getOpenAssignments().length;
    });

    expect(count).toBe(2);

    await expect(
      app.page.getByTestId(
        "dashboard-summary-open-assignments-value"
      )
    ).toHaveText("2");
  });

  test("shows pending claims", async ({ app }) => {
    const game = await createUpcomingGame(app.page);

    await app.page.evaluate(gameId => {
      assignmentService.openForClaims(gameId);

      const game = gameService.getById(gameId);
      const assignment = assignmentService.getAssignments(game)[0];

      assignment.claimedBy = "crew-dashboard-test";
      assignment.status = AssignmentStatus.PENDING_APPROVAL;

      saveGames();
      renderPage("dashboard");
    }, game.id);

    await expect(
      app.page.getByTestId(
        "dashboard-summary-pending-claims-value"
      )
    ).toHaveText("1");

    await expect(
      app.page.getByTestId(
        "dashboard-attention-pending-claims-count"
      )
    ).toHaveText("1");
  });

  test("shows pending account approvals", async ({ app }) => {
    await app.page.evaluate(() => {
      accountService.createAccount({
        firstName: "Pending",
        lastName: "Umpire",
        email: "dashboard-pending@example.com"
      });

      renderPage("dashboard");
    });

    await expect(
      app.page.getByTestId(
        "dashboard-summary-pending-accounts-value"
      )
    ).toHaveText("1");

    await expect(
      app.page.getByTestId(
        "dashboard-attention-pending-accounts-count"
      )
    ).toHaveText("1");
  });

  test("open assignments summary navigates to filtered schedule", async ({
    app
  }) => {
    await app.page.evaluate(() => renderPage("dashboard"));

    await app.page
      .getByTestId("dashboard-summary-open-assignments")
      .click();

    await expect(app.page.locator("body")).toHaveAttribute(
      "data-page",
      "schedule"
    );

    const filter = await app.page.evaluate(() =>
      uiStateService.getScheduleFilter()
    );

    expect(filter).toBe("open");
  });

  test("pending claims summary navigates to claims queue", async ({
    app
  }) => {
    await app.page.evaluate(() => renderPage("dashboard"));

    await app.page
      .getByTestId("dashboard-summary-pending-claims")
      .click();

    await expect(app.page.locator("body")).toHaveAttribute(
      "data-page",
      "claims-queue"
    );
  });

  test("pending accounts summary navigates to pending accounts", async ({
  app
}) => {
  await app.page.evaluate(() => renderPage("dashboard"));

  await app.page
    .getByTestId("dashboard-summary-pending-accounts")
    .click();

  await expect(app.page.locator("body")).toHaveAttribute(
    "data-page",
    "accounts"
  );

  const filter = await app.page.evaluate(() =>
    uiStateService.getAccountFilter()
  );

  expect(filter).toBe("pending");
});
test("dashboard exposes account role counts", async ({ page }) => {
  const summary = await page.evaluate(() => {
    localStorage.removeItem("bluecrew_accounts");

    const roles = [
      "administrator",
      "assigner",
      "umpire",
      "umpire"
    ];

    roles.forEach((role, index) => {
      const account = accountService.createAccount({
        firstName: `Dashboard${index}`,
        lastName: "Role",
        email: `dashboard-role-${index}@test.com`
      }).data;

      accountService.updateRole(account.id, role);
    });

    return dashboardService.getRoleSummary();
  });

  expect(summary).toEqual({
    administrator: 1,
    assigner: 1,
    umpire: 2
  });
});
});
