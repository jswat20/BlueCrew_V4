import { expect, test } from "@playwright/test";

test("workbench renders", async ({ page }) => {
  await page.goto("/");

  await page.evaluate(() => {
    navigateTo("assigner-workbench");
  });

  await expect(
    page.getByTestId("assigner-workbench")
  ).toBeVisible();

  await expect(
    page.getByTestId("workbench-needs-assignment")
  ).toBeVisible();

  await expect(
    page.getByTestId("workbench-pending-claims")
  ).toBeVisible();

  await expect(
    page.getByTestId("workbench-awaiting-review")
  ).toBeVisible();

  await expect(
    page.getByTestId("workbench-returned-review")
  ).toBeVisible();

  await expect(
    page.getByTestId("workbench-status-strip")
  ).toBeVisible();

  await expect(
    page.getByTestId("workbench-tools")
  ).toBeVisible();

  await expect(
    page.getByTestId("workbench-notifications")
  ).toBeVisible();

  await expect(page.getByTestId("workbench-activity")).toHaveCount(0);
});

test("workbench notifications collapse without leaving the page", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    notificationService.create({ title: "Collapsible notice", message: "Visible before collapse." });
    navigateTo("assigner-workbench");
  });
  await expect(page.getByTestId("workbench-notification-item")).toBeVisible();
  await page.getByTestId("workbench-toggle-notifications").click();
  await expect(page.getByTestId("workbench-notification-item")).toHaveCount(0);
  await expect(page.getByTestId("workbench-toggle-notifications")).toHaveText("Expand");
});

test("workbench notifications open details and completed Game Hub summaries", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    notificationService.clearAll();
    notificationService.create({
      type: "assignment",
      title: "Crew Updated",
      message: "Plate assignment changed."
    });
    const game = gameService.create({
      date: new Date().toISOString().split("T")[0],
      time: "9:00 AM",
      field: "Workbench Field",
      level: "12U",
      homeTeam: "Workbench Home",
      awayTeam: "Workbench Away",
      gameType: "single"
    }).data;
    gameService.update(game.id, {
      completion: {
        completed: true,
        completionTime: new Date().toISOString(),
        awayScore: 4,
        homeScore: 3,
        notes: "Completed cleanly."
      }
    });
    navigateTo("assigner-workbench");
  });

  const rows = page.getByTestId("workbench-notification-item");
  expect(await rows.count()).toBeGreaterThanOrEqual(3);
  await rows.filter({ hasText: "Game Completed" }).click();
  const dialog = page.getByTestId("workbench-notification-dialog");
  await expect(dialog).toContainText("Game Hub");
  await expect(dialog).toContainText("4");
  await expect(dialog).toContainText("Completed cleanly.");
});

test("workbench queue games open an inline Game Hub", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    const date = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    gameService.create({
      date,
      time: "2:00 PM",
      field: "Workbench Diamond",
      level: "12U",
      homeTeam: "Home Club",
      awayTeam: "Visitors Club",
      gameType: "single"
    });
    navigateTo("assigner-workbench");
  });

  const game = page.getByTestId("workbench-needs-assignment-item").first();
  await expect(game).toBeVisible();
  await expect(game).not.toContainText("Open Game Hub");
  await expect(game.locator('.workbench-staffing-count[data-incomplete="true"]')).toBeVisible();
  await game.click();

  const dialog = page.getByTestId("workbench-game-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("game-hub-admin-crew")).toBeVisible();
  await expect(page).toHaveURL(/127\.0\.0\.1|localhost/);
});

test("workbench notifications describe the exact crew assignment change", async ({ page }) => {
  await page.goto("/");
  const expected = await page.evaluate(() => {
    authService.loginAsAdmin();
    const game = gameService.create({
      date: "2099-08-12",
      time: "6:15 PM",
      field: "Activity Field",
      level: "12U",
      homeTeam: "Activity Home",
      awayTeam: "Activity Away",
      gameType: "single"
    }).data;
    const assignment = assignmentService.getAssignments(game)[0];
    const crew = crewService.getEligible(game.level)[0];
    assignmentService.assignToAssignment(game.id, assignment.id, crew.id);
    navigateTo("assigner-workbench");
    return `${assignment.position}: Assigned to ${crewService.getDisplayName(crew.id)}.`;
  });

  const row = page.getByTestId("workbench-notification-item").filter({ hasText: "Activity Away @ Activity Home · 6:15 PM" }).first();
  await expect(row).toContainText(expected);
});

test("workbench notifications describe schedule values before and after an edit", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    authService.loginAsAdmin();
    const game = gameService.create({ date: "2099-09-01", time: "5:00 PM", field: "Old Field", level: "10U", homeTeam: "Edit Home", awayTeam: "Edit Away", gameType: "single" }).data;
    gameService.update(game.id, { time: "7:30 PM", field: "New Field" });
    navigateTo("assigner-workbench");
  });

  const row = page.getByTestId("workbench-notification-item").filter({ hasText: "Edit Away @ Edit Home · 7:30 PM" }).first();
  await expect(row).toContainText("Time: 5:00 PM changed to 7:30 PM.");
  await expect(row).toContainText("Field: Old Field changed to New Field.");
});
