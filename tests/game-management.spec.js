import { test, expect } from "./fixtures/app.fixture.js";
import { createConsoleMonitor } from "./helpers/consoleMonitor.js";
import { buildGame } from "./helpers/GameFactory.js";

test.describe("Game Management QA", () => {
  test("Admin can cancel adding a game without saving", async ({ app }) => {
    const consoleMonitor = createConsoleMonitor(app.page);
    const game = buildGame({
      homeTeam: "Cancel QA Home",
      awayTeam: "Cancel QA Away"
    });

    await app.gameEditorPage.openFromSchedule();
    await app.gameEditorPage.expectOpen();

    await app.gameEditorPage.fillGame(game);

    await app.gameEditorPage.cancel();

    await expect(app.page.getByTestId("game-editor")).not.toBeVisible();

    await app.gameEditorPage.expectGameNotVisible(game);

    await consoleMonitor.expectClean();
  });

  test("Admin can edit an existing game", async ({ app }) => {
    const consoleMonitor = createConsoleMonitor(app.page);

    const originalGame = buildGame({
      homeTeam: "Edit QA Home",
      awayTeam: "Edit QA Away"
    });

    const updatedGame = buildGame({
      homeTeam: "Edited QA Home",
      awayTeam: "Edited QA Away",
      field: "Field 2",
      level: "10U"
    });

    await app.gameEditorPage.createGame(originalGame);

    await app.gameEditorPage.openEditForGame(originalGame);
    await app.gameEditorPage.expectOpen();

    await app.gameEditorPage.fillGame(updatedGame);
    await app.gameEditorPage.save();

    await app.gameEditorPage.expectGameVisible(updatedGame);
    await app.gameEditorPage.expectGameNotVisible(originalGame);

    await consoleMonitor.expectClean();
  });

  test("Admin can cancel editing an existing game without saving changes", async ({ app }) => {
    const consoleMonitor = createConsoleMonitor(app.page);

    const originalGame = buildGame({
      homeTeam: "Cancel Edit QA Home",
      awayTeam: "Cancel Edit QA Away"
    });

    const attemptedUpdate = buildGame({
      homeTeam: "Canceled Edit QA Home",
      awayTeam: "Canceled Edit QA Away",
      field: "Field 2",
      level: "10U"
    });

    await app.gameEditorPage.createGame(originalGame);

    await app.gameEditorPage.openEditForGame(originalGame);
    await app.gameEditorPage.expectOpen();

    await app.gameEditorPage.fillGame(attemptedUpdate);
    await app.gameEditorPage.cancel();

    await expect(app.page.getByTestId("game-editor")).not.toBeVisible();

    await app.gameEditorPage.expectGameVisible(originalGame);
    await app.gameEditorPage.expectGameNotVisible(attemptedUpdate);

    await consoleMonitor.expectClean();
  });

  test("Admin can delete an existing game", async ({ app }) => {
    const consoleMonitor = createConsoleMonitor(app.page);

    const game = buildGame({
      homeTeam: "Delete QA Home",
      awayTeam: "Delete QA Away"
    });

    await app.gameEditorPage.createGame(game);

    await app.gameEditorPage.expectGameVisible(game);

    await app.gameEditorPage.deleteGame(game);

    await app.gameEditorPage.expectGameNotVisible(game);

    await consoleMonitor.expectClean();
  });

  test("Deleted game remains deleted after reload", async ({ app }) => {
    const consoleMonitor = createConsoleMonitor(app.page);

    const game = buildGame({
      homeTeam: "Delete Persist QA Home",
      awayTeam: "Delete Persist QA Away"
    });

    await app.gameEditorPage.createGame(game);

    await app.gameEditorPage.expectGameVisible(game);

    await app.gameEditorPage.deleteGame(game);

    await app.gameEditorPage.expectGameNotVisible(game);

    await app.page.reload();

    await app.gameEditorPage.expectGameNotVisible(game);

    await consoleMonitor.expectClean();
  });
});