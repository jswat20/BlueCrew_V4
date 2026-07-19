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

  test("status strip and staffing board use larger aligned typography", async ({ page }) => {
    const firstMetric = page.locator(".operations-status-metric").first();
    expect(await firstMetric.locator("span").evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(13);
    expect(await firstMetric.locator("strong").evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(24);

    const tables = page.locator(".operations-staffing-table");
    if (await tables.count() > 1) {
      const starts = await tables.evaluateAll(elements => elements.map(table =>
        [...table.querySelectorAll("th")].slice(0, 4).map(cell => Math.round(cell.getBoundingClientRect().left))
      ));
      expect(starts[1]).toEqual(starts[0]);
    }
  });

  test("uses one dated shell header without a create-event action", async ({ page }) => {
    await expect(page.getByTestId("page-title")).toHaveText(/Operations Center — .+/);
    await expect(page.getByTestId("operations-console-titlebar")).toHaveCount(0);
    await expect(page.getByTestId("operations-primary-action")).toHaveCount(0);
  });

  test("action metric counts use alert emphasis only when active", async ({ page }) => {
    for (const id of ["open-positions", "pending-claims", "reviews", "pending-accounts", "active-alerts"]) {
      const metric = page.getByTestId(`operations-metric-${id}`);
      if (await metric.count() === 0) continue;
      const value = Number(await metric.locator("strong").textContent());
      await expect(metric).toHaveAttribute("data-attention", value > 0 ? "true" : "false");
      if (value > 0) {
        await expect(metric.locator("strong")).toHaveCSS("color", "rgb(255, 255, 255)");
        await expect(metric.locator("strong")).toHaveCSS("-webkit-text-stroke-color", "rgb(180, 35, 24)");
        expect(await metric.evaluate(element => getComputedStyle(element).boxShadow)).toContain("rgb(255, 103, 92)");
      }
    }
  });

  test("uses title-case labels, an explicit staffing ratio, and no context captions", async ({ page }) => {
    const strip = page.getByTestId("operations-status-strip");
    await expect(page.getByTestId("operations-metric-events-today")).toContainText("Events Today");
    const fullyStaffed = page.getByTestId("operations-metric-fully-staffed");
    await expect(fullyStaffed.locator("span")).toHaveText("Fully Staffed");
    await expect(fullyStaffed.locator("strong")).toHaveText(/\d+ of \d+/);
    await expect(strip.locator("small")).toHaveCount(0);
    await expect(strip).not.toContainText("Open work");
    await expect(strip).not.toContainText("Operational context");
    await expect(page.getByTestId("operations-attention-summary")).toHaveCSS("color", "rgb(180, 35, 24)");
  });

  test("attention summary totals every actionable status metric", async ({ page }) => {
    const expected = await page.locator(".operations-status-metric").evaluateAll(metrics =>
      metrics
        .filter(metric => ["open-positions", "pending-claims", "reviews", "pending-accounts", "active-alerts"].includes(metric.dataset.metricId))
        .reduce((total, metric) => total + Number(metric.querySelector("strong")?.textContent || 0), 0)
    );
    await expect(page.getByTestId("operations-attention-summary")).toContainText(`${expected} operational`);
  });

  test("operational periods retain channel-level readiness counts", async ({ page }) => {
    const today = page.getByTestId("operations-period-today");
    await expect(today).toContainText("Assignments");
    await expect(today).toContainText("Claims");
    await expect(today).toContainText("Reviews");
    await expect(today).toContainText("Accounts");
    await expect(today).toContainText("Conflicts");
    const columns = await today.locator(".operations-period-signals").evaluate(
      element => getComputedStyle(element).gridTemplateColumns.split(" ").length
    );
    expect(columns).toBe(1);
    const signals = today.locator(".operations-period-signals > div");
    await expect(signals).toHaveCount(5);
    for (const signal of await signals.all()) {
      await expect(signal).toHaveAttribute("data-status", /healthy|watch|critical/);
      await expect(signal.locator(".operations-status-light")).toHaveCount(1);
    }
  });

  test("places the live feed across the bottom", async ({ page }) => {
    const rail = page.getByTestId("operations-secondary");
    await expect(rail.getByTestId("operations-progress")).toBeVisible();
    await expect(rail.getByTestId("operations-recent-activity")).toHaveCount(0);
    const feed = page.getByTestId("operations-recent-activity");
    await expect(feed).toBeVisible();
    await expect(feed.getByRole("heading", { name: "Live Feed" })).toBeVisible();
    await expect(feed.getByTestId("operations-feed-eyebrow")).toHaveCount(0);
    await expect(feed.getByTestId("operations-feed-title")).toHaveCount(0);
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
    await expect.poll(() => claimsDialog.evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThan(800);
    if (await claimsDialog.getByRole("button", { name: "Review" }).count()) {
      await expect(claimsDialog.getByTestId("operations-claim-requester").first()).toContainText("Requested by:");
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

  test("keeps attention actions in the KPI rail without a duplicate status module", async ({ page }) => {
    await expect(page.getByTestId("operations-requires-attention")).toHaveCount(0);
    await expect(page.getByTestId("operations-metric-pending-claims")).toBeVisible();
    await expect(page.getByTestId("operations-metric-pending-accounts")).toBeVisible();
  });

  test("uses distinct contained modules on the cool operations canvas", async ({ page }) => {
    const schedule = page.getByTestId("operations-upcoming-work");
    const rail = page.getByTestId("operations-secondary");
    const feed = page.getByTestId("operations-recent-activity");

    for (const module of [schedule, rail]) {
      expect(await module.evaluate(element => parseFloat(getComputedStyle(element).borderTopWidth))).toBeGreaterThanOrEqual(1);
    }

    await expect(schedule).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(rail).toHaveCSS("color", "rgb(19, 40, 63)");
    await expect(feed).toHaveCSS("color", "rgb(255, 255, 255)");

    await expect(page.locator(".operations-status-metric-priority").first()).toBeVisible();
    await expect(page.locator(".operations-status-metric-context").first()).toBeVisible();
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
    if (await page.getByTestId("operations-upcoming-event").count() === 0) {
      await page.evaluate(() => {
        gameService.create({
          date: new Date().toISOString().split("T")[0],
          time: "6:30 PM",
          field: "Operations Test Field",
          level: "12U",
          homeTeam: "Home Club",
          awayTeam: "Away Club",
          gameType: "single"
        });
        renderPage("operations-center");
      });
    }

    const events = page.getByTestId("operations-upcoming-event");
    await expect(events).toHaveCount(1);
    const event = events.first();
    await expect(event).toHaveAttribute("role", "link");
    await event.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("body")).toHaveAttribute("data-page", "game-hub");
    await expect(page.getByTestId("game-hub-empty")).toHaveCount(0);
    await expect(page.getByTestId("game-hub-admin-view")).toBeVisible();
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

  test("Operations Log loads the current week and pages by week", async ({ page }) => {
    await page.evaluate(() => {
      localStorage.removeItem("bluecrew_activity");
      for (let index = 0; index < 10; index += 1) {
        activityService.log({
          id: `current-week-${index}`,
          type: "assignment",
          action: "assigned",
          message: `Current activity ${index}`,
          createdAt: new Date(Date.now() - (index + 1) * 60 * 60 * 1000).toISOString()
        });
        activityService.log({
          id: `previous-week-${index}`,
          type: "assignment",
          action: "assigned",
          message: `Previous activity ${index}`,
          createdAt: new Date(Date.now() - (8 * 24 * 60 * 60 * 1000) - index * 60 * 60 * 1000).toISOString()
        });
      }
      operationsCenterActivityWeekOffset = 0;
      renderPage("operations-center");
    });

    await expect(page.getByTestId("operations-activity-item")).toHaveCount(10);
    await expect(page.getByTestId("operations-activity-previous-week")).toBeVisible();
    await page.getByTestId("operations-activity-previous-week").click();
    await expect(page.getByTestId("operations-activity-item")).toHaveCount(10);
    await expect(page.getByTestId("operations-activity-next-week")).toBeVisible();
    await page.getByTestId("operations-activity-next-week").click();
    await expect(page.getByTestId("operations-activity-item")).toHaveCount(10);
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

  test("desktop operational rail stays narrow with readable status text", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const rail = page.getByTestId("operations-secondary");
    const dimensions = await rail.evaluate(element => ({
      width: element.getBoundingClientRect().width,
      labelSize: parseFloat(getComputedStyle(element.querySelector(".operations-period-signals dt")).fontSize),
      summarySize: parseFloat(getComputedStyle(element.querySelector(".operations-period-health-summary span")).fontSize),
      statusGap: element.querySelector(".operations-period-signals dd").getBoundingClientRect().left -
        element.querySelector(".operations-period-signals dt").getBoundingClientRect().right
    }));
    expect(dimensions.width).toBeLessThanOrEqual(332);
    expect(dimensions.labelSize).toBeGreaterThanOrEqual(12.5);
    expect(dimensions.summarySize).toBeGreaterThanOrEqual(11.5);
    expect(dimensions.statusGap).toBeGreaterThanOrEqual(12);

    const periodsFit = await rail.evaluate(element => {
      const periods = [...element.querySelectorAll(".operations-period-health")];
      const railRect = element.getBoundingClientRect();
      return periods.length === 3 && periods.every(period => {
        const rect = period.getBoundingClientRect();
        return rect.top >= railRect.top && rect.bottom <= railRect.bottom + 1;
      });
    });
    expect(periodsFit).toBe(true);
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
