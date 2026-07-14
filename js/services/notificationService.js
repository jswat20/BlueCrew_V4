const notificationService = (() => {
  const STORAGE_KEY = "bluecrew_notifications";

  function getAll() {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (!stored) return [];

    try {
      const notifications = JSON.parse(stored);
      return Array.isArray(notifications) ? notifications : [];
    } catch {
      return [];
    }
  }

  function saveAll(notifications) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(notifications)
    );
  }

  function getCurrentNotificationAccount() {
    if (
      typeof loginService === "undefined" ||
      typeof loginService
        .getCurrentAccount !== "function"
    ) {
      return null;
    }

    return loginService.getCurrentAccount();
  }

  function isCurrentNotificationAdmin() {
    return (
      typeof authService !== "undefined" &&
      typeof authService.isAdmin ===
        "function" &&
      authService.isAdmin()
    );
  }

  function isVisibleToCurrentUser(
    notification
  ) {
    const audience =
      notification.audience || "admin";

    const account =
      getCurrentNotificationAccount();

    if (audience === "admin") {
      return isCurrentNotificationAdmin();
    }

    if (audience !== "umpire") {
      return true;
    }

    const recipientAccountId =
      notification.recipientAccountId ||
      "";

    // Preserve existing assignment, claim, review,
    // and lifecycle notifications that predate
    // account-specific targeting.
    if (!recipientAccountId) {
      return true;
    }

    if (isCurrentNotificationAdmin()) {
      return false;
    }

    return (
      account &&
      String(account.id) ===
        String(recipientAccountId)
    );
  }

  function filterForCurrentUser(
    notifications
  ) {
    return notifications.filter(
      isVisibleToCurrentUser
    );
  }

  function sortNewestFirst(notifications) {
    return [...notifications].sort((a, b) => {
      const timestampDifference =
        String(b.createdAt || "").localeCompare(
          String(a.createdAt || "")
        );

      if (timestampDifference !== 0) {
        return timestampDifference;
      }

      return String(b.id || "").localeCompare(
        String(a.id || "")
      );
    });
  }

  function create({
    type = "general",
    title,
    message,
    relatedId = "",
    audience = "admin",
    recipientAccountId = "",
    destination = null,
    createdAt = ""
  } = {}) {
    if (!title || !message) {
      return {
        success: false,
        message: "Notification requires a title and message."
      };
    }

    const notifications = getAll();

    const notification = {
      id: `notification-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type,
      title,
      message,
      relatedId,
      audience,
      recipientAccountId:
        String(
          recipientAccountId || ""
        ),
      destination:
        destination &&
        typeof destination === "object"
          ? {
              page: destination.page || "",
              context:
                destination.context &&
                typeof destination.context ===
                  "object"
                  ? destination.context
                  : {}
            }
          : null,
      read: false,
      createdAt:
        createdAt ||
        new Date().toISOString()
    };

    notifications.push(notification);
    saveAll(notifications);

    return {
      success: true,
      message: "Notification created.",
      data: notification
    };
  }

  function getUnread() {
    return sortNewestFirst(
      filterForCurrentUser(
        getAll().filter(
          notification =>
            !notification.read
        )
      )
    );
  }

  function getRead() {
    return sortNewestFirst(
      filterForCurrentUser(
        getAll().filter(
          notification =>
            notification.read
        )
      )
    );
  }

  function getUnreadCount() {
    return getUnread().length;
  }

  function markAsRead(notificationId) {
    const notifications = getAll();
    const notification = notifications.find(item => item.id === notificationId);

    if (!notification) {
      return {
        success: false,
        message: "Notification not found."
      };
    }

    notification.read = true;
    saveAll(notifications);

    return {
      success: true,
      message: "Notification marked as read.",
      data: notification
    };
  }

  function markAllAsRead() {
    const notifications = getAll();

    notifications.forEach(notification => {
      notification.read = true;
    });

    saveAll(notifications);

    return {
      success: true,
      message: "All notifications marked as read."
    };
  }

  function clearRead() {
    const notifications = getAll();

    const unread = notifications.filter(
      notification =>
        notification.read !== true
    );

    const clearedCount =
      notifications.length -
      unread.length;

    saveAll(unread);

    return {
      success: true,
      message:
        "Read notifications cleared.",
      clearedCount
    };
  }

  function clearAll() {
    saveAll([]);

    return {
      success: true,
      message: "Notifications cleared."
    };
  }

  function getNotificationCenter() {
    const unread = getUnread();
    const read = getRead();

    return {
      unread,
      read,
      unreadCount: unread.length,
      readCount: read.length,
      totalCount:
        unread.length + read.length,
      isEmpty:
        unread.length === 0 &&
        read.length === 0
    };
  }

  function getNotifications(options = {}) {
    const status = options.status || "all";

    const notifications =
      sortNewestFirst(
        filterForCurrentUser(
          getAll()
        )
      );

    if (status === "unread") {
      return notifications.filter(notification => !notification.read);
    }

    if (status === "read") {
      return notifications.filter(notification => notification.read);
    }

    return notifications;
  }

  return {
    getAll,
    create,
    getUnread,
    getRead,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    clearRead,
    clearAll,
    getNotificationCenter,
    getNotifications
  };
})();