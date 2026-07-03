// tests/smoke/role-switching.spec.js

const { test } = require("@playwright/test");

const { AppPage } = require("../pages/AppPage");

test.describe("Role Switching", () => {

  test("Admin and Umpire toggle", async ({ page }) => {

    const app = new AppPage(page);

    await app.open();

    await app.switchToUmpire();

    await app.switchToAdmin();

  });

});