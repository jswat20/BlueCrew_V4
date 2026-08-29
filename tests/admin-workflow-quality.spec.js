const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test.describe("Administrator workflow quality milestone", () => {
  test.beforeEach(async ({ page }) => { await page.goto("/"); });

  test("Umpire review defaults 6U and 8U and disables approval at zero levels", async ({ page }) => {
    await page.evaluate(() => {
      authService.loginAsAdmin();
      accountService.createAccount({ firstName: "Pending", lastName: "Review", email: "pending-review@example.test", birthdate: "1990-01-01" });
      uiStateService.setAccountFilter("pending");
      renderPage("accounts");
    });
    const row = page.locator('[data-testid^="pending-account-"]').filter({ hasText: "Pending Review" });
    await expect(row.getByRole("checkbox", { name: "6U", exact: true })).toBeChecked();
    await expect(row.getByRole("checkbox", { name: "8U", exact: true })).toBeChecked();
    for (const checkbox of await row.locator(".pending-account-level").all()) await checkbox.uncheck();
    await expect(row.getByRole("button", { name: "Approve" })).toBeDisabled();
  });

  test("trusted approval rejects empty eligibility and persists reviewed levels atomically", () => {
    const sql = read("supabase/migrations/202608300001_umpire_approval_eligibility.sql");
    expect(sql).toContain("umpire_eligibility_required");
    expect(sql).toContain("unsupported_umpire_eligibility");
    expect(sql).toContain("set eligible_levels = reviewed_levels");
    expect(sql).toContain("revoke execute on function public.approve_pending_umpire(uuid) from authenticated");
  });

  test("Operations Center never offers one-click Umpire account approval", () => {
    const source = read("js/ui/operationsCenter.js");
    expect(source).not.toContain('data-operations-quick-action="approve-account" data-operations-payload');
    expect(source).toContain('metric.id === "pending-accounts"');
  });

  test("registration notification routes to focused Accounts review", () => {
    const source = read("js/ui/notifications.js");
    expect(source).toContain('notification.type === "registration-submitted"');
    expect(source).toContain('label: "Review"');
    expect(source).toContain('focusAccountId: target?.id');
  });

  test("Game Hub renders the canonical stable game reference", async ({ page }) => {
    const values = await page.evaluate(() => [
      presentationFormattingService.getGameReference({ id: "12345678-aaaa-bbbb-cccc-123456789012", legacyGameId: "LSYB-42" }),
      presentationFormattingService.getGameReference({ id: "12345678-aaaa-bbbb-cccc-123456789012" })
    ]);
    expect(values).toEqual(["LSYB-42", "SLT-12345678"]);
    expect(read("js/ui/gameHub.js")).toContain('data-testid="game-hub-game-id"');
  });

  test("declined assignments remain distinct from rejected claims", () => {
    const source = read("js/ui/claimHistory.js");
    expect(source).toContain("Declined Assignments");
    expect(source).toContain('activity.action === "assignment_declined"');
    expect(source).toContain('data-testid="declined-assignment-card"');
  });

  test("notification Open resolves before marking read and refreshes unread count", () => {
    const source = read("js/ui/notifications.js");
    const actionIndex = source.indexOf("const action = notification", source.indexOf("async function handleNotificationAction"));
    const readIndex = source.indexOf("const readResult = await notificationService.markAsRead", actionIndex);
    expect(actionIndex).toBeGreaterThan(0);
    expect(readIndex).toBeGreaterThan(actionIndex);
    expect(source.slice(readIndex, readIndex + 220)).toContain("updateNotificationBadge");
  });

  test("same subject card starts on the front for every viewer and preserves role-gated actions", () => {
    const source = read("js/ui/crewCard.js");
    expect(source).toContain('renderCrewCredentialFrontFace(model, { hidden: false, profileDesign: true })');
    expect(source).toContain('renderCrewCredentialBackFace(model, { hidden: true, profileDesign: true })');
    expect(source).not.toContain("if (!isLeagueViewer) requestAnimationFrame");
    expect(source).toContain("authService.isAdmin?.() && model.crewRecordId");
  });

  test("Administrator card semantics omit officiating totals and use organization/history labels", () => {
    const source = read("js/ui/crewCard.js");
    expect(source).toContain('isAdministratorSubject ? "Admin History"');
    expect(source).toContain('isUmpireSubject ? "Eligibility" : "Organizations"');
    expect(source).toContain('const statistics = isUmpireSubject ? `<dl class="crew-credential-age"');
    expect(source).toContain('<div><dt>Games Today</dt>');
  });

  test("responsive presentation contracts cover full-width Settings and phone Dashboard", () => {
    const css = read("styles.css");
    expect(css).toContain(".settings-card-grid { grid-template-columns: 1fr; }");
    expect(css).toContain('body[data-page="dashboard"] .dashboard-grid');
    expect(css).toContain("@media (max-width: 430px)");
  });

  test("Dashboard and Operations Center consume the same ordered canonical activity events", async ({ page }) => {
    const result = await page.evaluate(() => {
      authService.loginAsAdmin();
      const now = Date.now();
      const events = [
        ["account-request", "account", "registration_submitted"],
        ["account-approved", "account", "account_approved"],
        ["account-rejected", "account", "account_rejected"],
        ["claim-submitted", "claim", "claim_submitted"],
        ["claim-approved", "claim", "claim_approved"],
        ["claim-rejected", "claim", "claim_rejected"],
        ["assignment-created", "assignment", "assigned"],
        ["assignment-removed", "assignment", "cleared"],
        ["assignment-declined", "assignment", "assignment_declined"]
      ];
      events.forEach(([id, type, action], index) => activityService.log({
        id, type, action, actorName: "Admin Reviewer", actorRole: "administrator",
        message: `${action} activity`, createdAt: new Date(now - index * 1000).toISOString()
      }));
      const dashboard = getDashboardRecentActivity().filter(item => events.some(([id]) => id === item.id));
      const operations = dashboardService.getOperationsCenter().recentActivity.filter(item => events.some(([id]) => id === item.id));
      return {
        dashboard: dashboard.map(item => [item.id, item.type, item.actor]),
        operations: operations.map(item => [item.id, item.type, item.actor])
      };
    });
    expect(result.dashboard).toEqual(result.operations);
    expect(result.dashboard.map(item => item[0])).toEqual([
      "account-request", "account-approved", "account-rejected", "claim-submitted",
      "claim-approved", "claim-rejected", "assignment-created", "assignment-removed", "assignment-declined"
    ]);
  });

  test("Accounts exposes a League Viewers role filter", async ({ page }) => {
    await page.evaluate(() => { authService.loginAsAdmin(); renderPage("accounts"); });
    const filter = page.getByTestId("account-role-filter-league_viewer");
    await expect(filter).toHaveText("League Viewers");
    await filter.click();
    await expect(filter).toHaveAttribute("aria-pressed", "true");
  });

  test("Schedule renders exactly one assignee-owned workload badge on desktop and phone", async ({ page }) => {
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => { authService.loginAsAdmin(); renderPage("schedule"); });
      const assignedCards = page.locator(".schedule-game-card.assigned");
      expect(await assignedCards.count()).toBeGreaterThan(0);
      for (const card of await assignedCards.all()) {
        await expect(card.locator(".workload-badge"), `one workload badge at ${width}`).toHaveCount(1);
        await expect(card.locator(".game-card-main .workload-badge"), `no details-region workload at ${width}`).toHaveCount(0);
        await expect(card.locator(".game-card-crew .workload-badge"), `one crew-region workload at ${width}`).toHaveCount(1);
        await expect(card.locator(".game-card-assignee .workload-badge"), `one assignee workload at ${width}`).toHaveCount(1);
      }
      const assignedCard = assignedCards.first();
      await expect(assignedCard).toBeVisible();
      const workloadGeometry = await assignedCard.evaluate(card => {
        const badge = card.querySelector(".workload-badge")?.getBoundingClientRect();
        const assignee = card.querySelector(".game-card-assignee")?.getBoundingClientRect();
        const name = card.querySelector(".game-card-crew-link")?.getBoundingClientRect();
        return { badge, assignee, name };
      });
      expect(workloadGeometry.badge.width).toBeLessThan(workloadGeometry.assignee.width);
      expect(Math.abs((workloadGeometry.badge.left + workloadGeometry.badge.width / 2) - (workloadGeometry.name.left + workloadGeometry.name.width / 2))).toBeLessThan(2);
      expect(workloadGeometry.badge.top).toBeGreaterThanOrEqual(workloadGeometry.name.bottom - 1);
      const status = assignedCard.locator(".assignment-status-badge");
      await expect(status).toHaveCSS("white-space", "nowrap");
      await expect(status).toHaveCSS("background-color", "rgb(25, 135, 84)");
      const actions = assignedCard.locator(".game-card-actions .button");
      expect(await actions.first().evaluate(element => getComputedStyle(element).display)).toMatch(/flex/);
      await expect(actions.first()).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    }
  });

  for (const width of [320, 360, 390, 430, 768, 1280]) {
    test(`Dashboard and Recent Activity stay contained at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => { authService.loginAsAdmin(); renderPage("dashboard"); });
      const geometry = await page.evaluate(() => {
        const visible = element => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
        };
        const rows = [...document.querySelectorAll(".dashboard-activity-feed .operations-log-row")].filter(visible);
        const collisions = rows.some(row => {
          const actor = row.querySelector(".operations-log-actor")?.getBoundingClientRect();
          const details = row.querySelector(".operations-log-action")?.getBoundingClientRect();
          return actor && details && actor.left < details.right && actor.right > details.left && actor.top < details.bottom && actor.bottom > details.top;
        });
        return {
          pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          collisions,
          cardsContained: [...document.querySelectorAll(".dashboard-card")].filter(visible).every(card => {
            const rect = card.getBoundingClientRect();
            return rect.left >= -1 && rect.right <= innerWidth + 1;
          })
        };
      });
      expect(geometry).toEqual({ pageOverflow: false, collisions: false, cardsContained: true });
    });
  }
});
