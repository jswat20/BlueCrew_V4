// tests/smoke/navigation.spec.js

const { test } = require("@playwright/test");

const { AppPage } = require("../pages/AppPage");
const { NavigationHelper } = require("../helpers/navigation");

test.describe("Navigation", () => {

  test("Every navigation page loads", async ({ page }) => {

    const app = new AppPage(page);
    const nav = new NavigationHelper(page);

    await app.open();

    await nav.dashboard();

    await nav.schedule();

    await nav.crew();

    await nav.reports();

    await nav.settings();

    await nav.admin();

  });

});