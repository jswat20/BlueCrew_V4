// tests/smoke/app-load.spec.js

const { test } = require("@playwright/test");

const { AppPage } = require("../pages/AppPage");

const {
  expectNoConsoleErrors,
  expectNoPageErrors,
  expectCurrentPage,
  expectCurrentRole
} = require("../helpers/assertions");

test.describe("BlueCrew Smoke Tests", () => {

  test("Application loads successfully", async ({ page }) => {

    const app = new AppPage(page);

    await app.open();

    await app.expectLoaded();

    await app.expectQaReady();

    await app.expectNoAppErrors();

    await expectNoConsoleErrors(page);

    await expectNoPageErrors(page);

    await expectCurrentPage(page, "dashboard");

    await expectCurrentRole(page, "admin");

  });

});