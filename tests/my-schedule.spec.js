import { test, expect } from "./fixtures/app.fixture.js";

async function createAssignedGame(app) {
  await app.loginAsApprovedUmpire();
  return app.page.evaluate(() => {
    const account = loginService.getCurrentAccount();
    const crewId = authService.currentCrewId();
    const game = gameService.create({
      date: "2099-01-15",
      time: "18:00",
      level: "12U",
      locationComplex: "Schedule Complex",
      locationField: "Field 1",
      field: "Field 1",
      homeTeam: "My Schedule Home",
      awayTeam: "My Schedule Away",
      gameType: "single",
      conditions: { summary: "Clear", temperature: "70°F" }
    }).data;
    authService.loginAsAdmin();
    const assignment = assignmentService.getAssignments(game)[0];
    assignmentService.assignToAssignment(game.id, assignment.id, crewId);
    authService.useAuthenticatedAccount(account);
    renderPage("my-schedule");
    return game.id;
  });
}

test.describe("My Schedule compact pilot presentation", () => {
  test("shows the compact assignment contract", async ({ app }) => {
    const gameId = await createAssignedGame(app);
    const table = app.page.getByTestId("my-schedule-table");
    const row = app.page.getByTestId(`my-schedule-row-${gameId}`);
    await expect(row).toContainText("Thursday, 1/15/99");
    await expect(row).toContainText("6:00 PM");
    await expect(row).toContainText("12U");
    await expect(row).toContainText("Schedule Complex");
    await expect(row).toContainText("Field 1");
    await expect(row.getByTestId(`my-schedule-position-${gameId}`)).toHaveText("U1");
    await expect(row).toContainText("Assigned");
    await expect(table.getByRole("columnheader", { name: "Arrival" })).toHaveCount(0);
    await expect(table.getByRole("columnheader", { name: "Checklist" })).toHaveCount(0);
    await expect(table.getByRole("columnheader", { name: "Timeline" })).toHaveCount(0);
  });

  test("opens the retained Game Hub details", async ({ app }) => {
    const gameId = await createAssignedGame(app);
    await app.page.getByTestId(`my-schedule-open-game-${gameId}`).click();
    await expect(app.page.getByTestId("game-hub-summary")).toBeVisible();
    await expect(app.page.getByTestId("game-hub-summary-position")).toContainText(/U1|Solo/);
    await expect(app.page.getByTestId("game-hub-decline-assignment")).toBeVisible();
  });
});
