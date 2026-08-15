import { expect, test } from "./fixtures/app.fixture.js";
import AxeBuilder from "@axe-core/playwright";

async function seedAssignedUmpireGame(app) {
  await app.loginAsApprovedUmpire();
  return app.page.evaluate(() => {
    const crewId = authService.currentCrewId();
    const account = loginService.getCurrentAccount();
    const game = gameService.create({
      date: "2099-08-12",
      time: "18:00",
      level: "12U",
      locationComplex: "Lake Shore Athletic Complex",
      locationField: "Field 4",
      field: "Field 4",
      homeTeam: "Home",
      awayTeam: "Visitors",
      gameType: "single"
    }).data;
    authService.loginAsAdmin();
    const assignment = assignmentService.getAssignments(game)[0];
    assignmentService.assignToAssignment(game.id, assignment.id, crewId);
    gameService.update(game.id, { conditions: { summary: "Partly cloudy", temperature: "72°F" } });
    authService.useAuthenticatedAccount(account);
    return game.id;
  });
}

test.describe("Milestone 6.6 umpire experience polish", () => {
  test("dashboard centers Action Center, Upcoming Schedule, and Recent Notifications", async ({ app }) => {
    await seedAssignedUmpireGame(app);
    await app.page.evaluate(() => {
      notificationService.create({ title: "Schedule Updated", message: "Review your assignment.", audience: "umpire" });
      const crewId = authService.currentCrewId();
      const account = loginService.getCurrentAccount();
      const secondGame = gameService.create({ date: "2099-08-13", time: "19:30", level: "6U", locationComplex: "North Complex", locationField: "Field 12", field: "Field 12", homeTeam: "Home Two", awayTeam: "Visitors Two", gameType: "single" }).data;
      authService.loginAsAdmin();
      const secondAssignment = assignmentService.getAssignments(secondGame)[0];
      assignmentService.assignToAssignment(secondGame.id, secondAssignment.id, crewId);
      authService.useAuthenticatedAccount(account);
      renderPage("dashboard");
    });

    await expect(app.page.getByTestId("crew-dashboard-actions")).toBeVisible();
    await expect(app.page.getByTestId("crew-dashboard-upcoming")).toBeVisible();
    await expect(app.page.getByTestId("crew-dashboard-notifications")).toBeVisible();
    await expect(app.page.getByText("Available to Claim")).toHaveCount(0);
    await expect(app.page.getByTestId("crew-dashboard-today")).toHaveCount(0);
    const upcoming = app.page.getByTestId("crew-dashboard-upcoming");
    await expect(upcoming).toContainText("6:00 PM");
    await expect(upcoming).toContainText("12U");
    await expect(upcoming).toContainText("Lake Shore Athletic Complex");
    await expect(upcoming.locator(".crew-command-game-row").first()).toHaveCSS("min-height", "48px");
    expect(await upcoming.locator(".crew-command-game-row b").evaluateAll(elements => elements.every(element => element.scrollWidth <= element.clientWidth + 1))).toBe(true);
    const columnPositions = await upcoming.locator(".crew-command-game-row").evaluateAll(rows => rows.map(row => [...row.children].map(cell => Math.round(cell.getBoundingClientRect().left))));
    expect(columnPositions.length).toBeGreaterThan(1);
    expect(columnPositions.every(positions => positions.every((left, index) => left === columnPositions[0][index]))).toBe(true);
    await expect(app.page.getByTestId("crew-dashboard-notifications").locator(".shared-notification-row").first()).toBeVisible();
  });

  test("Claim Games uses one compact operational row and the shared controls", async ({ app }) => {
    await app.loginAsApprovedUmpire();
    const gameId = await app.page.evaluate(() => {
      const game = gameService.create({
        date: "2099-08-13", time: "19:15", level: "12U",
        locationComplex: "North Complex", locationField: "Field 2", field: "Field 2",
        homeTeam: "Hawks", awayTeam: "Bears", gameType: "single"
      }).data;
      authService.loginAsAdmin();
      assignmentService.openForClaims(game.id);
      authService.useAuthenticatedAccount(loginService.getCurrentAccount());
      renderPage("claim-games");
      return game.id;
    });

    const row = app.page.getByTestId(`claim-game-row-${gameId}`);
    await expect(row).toContainText("7:15 PM");
    await expect(row).toContainText("12U");
    await expect(row).toContainText("North Complex");
    await expect(row).toContainText("Field 2");
    await expect(row).not.toContainText("Bears @ Hawks");
    await expect(row.getByTestId(`claim-game-${gameId}`)).toHaveClass(/button-primary/);
    expect(await row.evaluate(element => element.getBoundingClientRect().height)).toBeLessThanOrEqual(55);
    await expect(row.locator("td").first()).toHaveCSS("border-bottom-style", "solid");
  });

  test("My Schedule is compact and opens the retained 6.2 Game Hub", async ({ app }) => {
    const gameId = await seedAssignedUmpireGame(app);
    await app.page.evaluate(() => renderPage("my-schedule"));
    const schedule = app.page.getByTestId("my-schedule-table");
    await expect(schedule.getByRole("columnheader", { name: "Arrival" })).toHaveCount(0);
    await expect(schedule.getByRole("columnheader", { name: "Timeline" })).toHaveCount(0);
    await expect(schedule.getByRole("columnheader", { name: "Checklist" })).toHaveCount(0);
    const row = app.page.getByTestId(`my-schedule-row-${gameId}`);
    await expect(row).toContainText("6:00 PM");
    await expect(row).toContainText(/Plate|U1|Solo/);
    await expect(row).toContainText("Lake Shore Athletic Complex");
    await expect(row.locator("td").first()).toHaveCSS("border-bottom-style", "solid");
    await row.getByTestId(`my-schedule-open-game-${gameId}`).click();
    const summary = app.page.getByTestId("game-hub-summary");
    await expect(summary).toContainText("Assigned");
    await expect(summary).toContainText("Forecast");
    await expect(summary).toContainText(/U1|Solo/);
    await expect(summary).toContainText("6:00 PM");
    await expect(summary.getByTestId("game-hub-decline-assignment")).toBeVisible();
  });

  test("Profile opens the canonical Crew Card with aligned edit controls", async ({ app }) => {
    await app.loginAsApprovedUmpire();
    await app.page.evaluate(() => renderPage("profile"));
    await expect(app.page.getByTestId("profile-crew-card-experience")).toBeVisible();
    await app.page.getByTestId("profile-card-back").click();
    await app.page.getByTestId("profile-edit-crew-card").click();
    await expect(app.page.getByTestId("profile-save")).toHaveClass(/button-primary/);
    await expect(app.page.getByRole("button", { name:"Cancel" }).first()).toHaveClass(/button-secondary/);
    await expect(app.page.getByTestId("profile-communication")).toBeVisible();
  });

  test("umpire dashboard, notifications, profile, and availability remain responsive and accessible", async ({ app }) => {
    await app.loginAsApprovedUmpire();
    await app.page.setViewportSize({ width: 390, height: 844 });
    for (const pageName of ["dashboard", "notifications", "profile", "availability"]) {
      await app.page.evaluate(page => renderPage(page), pageName);
      expect(await app.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      const accessibility = await new AxeBuilder({ page: app.page }).include("#app-content").withTags(["wcag2a", "wcag2aa"]).analyze();
      expect(accessibility.violations).toEqual([]);
    }
  });
});
