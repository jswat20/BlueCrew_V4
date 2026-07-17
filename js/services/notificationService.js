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
    return notifications
      .map((notification, index) => ({
        notification,
        index
      }))
      .sort((a, b) => {
        const timestampDifference =
          String(
            b.notification.createdAt || ""
          ).localeCompare(
            String(
              a.notification.createdAt || ""
            )
          );

        if (timestampDifference !== 0) {
          return timestampDifference;
        }

        return b.index - a.index;
      })
      .map(item => item.notification);
  }

  function getNotificationCategory(type) {
    const value = String(type || "");

    if (
      value === "returned-review"
    ) {
      return "returnedReview";
    }

    if (
      value.includes("assignment")
    ) {
      return "assignments";
    }

    if (value.includes("claim")) {
      return "claims";
    }

    if (value.includes("review")) {
      return "reviews";
    }

    if (
      value.includes("availability")
    ) {
      return "availability";
    }

    if (value.includes("account")) {
      return "accounts";
    }

    if (
      value.includes("activity") ||
      value.includes("digest")
    ) {
      return "activityDigest";
    }

    return "";
  }

  function getCommunicationPreferences() {
    if (
      typeof loginService === "undefined" ||
      typeof loginService.getCurrentAccount !==
        "function"
    ) {
      return {};
    }

    const account =
      loginService.getCurrentAccount();

    return (
      account?.communicationPreferences ||
      {}
    );
  }

  function isCategoryEnabled(type) {
    const category =
      getNotificationCategory(type);

    // Preserve the existing returned-review
    // workflow regardless of review preference.
    if (category === "returnedReview") {
      return true;
    }

    if (!category) {
      return true;
    }

    const preferences =
      getCommunicationPreferences();

    return preferences[category] !== false;
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

    if (!isCategoryEnabled(type)) {
      return {
        success: true,
        message:
          "Notification muted by user preference.",
        data: null,
        suppressed: true
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

  function getNotificationSearchText(
    notification
  ) {
    return [
      notification.title,
      notification.message,
      notification.actor,
      notification.actorName,
      notification.gameText,
      notification.matchup,
      notification.homeTeam,
      notification.awayTeam,
      notification.relatedId
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function sortNotifications(
    notifications,
    sort
  ) {
    if (sort !== "oldest") {
      return sortNewestFirst(
        notifications
      );
    }

    return sortNewestFirst(
      notifications
    ).reverse();
  }

  function queryNotifications(
    notifications = [],
    options = {}
  ) {
    const {
      status = "all",
      category = "all",
      search = "",
      sort = "newest"
    } = options;

    const query =
      String(search)
        .trim()
        .toLowerCase();

    const filtered =
      notifications.filter(
        notification => {
          if (
            status === "unread" &&
            notification.read
          ) {
            return false;
          }

          if (
            status === "read" &&
            !notification.read
          ) {
            return false;
          }

          if (
            category !== "all" &&
            getNotificationCategory(
              notification.type
            ) !== category
          ) {
            return false;
          }

          if (
            query &&
            !getNotificationSearchText(
              notification
            ).includes(query)
          ) {
            return false;
          }

          return true;
        }
      );

    return sortNotifications(
      filtered,
      sort
    );
  }

  function getNotifications(options = {}) {
    return queryNotifications(
      filterForCurrentUser(
        getAll()
      ),
      options
    );
  }

  function getUnreadByCategory() {
    return getNotifications({
      status: "unread"
    }).reduce(
      (summary, notification) => {
        const category =
          getNotificationCategory(
            notification.type
          ) || "other";

        summary[category] =
          (summary[category] || 0) + 1;

        return summary;
      },
      {}
    );
  }

  function getOldestUnread() {
    return getNotifications({
      status: "unread",
      sort: "oldest"
    })[0] || null;
  }

  function markAsReadBulk(
    notificationIds = []
  ) {
    const ids = new Set(
      notificationIds.map(String)
    );

    const notifications = getAll();
    let updatedCount = 0;

    notifications.forEach(notification => {
      if (
        ids.has(
          String(notification.id)
        ) &&
        !notification.read
      ) {
        notification.read = true;
        updatedCount += 1;
      }
    });

    saveAll(notifications);

    return {
      success: true,
      message:
        "Selected notifications marked as read.",
      data: {
        updatedCount
      }
    };
  }

  function deleteBulk(
    notificationIds = []
  ) {
    const ids = new Set(
      notificationIds.map(String)
    );

    const notifications = getAll();

    const remaining =
      notifications.filter(
        notification =>
          !ids.has(
            String(notification.id)
          )
      );

    const deletedCount =
      notifications.length -
      remaining.length;

    saveAll(remaining);

    return {
      success: true,
      message:
        "Selected notifications deleted.",
      data: {
        deletedCount
      }
    };
  }

  return {
    getAll,
    create,
    getUnread,
    getRead,
    getUnreadCount,
    markAsRead,
    markAsReadBulk,
    markAllAsRead,
    deleteBulk,
    clearRead,
    clearAll,
    getNotificationCenter,
    getNotifications,
    queryNotifications,
    getUnreadByCategory,
    getOldestUnread,
    getNotificationCategory,
    isCategoryEnabled
  };
})();
