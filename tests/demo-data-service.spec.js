import { test, expect } from "./fixtures/app.fixture.js";

test.describe("Demo Data Service", () => {

  test("service loads", async ({ app }) => {

    const exists = await app.page.evaluate(() => {
      return typeof demoDataService !== "undefined";
    });

    expect(exists).toBe(true);

  });

  test("starts unloaded", async ({ app }) => {

    const summary = await app.page.evaluate(() => {
      return demoDataService.getSummary();
    });

    expect(summary.loaded).toBe(false);
    expect(summary.games).toBe(0);
    expect(summary.crew).toBe(0);
    expect(summary.accounts).toBe(0);

  });

  test("loadLeague updates state", async ({ app }) => {

    const summary = await app.page.evaluate(() => {

      demoDataService.loadLeague();

      return demoDataService.getSummary();

    });

    expect(summary.loaded).toBe(true);

  });

});