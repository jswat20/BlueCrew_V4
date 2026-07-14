import {
  test,
  expect
} from "./fixtures/app.fixture.js";

test.describe("Reporting CSV Exports", () => {
  test.beforeEach(async ({ app }) => {
    await app.page.evaluate(() => {
      localStorage.clear();

      games.splice(0, games.length);
      crew.splice(0, crew.length);

      Object.keys(reportsPageState)
        .forEach(key => {
          reportsPageState[key] = "";
        });

      authService.loginAsAdmin();
      document.body.dataset.role = "admin";
    });
  });

  test("builds assignment CSV from report rows", async ({
    app
  }) => {
    const exportFile =
      await app.page.evaluate(() => {
        gameService.create({
          id: "export-assignment-game",
          date: "2028-06-01",
          time: "6:00 PM",
          field: "Field 1",
          level: "12U",
          awayTeam: "Away",
          homeTeam: "Home",
          gameType: "single"
        });

        return reportExportService
          .getAssignmentExport();
      });

    expect(exportFile.filename).toBe(
      "bluecrew-assignment-report.csv"
    );

    expect(exportFile.rowCount).toBe(1);

    expect(exportFile.content).toContain(
      "Date,Time,Matchup"
    );

    expect(exportFile.content).toContain(
      "Away @ Home"
    );
  });

  test("escapes commas and quotes in CSV values", async ({
    app
  }) => {
    const csv =
      await app.page.evaluate(() =>
        reportExportService.buildCsv(
          ["Name", "Note"],
          [
            [
              'Smith, John',
              'Called it "clean"'
            ]
          ]
        )
      );

    expect(csv).toContain(
      '"Smith, John"'
    );

    expect(csv).toContain(
      '"Called it ""clean"""'
    );
  });

  test("availability export respects crew filter", async ({
    app
  }) => {
    const exportFile =
      await app.page.evaluate(() => {
        crew.push(
          {
            id: "export-crew-one",
            firstName: "Alex",
            lastName: "Blue",
            active: true
          },
          {
            id: "export-crew-two",
            firstName: "Taylor",
            lastName: "Green",
            active: true
          }
        );

        availabilityService.setAvailability({
          crewId: "export-crew-one",
          date: "2028-06-01",
          status: "available"
        });

        availabilityService.setAvailability({
          crewId: "export-crew-two",
          date: "2028-06-01",
          status: "unavailable"
        });

        return reportExportService
          .getAvailabilityExport({
            crewId: "export-crew-one"
          });
      });

    expect(exportFile.rowCount).toBe(1);
    expect(exportFile.content).toContain(
      "Alex Blue"
    );
    expect(exportFile.content).not.toContain(
      "Taylor Green"
    );
  });

  test("review export respects status filter", async ({
    app
  }) => {
    const exportFile =
      await app.page.evaluate(() => {
        games.push(
          {
            id: "export-submitted",
            date: "2028-06-01",
            awayTeam: "A",
            homeTeam: "B",
            review: {
              status: "submitted",
              submittedAt:
                "2028-06-01T12:00:00.000Z"
            }
          },
          {
            id: "export-approved",
            date: "2028-06-02",
            awayTeam: "C",
            homeTeam: "D",
            review: {
              status: "approved",
              submittedAt:
                "2028-06-02T12:00:00.000Z"
            }
          }
        );

        saveGames();

        return reportExportService
          .getReviewExport({
            status: "approved"
          });
      });

    expect(exportFile.rowCount).toBe(1);
    expect(exportFile.content).toContain(
      "C @ D"
    );
    expect(exportFile.content).not.toContain(
      "A @ B"
    );
  });

  test("assignment export button downloads filtered CSV", async ({
    app
  }) => {
    await app.page.evaluate(() => {
      gameService.create({
        id: "export-ui-north",
        date: "2028-06-01",
        field: "North",
        level: "12U",
        awayTeam: "A",
        homeTeam: "B",
        gameType: "single"
      });

      gameService.create({
        id: "export-ui-south",
        date: "2028-06-02",
        field: "South",
        level: "14U",
        awayTeam: "C",
        homeTeam: "D",
        gameType: "single"
      });

      renderPage("reports");
    });

    await app.page
      .getByTestId("reports-filter-field")
      .selectOption("North");

    const downloadPromise =
      app.page.waitForEvent("download");

    await app.page
      .getByTestId(
        "assignment-report-export"
      )
      .click();

    const download =
      await downloadPromise;

    expect(
      download.suggestedFilename()
    ).toBe(
      "bluecrew-assignment-report.csv"
    );

    const stream =
      await download.createReadStream();

    let content = "";

    for await (const chunk of stream) {
      content += chunk.toString();
    }

    expect(content).toContain("A @ B");
    expect(content).not.toContain("C @ D");
  });
});
