const { test, expect } = require("@playwright/test");

test.describe("Complex and field location model", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("normalizes legacy fields without losing compatibility", async ({ page }) => {
    const model = await page.evaluate(() => {
      const game = gameService.create({
        date: "2099-08-10",
        time: "6:00 PM",
        awayTeam: "Legacy Away",
        homeTeam: "Legacy Home",
        field: "Legacy Diamond",
        level: "12U"
      }).data;
      return {
        locationComplex: game.locationComplex,
        locationField: game.locationField,
        field: game.field,
        display: locationService.getDisplayName(game)
      };
    });

    expect(model).toEqual({
      locationComplex: "",
      locationField: "Legacy Diamond",
      field: "Legacy Diamond",
      display: "Legacy Diamond"
    });
  });

  test("game editor filters fields by the selected complex and saves both", async ({ page }) => {
    await page.evaluate(() => openGameEditor());
    await page.getByTestId("game-location-complex-input").selectOption("Riverside Park");
    await expect(page.getByTestId("game-field-input").locator("option")).toHaveCount(2);
    await page.getByTestId("game-field-input").selectOption("Field 2");
    await page.getByTestId("game-away-team-input").fill("Location Away");
    await page.getByTestId("game-home-team-input").fill("Location Home");
    await page.getByTestId("save-game-button").click();

    const saved = await page.evaluate(() => gameService.getAll().find(game => game.awayTeam === "Location Away"));
    expect(saved.locationComplex).toBe("Riverside Park");
    expect(saved.locationField).toBe("Field 2");
    expect(saved.field).toBe("Field 2");
  });

  test("schedule export contains canonical location columns", async ({ page }) => {
    const result = await page.evaluate(() => scheduleExportService.toCsv([{
      date: "2099-08-10",
      time: "6:00 PM",
      awayTeam: "Export Away",
      homeTeam: "Export Home",
      locationComplex: "East Complex",
      locationField: "Field 2",
      field: "Field 2",
      level: "14U",
      gameType: "single"
    }]));
    expect(result).toContain("locationComplex,locationField,field");
    expect(result).toContain("East Complex,Field 2,Field 2");
  });

  test("location catalog persists complexes and their fields", async ({ page }) => {
    const result = await page.evaluate(() => {
      const complex = locationService.addComplex("North Athletic Campus");
      const field = locationService.addField("North Athletic Campus", "Diamond 3");
      return { complex, field, fields: locationService.getFields("North Athletic Campus") };
    });
    expect(result.complex.success).toBe(true);
    expect(result.field.success).toBe(true);
    expect(result.fields).toEqual(["Diamond 3"]);
    await page.reload();
    expect(await page.evaluate(() => locationService.getFields("North Athletic Campus"))).toEqual(["Diamond 3"]);
  });
});
