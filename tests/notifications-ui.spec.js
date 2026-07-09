import { test, expect } from "./fixtures/app.fixture.js";

test.describe("Notifications UI", () => {

  test("shows an empty state when there are no notifications", async ({ app }) => {

    await app.page.evaluate(() => {
      notificationService.clearAll();
    });

    await app.page.getByTestId("nav-notifications").click();

    await expect(
      app.page.getByTestId("notifications-empty")
    ).toBeVisible();

  });

});