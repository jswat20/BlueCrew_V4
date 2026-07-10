import { test, expect } from "./fixtures/app.fixture.js";

test.describe("Schedule Import Service", () => {
  test("previews valid CSV rows", async ({ app }) => {
    const result = await app.page.evaluate(() => {
      const csv = [
        "date,time,awayTeam,homeTeam,gameType",
        "2026-07-15,18:00,Tigers,Bears,single",
        "2026-07-16,19:30,Hawks,Eagles,single"
      ].join("\n");

      return scheduleImportService.preview(csv);
    });

    expect(result.success).toBe(true);
    expect(result.totalRows).toBe(2);
    expect(result.validRows).toBe(2);
    expect(result.invalidRows).toBe(0);
    expect(result.errors).toEqual([]);

    expect(result.games[0]).toEqual({
      date: "2026-07-15",
      time: "18:00",
      awayTeam: "Tigers",
      homeTeam: "Bears",
      gameType: "single"
    });
  });

  test("reports missing required headers", async ({ app }) => {
    const result = await app.page.evaluate(() => {
      const csv = [
        "date,time,awayTeam",
        "2026-07-15,18:00,Tigers"
      ].join("\n");

      return scheduleImportService.preview(csv);
    });

    expect(result.success).toBe(false);
    expect(result.validRows).toBe(0);

    expect(result.errors).toContainEqual({
      row: 1,
      field: "homeTeam",
      message: "Missing required header: homeTeam."
    });
  });

  test("reports missing required row values", async ({ app }) => {
    const result = await app.page.evaluate(() => {
      const csv = [
        "date,time,awayTeam,homeTeam",
        "2026-07-15,18:00,Tigers,"
      ].join("\n");

      return scheduleImportService.preview(csv);
    });

    expect(result.success).toBe(false);
    expect(result.totalRows).toBe(1);
    expect(result.validRows).toBe(0);
    expect(result.invalidRows).toBe(1);

    expect(result.errors).toContainEqual({
      row: 2,
      field: "homeTeam",
      message: "Missing homeTeam."
    });
  });

  test("ignores unsupported columns", async ({ app }) => {
    const result = await app.page.evaluate(() => {
      const csv = [
        "date,time,awayTeam,homeTeam,notes,unknown",
        '2026-07-15,18:00,Tigers,Bears,"Bring equipment",ignored'
      ].join("\n");

      return scheduleImportService.preview(csv);
    });

    expect(result.success).toBe(true);
    expect(result.games).toEqual([
      {
        date: "2026-07-15",
        time: "18:00",
        awayTeam: "Tigers",
        homeTeam: "Bears",
        gameType: "single"
      }
    ]);

    expect(result.games[0].notes).toBeUndefined();
    expect(result.games[0].unknown).toBeUndefined();
  });

  test("returns zero rows for an empty file", async ({ app }) => {
    const result = await app.page.evaluate(() =>
      scheduleImportService.preview("")
    );

    expect(result.totalRows).toBe(0);
    expect(result.validRows).toBe(0);
    expect(result.invalidRows).toBe(0);
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(4);
  });

  test("supports quoted values containing commas", async ({ app }) => {
    const result = await app.page.evaluate(() => {
      const csv = [
        "date,time,awayTeam,homeTeam",
        '2026-07-15,18:00,"Tigers, Gold",Bears'
      ].join("\n");

      return scheduleImportService.preview(csv);
    });

    expect(result.success).toBe(true);
    expect(result.games[0].awayTeam).toBe("Tigers, Gold");
  });

  test("rejects identical away and home teams", async ({ app }) => {
    const result = await app.page.evaluate(() => {
      const csv = [
        "date,time,awayTeam,homeTeam",
        "2026-07-15,18:00,Tigers,Tigers"
      ].join("\n");

      return scheduleImportService.preview(csv);
    });

    expect(result.success).toBe(false);
    expect(result.invalidRows).toBe(1);

    expect(result.errors).toContainEqual({
      row: 2,
      field: "homeTeam",
      message: "Away team and home team must be different."
    });
  });
});