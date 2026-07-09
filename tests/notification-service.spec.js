import { test, expect } from "./fixtures/app.fixture.js";

test.describe("Notification Service", () => {
  test("creates a notification", async ({ app }) => {
    const result = await app.page.evaluate(() => {
      return notificationService.create({
        type: "claim",
        title: "New claim submitted",
        message: "A game has been claimed.",
        relatedId: "game-1",
        audience: "admin"
      });
    });

    expect(result.success).toBe(true);
    expect(result.data.title).toBe("New claim submitted");
    expect(result.data.read).toBe(false);
  });

  test("returns unread notifications", async ({ app }) => {
    await app.page.evaluate(() => {
      notificationService.clearAll();

      notificationService.create({
        title: "Unread notification",
        message: "This has not been read."
      });
    });

    const unread = await app.page.evaluate(() => {
      return notificationService.getUnread();
    });

    expect(unread).toHaveLength(1);
    expect(unread[0].read).toBe(false);
  });

  test("marks a notification as read", async ({ app }) => {
    const notification = await app.page.evaluate(() => {
      notificationService.clearAll();

      return notificationService.create({
        title: "Read me",
        message: "This should become read."
      }).data;
    });

    const result = await app.page.evaluate(notificationId => {
      return notificationService.markAsRead(notificationId);
    }, notification.id);

    expect(result.success).toBe(true);
    expect(result.data.read).toBe(true);

    const unreadCount = await app.page.evaluate(() => {
      return notificationService.getUnreadCount();
    });

    expect(unreadCount).toBe(0);
  });

  test("marks all notifications as read", async ({ app }) => {
    await app.page.evaluate(() => {
      notificationService.clearAll();

      notificationService.create({
        title: "First",
        message: "First notification."
      });

      notificationService.create({
        title: "Second",
        message: "Second notification."
      });
    });

    const result = await app.page.evaluate(() => {
      return notificationService.markAllAsRead();
    });

    expect(result.success).toBe(true);

    const unreadCount = await app.page.evaluate(() => {
      return notificationService.getUnreadCount();
    });

    expect(unreadCount).toBe(0);
  });
  test("returns notifications newest first", async ({ app }) => {
  const result = await app.page.evaluate(() => {
    notificationService.clearAll();

    notificationService.create({
      type: "claim",
      title: "Old notification",
      message: "Old message",
      createdAt: "2026-07-01T12:00:00.000Z"
    });

    notificationService.create({
      type: "claim",
      title: "New notification",
      message: "New message",
      createdAt: "2026-07-09T12:00:00.000Z"
    });

    return notificationService.getNotifications({ status: "all" });
  });

  expect(result).toHaveLength(2);
  expect(result[0].title).toBe("New notification");
  expect(result[1].title).toBe("Old notification");
});
});