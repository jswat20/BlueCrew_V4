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

  test("advanced filters and sorting apply in all-games view", async ({ page }) => {
    await page.evaluate(() => {
      gameService.create({ date: "2099-10-01", time: "8:00 AM", field: "Filter Field Alpha", level: "8U", homeTeam: "Filter Home A", awayTeam: "Filter Away A", gameType: "single" });
      gameService.create({ date: "2099-10-01", time: "6:00 PM", field: "Filter Field Beta", level: "14U", homeTeam: "Filter Home B", awayTeam: "Filter Away B", gameType: "single" });
      currentScheduleView = "all";
      renderPage("schedule");
    });
    await page.getByTestId("schedule-advanced-field").selectOption("Filter Field Beta");
    await expect(page.locator(".schedule-table tbody tr")).toHaveCount(1);
    await expect(page.locator(".schedule-table tbody tr")).toContainText("Filter Away B @ Filter Home B");
    await page.getByTestId("schedule-clear-filters").click();
    await page.getByTestId("schedule-sort-field").selectOption("time");
    await page.getByTestId("schedule-sort-direction").selectOption("desc");
    await expect(page.getByTestId("schedule-advanced-filters")).toBeVisible();
  });

  test("advanced filters stay out of Daily View and Today", async ({ page }) => {
    await expect(page.getByTestId("schedule-advanced-filters")).toHaveCount(0);
    await page.getByTestId("view-all-games").click();
    await expect(page.getByTestId("schedule-advanced-filters")).toBeVisible();
    await page.getByTestId("today").click();
    await expect(page.getByTestId("schedule-advanced-filters")).toHaveCount(0);
    await expect(page.getByTestId("view-daily")).toHaveClass(/active/);
  });

  test("date controls live inside the daily card and keep the calendar selection synchronized", async ({ page }) => {
    await expect(page.getByTestId("schedule-toolbar").getByTestId("previous-date")).toHaveCount(0);
    const startingDate = await page.evaluate(() => currentScheduleDate);
    await page.getByTestId("next-date").click();
    const selectedDate = await page.evaluate(() => currentScheduleDate);
    expect(selectedDate).not.toBe(startingDate);
    await expect(page.locator(`.schedule-calendar-day[aria-pressed="true"]`)).toHaveAttribute(
      "onclick",
      `selectScheduleCalendarDate('${selectedDate}')`
    );
  });

  test("Today sits beside All Games and date arrows flank the selected date", async ({ page }) => {
    const tabs = page.getByTestId("schedule-view-tabs");
    await expect(tabs.getByTestId("today")).toBeVisible();

    const geometry = await page.locator(".daily-date-heading").evaluate(element => {
      const previous = element.querySelector('[data-testid="previous-date"]').getBoundingClientRect();
      const date = element.querySelector("h2").getBoundingClientRect();
      const next = element.querySelector('[data-testid="next-date"]').getBoundingClientRect();
      return {
        ordered: previous.right < date.left && date.right < next.left,
        centerSpread: Math.max(
          Math.abs((previous.top + previous.bottom) / 2 - (date.top + date.bottom) / 2),
          Math.abs((next.top + next.bottom) / 2 - (date.top + date.bottom) / 2)
        )
      };
    });

    expect(geometry.ordered).toBe(true);
    expect(geometry.centerSpread).toBeLessThan(24);
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
    await page.setViewportSize({ width: 900, height: 900 });
    const layout = await page.locator(".daily-assignment-grid").evaluate(element => {
      const children = [...element.children].map(child => child.getBoundingClientRect());
      return {
        display: getComputedStyle(element).display,
        direction: getComputedStyle(element).flexDirection,
        viewport: window.innerWidth,
        sideBySide: children.length === 2 && Math.abs(children[0].top - children[1].top) < 2,
        similarWidths: children.length === 2 && Math.abs(children[0].width - children[1].width) < 3
      };
    });
    expect(layout).toEqual({ display: "flex", direction: "row", viewport: 900, sideBySide: true, similarWidths: true });
    const workloadSection = page.locator(".crew-workload-section");
    await expect(workloadSection.locator(":scope > .daily-section-heading")).toContainText("Crew Workload");
    await expect(workloadSection.locator(".crew-workload-panel h3")).toHaveCount(0);
  });

  test("calendar uses defined cells and parenthesized event counts", async ({ page }) => {
    const day = page.locator(".schedule-calendar-day").first();
    await expect(day).toHaveCSS("border-top-style", "solid");
    const count = page.locator(".schedule-calendar-day.has-games small").first();
    if (await count.count()) {
      await expect(count).toHaveText(/^\(\d+\)$/);
    }
  });

  test("game cards retain actions in a compact row", async ({ page }) => {
    const card = page.locator(".schedule-game-card").first();
    test.skip(await card.count() === 0, "No games exist on the selected date.");
    await expect(card.locator(".game-card-actions button")).toHaveCount(1);
    await expect(card.getByRole("button", { name: "View Game Hub" })).toBeVisible();
    const radius = await card.evaluate(element => parseFloat(getComputedStyle(element).borderRadius));
    expect(radius).toBeLessThanOrEqual(8);
    await expect(card.locator(".game-card-main .workload-badge")).toBeHidden();
    const assignedCrew = card.locator(".game-card-crew span");
    if (await assignedCrew.count()) {
      await expect(assignedCrew.first().locator("small")).toHaveText(/Solo|Plate|Base/i);
      const crewLink = assignedCrew.first().getByRole("button");
      await crewLink.click();
      await expect(page.getByTestId("crew-card-dialog")).toBeVisible();
      await page.getByTestId("crew-card-dialog").getByRole("button", { name: "Close" }).last().click();
    }
  });

  test("shows assignment readiness as a compact line beneath the date", async ({ page }) => {
    await expect(page.getByTestId("schedule-staffing-readiness")).toHaveCount(0);
    await expect(page.getByTestId("schedule-assignment-status")).toHaveText(
      /No open assignments for this day\.|\d+ open assignments? for this day\./
    );
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
    await expect(crewCard.getByTestId("crew-card-copy-email")).toBeVisible();
    await expect(crewCard.getByTestId("crew-card-call-phone")).toBeVisible();
  });

  test("Crew roster filters live by name and eligible age level", async ({ page }) => {
    await page.getByTestId("nav-crew").click();
    const search = page.getByTestId("crew-roster-search");
    const members = page.getByTestId("crew-roster-member");
    const target = await members.first().evaluate(card => ({
      name: card.querySelector(".crew-credential-front-main strong")?.textContent || "",
      level: card.querySelector(".settings-pill")?.textContent || ""
    }));

    await search.fill(target.name.slice(0, 3));
    await expect(page.locator('[data-testid="crew-roster-member"]:visible').first()).toContainText(target.name);
    await search.fill(target.level.replace(/U$/i, ""));
    await expect(page.locator('[data-testid="crew-roster-member"]:visible').first().locator(".settings-pill").first()).toBeVisible();
    await search.fill("no-such-crew-member");
    await expect(page.getByTestId("crew-roster-count")).toHaveText("0 crew members");
  });

  test("Crew roster can hide inactive members", async ({ page }) => {
    await page.getByTestId("nav-crew").click();
    const inactiveCount = await page.locator('[data-testid="crew-roster-member"][data-crew-active="false"]').count();
    await page.getByTestId("crew-hide-inactive").check();
    await expect(page.locator('[data-testid="crew-roster-member"][data-crew-active="false"]:visible')).toHaveCount(0);
    expect(inactiveCount).toBeGreaterThanOrEqual(0);
  });
});
