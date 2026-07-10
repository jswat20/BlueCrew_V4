import {
  test,
  expect
} from "@playwright/test";

test.describe("Schedule Export Service", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("returns import-compatible headers", async ({ page }) => {
    const headers =
      await page.evaluate(() => {
        return scheduleExportService.getHeaders();
      });

    expect(headers).toEqual([
      "date",
      "time",
      "awayTeam",
      "homeTeam",
      "field",
      "level",
      "gameType"
    ]);
  });

  test("exports an empty schedule with headers only", async ({ page }) => {
    const csv =
      await page.evaluate(() => {
        return scheduleExportService.toCsv([]);
      });

    expect(csv).toBe(
      "date,time,awayTeam,homeTeam,field,level,gameType"
    );
  });

  test("exports game fields in the expected order", async ({ page }) => {
    const csv =
      await page.evaluate(() => {
        return scheduleExportService.toCsv([
          {
            date: "2026-08-01",
            time: "6:00 PM",
            awayTeam: "Tigers",
            homeTeam: "Bears",
            field: "Field 2",
            level: "12U",
            gameType: "single"
          }
        ]);
      });

    expect(csv).toBe([
      "date,time,awayTeam,homeTeam,field,level,gameType",
      "2026-08-01,6:00 PM,Tigers,Bears,Field 2,12U,single"
    ].join("\r\n"));
  });

  test("escapes commas quotes and line breaks", async ({ page }) => {
    const csv =
      await page.evaluate(() => {
        return scheduleExportService.toCsv([
          {
            date: "2026-08-02",
            time: "7:00 PM",
            awayTeam: 'Washington, "Blue"',
            homeTeam: "North\nStars",
            field: "Field 1",
            level: "14U",
            gameType: "single"
          }
        ]);
      });

    expect(csv).toContain(
      '"Washington, ""Blue"""'
    );

    expect(csv).toContain(
      '"North\nStars"'
    );
  });

  test("uses safe defaults for optional fields", async ({ page }) => {
    const normalizedGame =
      await page.evaluate(() => {
        return scheduleExportService.normalizeGame({
          date: "2026-08-03",
          awayTeam: "Away",
          homeTeam: "Home"
        });
      });

    expect(normalizedGame).toEqual({
      date: "2026-08-03",
      time: "",
      awayTeam: "Away",
      homeTeam: "Home",
      field: "",
      level: "",
      gameType: "single"
    });
  });

  test("creates a dated filename and export count", async ({ page }) => {
    const result =
      await page.evaluate(() => {
        return scheduleExportService.createExport(
          [
            {
              awayTeam: "One",
              homeTeam: "Two"
            },
            {
              awayTeam: "Three",
              homeTeam: "Four"
            }
          ],
          {
            date: new Date(
              "2026-08-04T12:00:00Z"
            )
          }
        );
      });

    expect(result.filename).toBe(
      "bluecrew-schedule-2026-08-04.csv"
    );

    expect(result.count).toBe(2);

    expect(result.csv).toContain(
      "One,Two"
    );

    expect(result.csv).toContain(
      "Three,Four"
    );
  });
});