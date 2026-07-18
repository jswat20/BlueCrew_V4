import { test, expect } from "@playwright/test";

test.describe("Schedule Daily View redesign", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      authService.loginAsAdmin();
      currentScheduleView = "daily";
      currentScheduleDate = gameService.getFirstDateOrToday();
      navigateTo("schedule");
    });
  });

  test("uses a centered color-aware daily status strip", async ({ page }) => {
    const metrics = page.locator(".daily-summary-metric");
    await expect(metrics).toHaveCount(4);
    await expect(metrics.first()).toHaveCSS("align-items", "center");
    await expect(page.locator(".daily-summary-metric.status-good, .daily-summary-metric.status-watch, .daily-summary-metric.status-danger")).toHaveCount(3);
    const panelSizes = await page.locator(".daily-overview-grid > section").evaluateAll(elements =>
      elements.map(element => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height }))
    );
    expect(Math.abs(panelSizes[0].width - panelSizes[1].width)).toBeLessThanOrEqual(1);
    expect(Math.abs(panelSizes[0].height - panelSizes[1].height)).toBeLessThanOrEqual(1);
    const summary = page.locator(".daily-summary-inline");
    const centering = await summary.evaluate(element => ({
      width: element.getBoundingClientRect().width,
      parentWidth: element.parentElement.getBoundingClientRect().width,
      labelSize: parseFloat(getComputedStyle(element.querySelector("small")).fontSize),
      valueSize: parseFloat(getComputedStyle(element.querySelector("strong")).fontSize)
    }));
    expect(Math.abs(centering.width - centering.parentWidth)).toBeLessThanOrEqual(3);
    expect(centering.labelSize).toBeGreaterThanOrEqual(12.5);
    expect(centering.valueSize).toBeGreaterThanOrEqual(24);
    const horizontalCenter = await page.locator(".daily-hero > div:first-child").evaluate(element => ({
      center: element.getBoundingClientRect().left + element.getBoundingClientRect().width / 2,
      parentCenter: element.parentElement.getBoundingClientRect().left + element.parentElement.getBoundingClientRect().width / 2
    }));
    expect(Math.abs(horizontalCenter.center - horizontalCenter.parentCenter)).toBeLessThanOrEqual(1);
  });

  test("calendar selects any visible date without stepping one day at a time", async ({ page }) => {
    const targetDate = await page.evaluate(() => {
      const date = new Date(`${currentScheduleDate}T12:00:00`);
      date.setDate(date.getDate() + 5);
      return date.toISOString().split("T")[0];
    });

    await page.locator(`[onclick="selectScheduleCalendarDate('${targetDate}')"]`).click();
    await expect.poll(() => page.evaluate(() => currentScheduleDate)).toBe(targetDate);
    await expect(page.getByTestId("schedule-calendar")).toBeVisible();
  });

  test("All Games exposes persistent operational filters", async ({ page }) => {
    await page.getByTestId("view-all-games").click();

    for (const filter of ["all", "today", "assigned", "open"]) {
      await expect(page.getByTestId(`schedule-filter-${filter}`)).toBeVisible();
    }

    await page.getByTestId("schedule-filter-today").click();
    await expect(page.getByTestId("schedule-filter-today")).toHaveAttribute("aria-pressed", "true");

    const dates = await page.locator(".schedule-table tbody tr td:first-child").allTextContents();
    const expectedDate = await page.evaluate(() => formatShortDate(new Date().toISOString().split("T")[0]));
    expect(dates.every(date => date === expectedDate || date.includes("No games"))).toBe(true);
  });

  test("removes the duplicate conflict center", async ({ page }) => {
    await expect(page.locator("#conflict-center")).toHaveCount(0);
  });

  test("calendar distinguishes game, empty, and past dates", async ({ page }) => {
    const calendar = page.getByTestId("schedule-calendar");
    await expect(calendar.locator(".schedule-calendar-day.has-games:not(.selected)").first()).toHaveCSS("color", "rgb(8, 127, 145)");
    await expect(calendar.locator(".schedule-calendar-day.no-games:not(.outside-month)").first()).toHaveCSS("color", "rgb(23, 32, 51)");
    const past = calendar.locator(".schedule-calendar-day.past-date:not(.selected)").first();
    if (await past.count()) {
      await expect(past).toHaveCSS("background-color", "rgb(233, 237, 242)");
      await expect(past).toBeEnabled();
    }
  });

  test("crew workload is a filterable list rather than profile cards", async ({ page }) => {
    await expect(page.locator(".crew-workload-card")).toHaveCount(0);
    const rows = page.locator(".crew-workload-row");
    const assignedCrewCount = await page.evaluate(() => {
      const ids = new Set(gameService.getByDate(currentScheduleDate).flatMap(game => [
        game.crewId,
        ...assignmentService.getAssignments(game).map(assignment => assignment.crewId)
      ]).filter(Boolean).map(String));
      return crewService.getAll().filter(member => ids.has(String(member.id))).length;
    });
    await expect(rows).toHaveCount(assignedCrewCount);
    if (assignedCrewCount) {
      const initialGameCount = await page.locator(".schedule-game-card").count();
      const selectedCrewId = await rows.first().getAttribute("data-crew-id");
      const expectedFilteredGames = await page.evaluate(crewId =>
        gameService.getByDate(currentScheduleDate).filter(game =>
          String(game.crewId) === String(crewId) ||
          assignmentService.getAssignments(game).some(assignment =>
            String(assignment.crewId) === String(crewId)
          )
        ).length,
      selectedCrewId);

      await expect(rows.first().locator(".crew-workload-sentence")).toContainText(/assigned \d+ today/);
      await expect(rows.first()).not.toContainText("Season");
      await rows.first().click();
      await expect(page.locator(".crew-workload-row")).toHaveCount(1);
      await expect(page.locator(".crew-workload-row")).toHaveClass(/selected/);
      await expect(page.locator(".schedule-game-card")).toHaveCount(expectedFilteredGames);
      await expect(page.getByTestId("schedule-workload-show-all")).toBeVisible();

      await page.getByTestId("schedule-workload-show-all").click();
      await expect(page.locator(".crew-workload-row")).toHaveCount(assignedCrewCount);
      await expect(page.locator(".schedule-game-card")).toHaveCount(initialGameCount);
    }
  });

  test("crew workload and games share the daily workspace", async ({ page }) => {
    const columns = await page.locator(".daily-assignment-grid").evaluate(
      element => getComputedStyle(element).gridTemplateColumns.split(" ").length
    );
    expect(columns).toBe(2);
    const workloadSection = page.locator(".crew-workload-section");
    await expect(workloadSection.locator(":scope > .daily-section-heading")).toContainText("Crew Workload");
    await expect(workloadSection.locator(".crew-workload-panel h3")).toHaveCount(0);
  });

  test("game cards retain actions in a compact row", async ({ page }) => {
    const card = page.locator(".schedule-game-card").first();
    test.skip(await card.count() === 0, "No games exist on the selected date.");
    await expect(card.locator(".game-card-actions button")).toHaveCount(1);
    await expect(card.getByRole("button", { name: "View Game Hub" })).toBeVisible();
    const radius = await card.evaluate(element => parseFloat(getComputedStyle(element).borderRadius));
    expect(radius).toBeLessThanOrEqual(8);
  });

  test("staffing readiness routes changes to the assigner workbench", async ({ page }) => {
    const readiness = page.getByTestId("schedule-staffing-readiness");
    await expect(readiness).toContainText(/All Games Assigned|Assignments Need Attention/);
    await readiness.getByTestId("schedule-open-workbench").click();
    await expect(page.locator("body")).toHaveAttribute("data-page", "assigner-workbench");
  });

  test("Crew page combines roster details and workload into one interactive list", async ({ page }) => {
    await page.getByTestId("nav-crew").click();
    const roster = page.getByTestId("crew-page-workload");
    await expect(roster).toBeVisible();
    await expect(page.locator(".crew-card")).toHaveCount(0);

    const rows = page.getByTestId("crew-roster-member");
    const crewCount = await page.evaluate(() => crewService.getAll().length);
    await expect(rows).toHaveCount(crewCount);
    await expect(rows.first()).toContainText(/@/);
    await expect(rows.first().locator(".settings-pill").first()).toBeVisible();

    await rows.first().click();
    const crewCard = page.getByTestId("crew-card-dialog");
    await expect(crewCard).toBeVisible();
    await expect(crewCard).toContainText("Eligible Age Ranges");
    await expect(crewCard).toContainText("Today");
    await expect(crewCard).toContainText("Season");
    await expect(crewCard.getByTestId("crew-card-edit")).toBeVisible();
  });
});
