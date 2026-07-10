import {
  test,
  expect
} from "./fixtures/app.fixture.js";

async function clearGames(app) {
  await app.page.evaluate(() => {
    gameService
      .getAll()
      .slice()
      .forEach(game => {
        gameService.delete(game.id);
      });
  });
}

async function createGames(app, games) {
  await app.page.evaluate(
    gameData => {
      gameData.forEach(game => {
        gameService.create(game);
      });
    },
    games
  );
}

async function openSchedule(app) {
  await app.page
    .getByTestId("nav-schedule")
    .click();

  await expect(
    app.page.getByTestId("schedule-page")
  ).toBeVisible();
}

async function readDownload(download) {
  const stream =
    await download.createReadStream();

  const chunks = [];

  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  return Buffer
    .concat(chunks)
    .toString("utf8");
}

test.describe("Schedule Export UI", () => {
  test("disables export when there are no games", async ({ app }) => {
    await clearGames(app);
    await openSchedule(app);

    await expect(
      app.page.getByTestId("export-schedule")
    ).toBeDisabled();
  });

  test("enables export when games exist", async ({ app }) => {
    await clearGames(app);

    await createGames(app, [
      {
        id: "export-enabled-game",
        date: "2026-08-10",
        time: "6:00 PM",
        awayTeam: "Enabled Away",
        homeTeam: "Enabled Home",
        field: "Field 1",
        level: "12U",
        gameType: "single"
      }
    ]);

    await openSchedule(app);

    await expect(
      app.page.getByTestId("export-schedule")
    ).toBeEnabled();
  });

  test("downloads all scheduled games as CSV", async ({ app }) => {
    await clearGames(app);

    await createGames(app, [
      {
        id: "export-game-one",
        date: "2026-08-11",
        time: "6:00 PM",
        awayTeam: "Export Tigers",
        homeTeam: "Export Bears",
        field: "Field 1",
        level: "12U",
        gameType: "single"
      },
      {
        id: "export-game-two",
        date: "2026-08-12",
        time: "8:00 PM",
        awayTeam: "Export Hawks",
        homeTeam: "Export Eagles",
        field: "Field 2",
        level: "14U",
        gameType: "single"
      }
    ]);

    await openSchedule(app);

    const downloadPromise =
      app.page.waitForEvent("download");

    await app.page
      .getByTestId("export-schedule")
      .click();

    const download =
      await downloadPromise;

    expect(
      download.suggestedFilename()
    ).toMatch(
      /^bluecrew-schedule-\d{4}-\d{2}-\d{2}\.csv$/
    );

    const csv =
      await readDownload(download);

    expect(csv).toContain(
      "date,time,awayTeam,homeTeam,field,level,gameType"
    );

    expect(csv).toContain(
      "2026-08-11,6:00 PM,Export Tigers,Export Bears,Field 1,12U,single"
    );

    expect(csv).toContain(
      "2026-08-12,8:00 PM,Export Hawks,Export Eagles,Field 2,14U,single"
    );
  });

  test("shows a success toast with the exported count", async ({ app }) => {
    await clearGames(app);

    await createGames(app, [
      {
        id: "toast-export-one",
        date: "2026-08-13",
        time: "6:00 PM",
        awayTeam: "Toast Away One",
        homeTeam: "Toast Home One"
      },
      {
        id: "toast-export-two",
        date: "2026-08-13",
        time: "8:00 PM",
        awayTeam: "Toast Away Two",
        homeTeam: "Toast Home Two"
      }
    ]);

    await openSchedule(app);

    const downloadPromise =
      app.page.waitForEvent("download");

    await app.page
      .getByTestId("export-schedule")
      .click();

    await downloadPromise;

    await expect(
      app.page.locator(".toast.success")
    ).toContainText(
      "Exported 2 games."
    );
  });

  test("uses singular wording for one exported game", async ({ app }) => {
    await clearGames(app);

    await createGames(app, [
      {
        id: "single-export-game",
        date: "2026-08-14",
        time: "6:00 PM",
        awayTeam: "Single Away",
        homeTeam: "Single Home"
      }
    ]);

    await openSchedule(app);

    const downloadPromise =
      app.page.waitForEvent("download");

    await app.page
      .getByTestId("export-schedule")
      .click();

    await downloadPromise;

    await expect(
      app.page.locator(".toast.success")
    ).toContainText(
      "Exported 1 game."
    );
  });
});