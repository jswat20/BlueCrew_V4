const { test } = require("@playwright/test");

const { AppPage } = require("../pages/AppPage");
const { NavigationHelper } = require("../helpers/navigation");
const { SchedulePage } = require("../pages/SchedulePage");

test.describe("Schedule Navigation", () => {

  test("Schedule toolbar works", async ({ page }) => {

    const app = new AppPage(page);
    const nav = new NavigationHelper(page);
    const schedule = new SchedulePage(page);

    await app.open();

    await nav.schedule();

    await schedule.expectLoaded();

    await schedule.showAllGamesView();

    await schedule.showDailyView();

    await schedule.previousDate();

    await schedule.today();

    await schedule.nextDate();

  });

});