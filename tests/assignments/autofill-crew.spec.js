const { test, expect } = require("@playwright/test");

const { AppPage } = require("../pages/AppPage");
const { NavigationHelper } = require("../helpers/navigation");
const { AssignmentDrawerPage } = require("../pages/AssignmentDrawerPage");

test.describe("Assignment Workflow", () => {
  test("Admin can open drawer, auto fill crew, and save", async ({ page }) => {
    const app = new AppPage(page);
    const nav = new NavigationHelper(page);
    const drawer = new AssignmentDrawerPage(page);

    await app.open();
    await nav.schedule();

    const firstGameDetailsButton = page
      .locator('[data-testid^="game-details-"]')
      .first();

    await expect(firstGameDetailsButton).toBeVisible();

    await firstGameDetailsButton.click();

    await drawer.expectOpen();

    await drawer.autoFill();

    await drawer.save();

    await expect(page.getByTestId("assignment-drawer")).toBeHidden();

    await app.expectNoAppErrors();
  });
});