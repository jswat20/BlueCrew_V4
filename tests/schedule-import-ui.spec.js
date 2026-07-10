import { test, expect } from "./fixtures/app.fixture.js";

test.describe("Schedule Import UI", () => {
  async function openImportDrawer(app) {
    await app.page.getByTestId("nav-schedule").click();
    await app.page.getByTestId("import-schedule").click();

    await expect(
      app.page.getByTestId("schedule-import")
    ).toBeVisible();
  }

  async function uploadCsv(app, csvText, fileName = "schedule.csv") {
    await app.page
      .getByTestId("schedule-import-file")
      .setInputFiles({
        name: fileName,
        mimeType: "text/csv",
        buffer: Buffer.from(csvText)
      });
  }

  test("opens and closes the import drawer", async ({ app }) => {
    await openImportDrawer(app);

    await app.page
      .getByTestId("schedule-import-close")
      .click();

    await expect(
      app.page.getByTestId("schedule-import")
    ).not.toBeVisible();
  });

  test("previews valid CSV rows", async ({ app }) => {
    await openImportDrawer(app);

    const csvText = [
      "date,time,awayTeam,homeTeam",
      "2026-07-15,6:00 PM,Tigers,Bears",
      "2026-07-15,8:00 PM,Hawks,Eagles"
    ].join("\n");

    await uploadCsv(
      app,
      csvText,
      "schedule-valid.csv"
    );

    const preview =
      app.page.getByTestId("schedule-import-preview");

    await expect(preview).toContainText("Rows: 2");
    await expect(preview).toContainText("Valid: 2");
    await expect(preview).toContainText("Invalid: 0");

    await expect(preview).toContainText(
      "Tigers @ Bears"
    );

    await expect(preview).toContainText(
      "Hawks @ Eagles"
    );

    await expect(preview).toContainText(
      "No errors."
    );
  });

  test("shows validation errors for invalid CSV rows", async ({ app }) => {
    await openImportDrawer(app);

    const csvText = [
      "date,time,awayTeam,homeTeam",
      "2026-07-15,6:00 PM,Tigers,",
      "2026-07-15,8:00 PM,Eagles,Eagles"
    ].join("\n");

    await uploadCsv(
      app,
      csvText,
      "schedule-invalid.csv"
    );

    const preview =
      app.page.getByTestId("schedule-import-preview");

    await expect(preview).toContainText("Rows: 2");
    await expect(preview).toContainText("Valid: 0");
    await expect(preview).toContainText("Invalid: 2");

    await expect(preview).toContainText("Row 2");

    await expect(preview).toContainText(
      "Missing homeTeam."
    );

    await expect(preview).toContainText("Row 3");

    await expect(preview).toContainText(
      "Away team and home team must be different."
    );
  });

  test("does not persist previewed games", async ({ app }) => {
    const gamesBefore = await app.page.evaluate(() => {
      return gameService.getAll().length;
    });

    await openImportDrawer(app);

    const csvText = [
      "date,time,awayTeam,homeTeam",
      "2026-07-15,6:00 PM,Preview Away,Preview Home"
    ].join("\n");

    await uploadCsv(
      app,
      csvText,
      "schedule-preview-only.csv"
    );

    await expect(
      app.page.getByTestId("schedule-import-preview")
    ).toContainText(
      "Preview Away @ Preview Home"
    );

    const gamesAfter = await app.page.evaluate(() => {
      return gameService.getAll().length;
    });

    expect(gamesAfter).toBe(gamesBefore);
  });

  test("enables import only when a valid preview exists", async ({ app }) => {
    await openImportDrawer(app);

    const importButton =
      app.page.getByTestId("schedule-import-submit");

    await expect(importButton).toBeDisabled();

    const invalidCsv = [
      "date,time,awayTeam,homeTeam",
      "2026-07-15,6:00 PM,Tigers,"
    ].join("\n");

    await uploadCsv(
      app,
      invalidCsv,
      "schedule-no-valid-games.csv"
    );

    await expect(importButton).toBeDisabled();

    const validCsv = [
      "date,time,awayTeam,homeTeam",
      "2026-07-15,6:00 PM,Tigers,Bears"
    ].join("\n");

    await uploadCsv(
      app,
      validCsv,
      "schedule-has-valid-game.csv"
    );

    await expect(importButton).toBeEnabled();
  });

  test("imports valid games through gameService", async ({ app }) => {
    await openImportDrawer(app);

    const csvText = [
      "date,time,awayTeam,homeTeam",
      "2026-07-20,6:00 PM,Import Tigers,Import Bears",
      "2026-07-20,8:00 PM,Import Hawks,Import Eagles"
    ].join("\n");

    await uploadCsv(
      app,
      csvText,
      "schedule-import-games.csv"
    );

    await app.page
      .getByTestId("schedule-import-submit")
      .click();

    const importedGames =
      await app.page.evaluate(() => {
        return gameService
          .getAll()
          .filter(game =>
            game.awayTeam.startsWith("Import ")
          )
          .map(game => ({
            date: game.date,
            time: game.time,
            awayTeam: game.awayTeam,
            homeTeam: game.homeTeam
          }));
      });

    expect(importedGames).toHaveLength(2);

    expect(importedGames).toEqual(
      expect.arrayContaining([
        {
          date: "2026-07-20",
          time: "6:00 PM",
          awayTeam: "Import Tigers",
          homeTeam: "Import Bears"
        },
        {
          date: "2026-07-20",
          time: "8:00 PM",
          awayTeam: "Import Hawks",
          homeTeam: "Import Eagles"
        }
      ])
    );
  });

  test("imports valid rows and skips invalid rows", async ({ app }) => {
    await openImportDrawer(app);

    const csvText = [
      "date,time,awayTeam,homeTeam",
      "2026-07-21,6:00 PM,Valid Away,Valid Home",
      "2026-07-21,7:00 PM,Missing Home,",
      "2026-07-21,8:00 PM,Duplicate Team,Duplicate Team"
    ].join("\n");

    await uploadCsv(
      app,
      csvText,
      "schedule-mixed.csv"
    );

    const preview =
      app.page.getByTestId("schedule-import-preview");

    await expect(preview).toContainText("Rows: 3");
    await expect(preview).toContainText("Valid: 1");
    await expect(preview).toContainText("Invalid: 2");

    await app.page
      .getByTestId("schedule-import-submit")
      .click();

    const result =
      await app.page.evaluate(() => {
        const games = gameService.getAll();

        return {
          validGameCount: games.filter(game =>
            game.awayTeam === "Valid Away" &&
            game.homeTeam === "Valid Home"
          ).length,

          missingHomeCount: games.filter(game =>
            game.awayTeam === "Missing Home"
          ).length,

          duplicateTeamCount: games.filter(game =>
            game.awayTeam === "Duplicate Team" ||
            game.homeTeam === "Duplicate Team"
          ).length
        };
      });

    expect(result.validGameCount).toBe(1);
    expect(result.missingHomeCount).toBe(0);
    expect(result.duplicateTeamCount).toBe(0);
  });

  test("closes the drawer after importing", async ({ app }) => {
    await openImportDrawer(app);

    const csvText = [
      "date,time,awayTeam,homeTeam",
      "2026-07-22,6:00 PM,Close Away,Close Home"
    ].join("\n");

    await uploadCsv(
      app,
      csvText,
      "schedule-close-after-import.csv"
    );

    await app.page
      .getByTestId("schedule-import-submit")
      .click();

    await expect(
      app.page.getByTestId("schedule-import")
    ).not.toBeVisible();
  });

  test("refreshes the visible schedule after importing", async ({ app }) => {
    await app.page.getByTestId("nav-schedule").click();

    await app.page
      .getByTestId("view-all-games")
      .click();

    await app.page
      .getByTestId("import-schedule")
      .click();

    const csvText = [
      "date,time,awayTeam,homeTeam",
      "2026-07-23,6:00 PM,Refresh Away,Refresh Home"
    ].join("\n");

    await uploadCsv(
      app,
      csvText,
      "schedule-refresh.csv"
    );

    await app.page
      .getByTestId("schedule-import-submit")
      .click();

    await expect(
      app.page.getByTestId("schedule-content")
    ).toContainText("Refresh Away");

    await expect(
      app.page.getByTestId("schedule-content")
    ).toContainText("Refresh Home");
  });

  test("shows a success toast with the imported count", async ({ app }) => {
    await openImportDrawer(app);

    const csvText = [
      "date,time,awayTeam,homeTeam",
      "2026-07-24,6:00 PM,Toast Away One,Toast Home One",
      "2026-07-24,8:00 PM,Toast Away Two,Toast Home Two"
    ].join("\n");

    await uploadCsv(
      app,
      csvText,
      "schedule-toast.csv"
    );

    await app.page
      .getByTestId("schedule-import-submit")
      .click();

    await expect(
      app.page.locator(".toast.success")
    ).toContainText("Imported 2 games.");
  });

  test("uses singular wording when one game is imported", async ({ app }) => {
    await openImportDrawer(app);

    const csvText = [
      "date,time,awayTeam,homeTeam",
      "2026-07-25,6:00 PM,Singular Away,Singular Home"
    ].join("\n");

    await uploadCsv(
      app,
      csvText,
      "schedule-single-game.csv"
    );

    await app.page
      .getByTestId("schedule-import-submit")
      .click();

    await expect(
      app.page.locator(".toast.success")
    ).toContainText("Imported 1 game.");
  });

  test("imported games survive a page reload", async ({ app }) => {
    await openImportDrawer(app);

    const csvText = [
      "date,time,awayTeam,homeTeam",
      "2026-07-26,6:00 PM,Persistent Away,Persistent Home"
    ].join("\n");

    await uploadCsv(
      app,
      csvText,
      "schedule-persistence.csv"
    );

    await app.page
      .getByTestId("schedule-import-submit")
      .click();

    await app.page.reload();

    const persistedGame =
      await app.page.evaluate(() => {
        return gameService
          .getAll()
          .find(game =>
            game.awayTeam === "Persistent Away" &&
            game.homeTeam === "Persistent Home"
          );
      });

    expect(persistedGame).toBeTruthy();
    expect(persistedGame.date).toBe("2026-07-26");
    expect(persistedGame.time).toBe("6:00 PM");
  });
});