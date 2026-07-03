import { test, expect } from "./fixtures/app.fixture.js";
import { createConsoleMonitor } from "./helpers/consoleMonitor.js";

test.describe("Game Management QA", () => {
  test("Admin can cancel adding a game without saving", async ({ app }) => {
    const consoleMonitor = createConsoleMonitor(app.page);

    await app.gameEditorPage.openFromSchedule();
    await app.gameEditorPage.expectOpen();

    await app.gameEditorPage.fillGame({
      date: new Date().toISOString().split("T")[0],
      time: "6:00 PM",
      field: "Field 1",
      level: "12U",
      homeTeam: "Cancel QA Home",
      awayTeam: "Cancel QA Away",
      gameType: "single"
    });

    await app.gameEditorPage.cancel();

    await expect(app.page.getByTestId("game-editor")).not.toBeVisible();

    await app.gameEditorPage.expectGameNotVisible({
      homeTeam: "Cancel QA Home",
      awayTeam: "Cancel QA Away"
    });

    await consoleMonitor.expectClean();
  });
});

test("Admin can edit an existing game", async ({ app }) => {
  const consoleMonitor = createConsoleMonitor(app.page);

  const originalGame = {
    date: new Date().toISOString().split("T")[0],
    time: "6:00 PM",
    field: "Field 1",
    level: "12U",
    homeTeam: "Edit QA Home",
    awayTeam: "Edit QA Away",
    gameType: "single"
  };

  const updatedGame = {
    ...originalGame,
    field: "Field 2",
    homeTeam: "Edited QA Home"
  };

  await app.gameEditorPage.createGame(originalGame);

  await app.gameEditorPage.expectGameVisible(originalGame);

  await app.gameEditorPage.openEditForGameByMatchup(originalGame);

  await app.gameEditorPage.fillGame(updatedGame);

  await app.gameEditorPage.save();

  await app.gameEditorPage.expectGameVisible(updatedGame);

  await app.page.reload();

  await app.gameEditorPage.expectGameVisible(updatedGame);

  await consoleMonitor.expectClean();
});