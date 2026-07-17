import { test, expect } from "@playwright/test";

test.describe("Operations Center redesign", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      authService.loginAsAdmin();
      document.body.dataset.role = "admin";
      operationsCenterActivityVisibleCount = 4;
      renderPage("operations-center");
    });
  });

  test("status strip uses reliable role-aware metrics", async ({ page }) => {
    await expect(page.getByTestId("operations-status-strip")).toBeVisible();
    await expect(page.getByTestId("operations-metric-events-today")).toBeVisible();
    await expect(page.getByTestId("operations-metric-open-positions")).toBeVisible();
    await expect(page.getByTestId("operations-metric-pending-accounts")).toBeVisible();

    await page.evaluate(() => {
      authService.loginAsAssigner();
      document.body.dataset.role = "assigner";
      renderPage("operations-center");
    });

    await expect(page.getByTestId("operations-metric-pending-accounts")).toHaveCount(0);
  });

  test("action metric counts use alert emphasis only when active", async ({ page }) => {
    for (const id of ["open-positions", "pending-claims", "reviews", "pending-accounts", "active-alerts"]) {
      const metric = page.getByTestId(`operations-metric-${id}`);
      if (await metric.count() === 0) continue;
      const value = Number(await metric.locator("strong").textContent());
      await expect(metric).toHaveAttribute("data-attention", value > 0 ? "true" : "false");
      if (value > 0) await expect(metric.locator("strong")).toHaveCSS("color", "rgb(180, 35, 24)");
    }
  });

  test("operational periods retain channel-level readiness counts", async ({ page }) => {
    const today = page.getByTestId("operations-period-today");
    await expect(today).toContainText("Assignments");
    await expect(today).toContainText("Claims");
    await expect(today).toContainText("Reviews");
    await expect(today).toContainText("Accounts");
    await expect(today).toContainText("Conflicts");
  });

  test("events today opens the schedule daily view for today", async ({ page }) => {
    await page.getByTestId("operations-metric-events-today").click();

    await expect(page.locator("body")).toHaveAttribute("data-page", "schedule");
    await expect(page.getByTestId("view-daily")).toHaveClass(/active/);
    await expect.poll(() => page.evaluate(() => currentScheduleDate)).toBe(
      new Date().toISOString().split("T")[0]
    );
  });

  test("staffing metrics open the assigner workbench", async ({ page }) => {
    const metric = page.getByTestId("operations-metric-open-positions");
    await metric.focus();
    await page.keyboard.press("Enter");

    await expect(page.locator("body")).toHaveAttribute("data-page", "assigner-workbench");

    await page.evaluate(() => renderPage("operations-center"));
    await page.getByTestId("operations-metric-fully-staffed").click();
    await expect(page.locator("body")).toHaveAttribute("data-page", "assigner-workbench");
  });

  test("pending metrics open focused action dialogs", async ({ page }) => {
    await page.getByTestId("operations-metric-pending-claims").click();
    const claimsDialog = page.getByTestId("operations-detail-pending-claims");
    await expect(claimsDialog).toBeVisible();
    await expect(claimsDialog).toHaveAttribute("open", "");
    if (await claimsDialog.getByRole("button", { name: "Review" }).count()) {
      await expect(claimsDialog.getByRole("button", { name: "Approve" }).first()).toBeVisible();
      await expect(claimsDialog.getByRole("button", { name: "Deny" }).first()).toBeVisible();
    }
    await claimsDialog.getByRole("button", { name: /close pending claims/i }).click();
    await expect(claimsDialog).not.toBeVisible();

    await page.getByTestId("operations-metric-pending-accounts").click();
    const accountsDialog = page.getByTestId("operations-detail-pending-accounts");
    await expect(accountsDialog).toBeVisible();
    if (await accountsDialog.getByRole("button", { name: "Review" }).count()) {
      await expect(accountsDialog.getByRole("button", { name: "Approve" }).first()).toBeVisible();
      await expect(accountsDialog.getByRole("button", { name: "Deny" }).first()).toBeVisible();
    }
  });

  test("pending account decisions complete inside the dialog", async ({ page }) => {
    const accountId = await page.evaluate(() => {
      const created = accountService.createAccount({
        firstName: "Operations",
        lastName: "Approval",
        email: `operations-approval-${Date.now()}@example.com`
      });
      renderPage("operations-center");
      return created.data.id;
    });

    await page.getByTestId("operations-metric-pending-accounts").click();
    const dialog = page.getByTestId("operations-detail-pending-accounts");
    await dialog.locator(
      `[data-operations-quick-action="approve-account"][data-operations-payload*="${accountId}"]`
    ).click();

    await expect.poll(() => page.evaluate(id => accountService.getById(id)?.status, accountId)).toBe("approved");
    await expect(page.getByTestId("operations-action-message")).toContainText("Account approved");
  });

  test("legacy workflow telemetry is not visually exposed", async ({ page }) => {
    await expect(page.getByTestId("operations-workflow-current-queue")).not.toBeVisible();
    await expect(page.getByTestId("operations-workflow-outstanding")).not.toBeVisible();
  });

  test("system health is informational without duplicate queue controls", async ({ page }) => {
    await expect(page.getByTestId("operations-progress")).toBeVisible();
    await expect(page.getByTestId("operations-queue-summary")).toHaveCount(0);
  });

  test("attention queue has an intentional healthy empty state", async ({ page }) => {
    await page.evaluate(() => {
      const original = dashboardService.getOperationsCenter;
      dashboardService.getOperationsCenter = () => ({
        activeQueue: "all",
        queues: [],
        activeTasks: [],
        activeWorkItems: [],
        currentTask: null,
        remainingTasks: [],
        queueCounts: { all: 0 },
        statusMetrics: [],
        upcomingWork: [],
        recentActivity: [],
        operationalProgress: { completed: 5, total: 5, percent: 100 },
        outstandingCount: 0,
        totalOutstandingCount: 0,
        isEmpty: true
      });
      renderPage("operations-center");
      dashboardService.getOperationsCenter = original;
    });

    await expect(page.getByTestId("operations-center-empty")).toBeVisible();
    await expect(page.getByTestId("operations-work-deck")).toHaveCount(0);
    await expect(page.getByTestId("operations-upcoming-work")).toBeVisible();
  });

  test("upcoming games open the existing game administration hub", async ({ page }) => {
    const event = page.getByTestId("operations-upcoming-event").first();
    test.skip(await event.count() === 0, "No seeded upcoming game is available.");
    await event.click();
    await expect(page.locator("body")).toHaveAttribute("data-page", "game-hub");
    await expect(page.getByTestId("game-hub-empty")).toHaveCount(0);
    await expect(page.getByTestId("game-hub-summary")).toBeVisible();
  });

  test("Operations Log is newest first with exact timestamps", async ({ page }) => {
    await page.evaluate(() => {
      localStorage.removeItem("bluecrew_activity");
      activityService.log({ id: "older", type: "assignment", action: "assigned", message: "Older action", createdAt: "2026-07-17T12:00:00.000Z" });
      activityService.log({ id: "newer", type: "review", action: "submitted", message: "Newer action", createdAt: "2026-07-17T13:00:00.000Z" });
      renderPage("operations-center");
    });

    const rows = page.getByTestId("operations-activity-item");
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toHaveAttribute("data-activity-id", "newer");
    await expect(rows.first().locator("time")).toHaveAttribute("title", /Jul/);
    await expect(rows.first()).toHaveAttribute("data-activity-category", "Reviews");
  });

  test("Operations Log reveals history in repeated batches", async ({ page }) => {
    await page.evaluate(() => {
      localStorage.removeItem("bluecrew_activity");
      for (let index = 0; index < 20; index += 1) {
        activityService.log({
          id: `activity-${index}`,
          type: "assignment",
          action: "assigned",
          message: `Activity ${index}`,
          createdAt: new Date(Date.UTC(2026, 6, 17, 12, index)).toISOString()
        });
      }
      operationsCenterActivityVisibleCount = 4;
      renderPage("operations-center");
    });

    await expect(page.getByTestId("operations-activity-item")).toHaveCount(4);
    await expect(page.getByTestId("operations-activity-more")).toHaveText("View previous activity (10)");
    await page.getByTestId("operations-activity-more").click();
    await expect(page.getByTestId("operations-activity-item")).toHaveCount(14);
    await expect(page.getByTestId("operations-activity-more")).toHaveText("View previous activity (6)");
    await page.getByTestId("operations-activity-more").click();
    await expect(page.getByTestId("operations-activity-item")).toHaveCount(20);
    await expect(page.getByTestId("operations-activity-more")).toHaveCount(0);
  });

  test("event-related activity rows navigate with keyboard", async ({ page }) => {
    const gameId = await page.evaluate(() => {
      const game = gameService.getAll()[0];
      if (!game) return "";
      localStorage.removeItem("bluecrew_activity");
      activityService.log({ type: "assignment", action: "assigned", gameId: game.id, message: "Assignment changed" });
      renderPage("operations-center");
      return game.id;
    });
    test.skip(!gameId, "No seeded game is available.");

    const row = page.getByTestId("operations-activity-item").first();
    await row.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("body")).toHaveAttribute("data-page", "game-hub");
  });

  test("renders an accessible error state", async ({ page }) => {
    await page.evaluate(() => {
      dashboardService.getOperationsCenter = () => { throw new Error("test failure"); };
      renderPage("operations-center");
    });

    await expect(page.getByTestId("operations-center-error")).toHaveAttribute("role", "alert");
    await expect(page.getByTestId("operations-center-error")).toContainText("No information was changed");
  });

  test("desktop log rows keep aligned columns on one line", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => {
      localStorage.removeItem("bluecrew_activity");
      activityService.log({
        id: "desktop-layout-activity",
        type: "assignment",
        action: "assigned",
        actor: "Layout Tester",
        message: "Assigned event official",
        createdAt: "2026-07-17T14:00:00.000Z"
      });
      renderPage("operations-center");
    });
    const row = page.getByTestId("operations-activity-item").first();

    const layout = await row.evaluate(element => ({
      display: getComputedStyle(element).display,
      columns: getComputedStyle(element).gridTemplateColumns.split(" ").length,
      height: element.getBoundingClientRect().height,
      documentHeight: document.documentElement.scrollHeight,
      viewportHeight: document.documentElement.clientHeight
    }));
    expect(layout.display).toBe("grid");
    expect(layout.columns).toBe(5);
    expect(layout.height).toBeLessThan(70);
    expect(layout.documentHeight).toBeLessThanOrEqual(layout.viewportHeight + 1);
  });
});
