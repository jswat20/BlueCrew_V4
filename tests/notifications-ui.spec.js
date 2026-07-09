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

  test("shows notification cards", async ({ app }) => {
    await app.page.evaluate(() => {
      notificationService.clearAll();

      notificationService.create({
        type: "claim",
        title: "New claim submitted",
        message: "Pending Away @ Pending Home has been claimed.",
        relatedId: "game-1",
        audience: "admin"
      });
    });

    await app.page.getByTestId("nav-notifications").click();

    await expect(app.page.getByTestId("notification-card")).toHaveCount(1);
    await expect(
      app.page.getByText("New claim submitted")
    ).toBeVisible();
    await expect(
      app.page.getByText("Pending Away @ Pending Home has been claimed.")
    ).toBeVisible();
  });

  test("shows an unread notification badge", async ({ app }) => {
    await app.page.evaluate(() => {
      notificationService.clearAll();

      notificationService.create({
        title: "Test Notification",
        message: "Unread message."
      });
    });

    await app.page.reload();

    await expect(
      app.page.getByTestId("notifications-badge")
    ).toHaveText("1");
  });

  test("hides the badge when there are no unread notifications", async ({ app }) => {
    await app.page.evaluate(() => {
      notificationService.clearAll();
    });

    await app.page.reload();

    await expect(
      app.page.getByTestId("notifications-badge")
    ).toBeHidden();
  });

  test("marks a notification as read", async ({ app }) => {
    await app.page.evaluate(() => {
      notificationService.clearAll();

      notificationService.create({
        title: "Unread Notification",
        message: "This should be marked read."
      });
    });

    await app.page.reload();

    await expect(
      app.page.getByTestId("notifications-badge")
    ).toHaveText("1");

    await app.page.getByTestId("nav-notifications").click();
    await app.page.getByTestId("notification-mark-read").click();

    await expect(
      app.page.getByTestId("notifications-badge")
    ).toBeHidden();

    await expect(
      app.page.getByTestId("notification-mark-read")
    ).toHaveCount(0);
  });

  test("marks all notifications as read", async ({ app }) => {
    await app.page.evaluate(() => {
      notificationService.clearAll();

      notificationService.create({
        title: "First Notification",
        message: "First unread message."
      });

      notificationService.create({
        title: "Second Notification",
        message: "Second unread message."
      });
    });

    await app.page.reload();

    await expect(
      app.page.getByTestId("notifications-badge")
    ).toHaveText("2");

    await app.page.getByTestId("nav-notifications").click();
    await app.page.getByTestId("notifications-mark-all-read").click();

    await expect(
      app.page.getByTestId("notifications-badge")
    ).toBeHidden();

    await expect(
      app.page.getByTestId("notification-mark-read")
    ).toHaveCount(0);

    await expect(
      app.page.getByTestId("notifications-mark-all-read")
    ).toHaveCount(0);
  });

});