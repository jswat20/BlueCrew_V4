import {
  test,
  expect
} from "./fixtures/app.fixture.js";

test.describe("Reporting Presets", () => {
  test.beforeEach(async ({ app }) => {
    await app.page.evaluate(() => {
      localStorage.clear();

      games.splice(0, games.length);
      crew.splice(0, crew.length);

      Object.keys(reportsPageState)
        .forEach(key => {
          reportsPageState[key] = "";
        });

      Object.assign(
        reportsPresetPageState,
        {
          selectedPresetId: "",
          presetName: "",
          message: "",
          messageType: ""
        }
      );

      authService.loginAsAdmin();
      document.body.dataset.role = "admin";
    });
  });

  test("saves current report filters", async ({
    app
  }) => {
    const result =
      await app.page.evaluate(() => {
        return reportPresetService.save({
          name: "Weekend 12U",
          filters: {
            startDate: "2028-06-01",
            endDate: "2028-06-30",
            level: "12U",
            field: "North"
          }
        });
      });

    expect(result.success).toBe(true);
    expect(result.data.name).toBe(
      "Weekend 12U"
    );

    expect(result.data.filters).toEqual({
      startDate: "2028-06-01",
      endDate: "2028-06-30",
      status: "",
      crewId: "",
      level: "12U",
      field: "North"
    });
  });

  test("prevents duplicate preset names", async ({
    app
  }) => {
    const result =
      await app.page.evaluate(() => {
        reportPresetService.save({
          name: "Approved Games",
          filters: {
            status: "approved"
          }
        });

        return reportPresetService.save({
          name: "approved games",
          filters: {
            status: "submitted"
          }
        });
      });

    expect(result.success).toBe(false);
    expect(result.message).toContain(
      "already exists"
    );
  });

  test("applies a saved preset to report filters", async ({
    app
  }) => {
    await app.page.evaluate(() => {
      gameService.create({
        id: "preset-north",
        date: "2028-06-01",
        field: "North",
        level: "12U",
        awayTeam: "A",
        homeTeam: "B",
        gameType: "single"
      });

      gameService.create({
        id: "preset-south",
        date: "2028-06-02",
        field: "South",
        level: "14U",
        awayTeam: "C",
        homeTeam: "D",
        gameType: "single"
      });

      const result =
        reportPresetService.save({
          name: "North Games",
          filters: {
            field: "North"
          }
        });

      reportsPresetPageState
        .selectedPresetId =
          result.data.id;

      reportsPresetPageState.presetName =
        result.data.name;

      renderPage("reports");
    });

    await app.page
      .getByTestId("reports-preset-apply")
      .click();

    await expect(
      app.page.getByTestId(
        "assignment-report-total-games"
      )
    ).toHaveText("1");

    await expect(
      app.page.getByTestId(
        "reports-filter-field"
      )
    ).toHaveValue("North");
  });

  test("updates an existing preset", async ({
    app
  }) => {
    const presets =
      await app.page.evaluate(() => {
        const created =
          reportPresetService.save({
            name: "Season Games",
            filters: {
              level: "12U"
            }
          });

        reportPresetService.save({
          id: created.data.id,
          name: "Season Games",
          filters: {
            level: "14U"
          }
        });

        return reportPresetService.getAll();
      });

    expect(presets).toHaveLength(1);
    expect(
      presets[0].filters.level
    ).toBe("14U");
  });

  test("deletes a saved preset", async ({
    app
  }) => {
    await app.page.evaluate(() => {
      const result =
        reportPresetService.save({
          name: "Delete Me",
          filters: {
            status: "returned"
          }
        });

      reportsPresetPageState
        .selectedPresetId =
          result.data.id;

      reportsPresetPageState.presetName =
        result.data.name;

      renderPage("reports");
    });

    await app.page
      .getByTestId("reports-preset-delete")
      .click();

    const presets =
      await app.page.evaluate(() =>
        reportPresetService.getAll()
      );

    expect(presets).toHaveLength(0);

    await expect(
      app.page.getByTestId(
        "reports-preset-message"
      )
    ).toContainText(
      "Report preset deleted"
    );
  });
});
