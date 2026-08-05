const notificationService = (() => {
  const STORAGE_KEY = "bluecrew_notifications";
  const getRepository = () => repositoryProvider.get("notifications");

  function getAll() {
    try {
      const stored = getRepository().read();
      if (!stored) return [];
      const notifications = stored;
      return Array.isArray(notifications) ? notifications : [];
    } catch {
      return [];
    }
  }

  function saveAll(notifications) {
    getRepository().write(notifications);
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

    if (!recipientAccountId) {
      return false;
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
      value.includes("assignment") ||
      value === "game-available"
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
    createdAt = "",
    reminderKey = ""
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

    if (
      reminderKey &&
      notifications.some(
        notification =>
          String(notification.reminderKey || "") ===
          String(reminderKey)
      )
    ) {
      return {
        success: true,
        message:
          "Notification already exists.",
        data: notifications.find(
          notification =>
            String(notification.reminderKey || "") ===
            String(reminderKey)
        ),
        duplicate: true
      };
    }

    const currentAccount = getCurrentNotificationAccount();
    const resolvedRecipientAccountId = recipientAccountId ||
      (audience === "umpire" && !isCurrentNotificationAdmin() ? currentAccount?.id || "" : "");

    const notification = {
      id: `notification-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type,
      title,
      message,
      relatedId,
      audience,
      recipientAccountId:
        String(
          resolvedRecipientAccountId || ""
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
        new Date().toISOString(),
      reminderKey:
        String(reminderKey || "")
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

    if (!notification || !isVisibleToCurrentUser(notification)) {
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
      if (isVisibleToCurrentUser(notification)) notification.read = true;
    });

    saveAll(notifications);

    return {
      success: true,
      message: "All notifications marked as read."
    };
  }

  function clearRead() {
    const notifications = getAll();

    const unread = notifications.filter(notification =>
      !isVisibleToCurrentUser(notification) || notification.read !== true
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
        isVisibleToCurrentUser(notification) &&
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
          !isVisibleToCurrentUser(notification) || !ids.has(String(notification.id))
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


  function parseReminderGameTime(
    timeValue
  ) {
    const value =
      String(timeValue || "").trim();

    const twelveHour =
      value.match(
        /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i
      );

    if (twelveHour) {
      let hour = Number(twelveHour[1]);
      const minute = Number(twelveHour[2]);
      const period =
        twelveHour[3].toUpperCase();

      if (hour === 12) {
        hour = 0;
      }

      if (period === "PM") {
        hour += 12;
      }

      return {
        hour,
        minute
      };
    }

    const twentyFourHour =
      value.match(
        /^(\d{1,2}):(\d{2})$/
      );

    if (!twentyFourHour) {
      return null;
    }

    return {
      hour: Number(twentyFourHour[1]),
      minute: Number(twentyFourHour[2])
    };
  }

  function getReminderGameDateTime(
    game
  ) {
    const date =
      String(game?.date || "").trim();

    const time =
      parseReminderGameTime(
        game?.time
      );

    if (!date || !time) {
      return null;
    }

    const value =
      new Date(`${date}T00:00:00`);

    if (Number.isNaN(value.getTime())) {
      return null;
    }

    value.setHours(
      time.hour,
      time.minute,
      0,
      0
    );

    return value;
  }

  function isReminderAssignmentForCrew(
    game,
    crewId
  ) {
    if (
      typeof assignmentService ===
        "undefined" ||
      typeof assignmentService
        .getAssignments !==
        "function"
    ) {
      return false;
    }

    return assignmentService
      .getAssignments(game)
      .some(
        assignment =>
          String(assignment.crewId || "") ===
            String(crewId) &&
          [
            "assigned",
            "locked"
          ].includes(
            assignment.status
          )
      );
  }

  function getReminderWindow(
    millisecondsUntilGame
  ) {
    const hoursUntilGame =
      millisecondsUntilGame /
      (60 * 60 * 1000);

    if (
      hoursUntilGame < 0 ||
      hoursUntilGame > 24
    ) {
      return null;
    }

    if (hoursUntilGame <= 2) {
      return {
        key: "2h",
        title: "Game Starting Soon",
        messagePrefix:
          "Your game starts within 2 hours:"
      };
    }

    return {
      key: "24h",
      title: "Upcoming Game Reminder",
      messagePrefix:
        "You have a game within 24 hours:"
    };
  }

  function generateUpcomingGameReminders(
    nowValue = new Date()
  ) {
    const account =
      getCurrentNotificationAccount();

    if (
      !account ||
      !account.crewId ||
      isCurrentNotificationAdmin()
    ) {
      return {
        success: true,
        createdCount: 0,
        duplicateCount: 0
      };
    }

    if (
      typeof gameService === "undefined" ||
      typeof gameService.getAll !==
        "function"
    ) {
      return {
        success: false,
        message:
          "Game service is unavailable.",
        createdCount: 0,
        duplicateCount: 0
      };
    }

    const now =
      nowValue instanceof Date
        ? nowValue
        : new Date(nowValue);

    if (Number.isNaN(now.getTime())) {
      return {
        success: false,
        message:
          "Invalid reminder time.",
        createdCount: 0,
        duplicateCount: 0
      };
    }

    let createdCount = 0;
    let duplicateCount = 0;

    gameService
      .getAll()
      .filter(
        game =>
          isReminderAssignmentForCrew(
            game,
            account.crewId
          )
      )
      .filter(
        game =>
          ![
            "completed",
            "submitted",
            "approved",
            "cancelled"
          ].includes(
            typeof gameService.getStatus ===
              "function"
              ? gameService.getStatus(game)
              : game.status
          )
      )
      .forEach(game => {
        const gameDateTime =
          getReminderGameDateTime(game);

        if (!gameDateTime) {
          return;
        }

        const window =
          getReminderWindow(
            gameDateTime.getTime() -
            now.getTime()
          );

        if (!window) {
          return;
        }

        const reminderKey = [
          "assignment-reminder",
          account.id,
          game.id,
          window.key
        ].join(":");

        const result = create({
          type:
            `assignment-reminder-${window.key}`,
          title: window.title,
          message:
            `${window.messagePrefix} ` +
            `${game.awayTeam || "Away"} @ ` +
            `${game.homeTeam || "Home"} on ` +
            `${game.date} at ${game.time}.`,
          relatedId: game.id,
          audience: "umpire",
          recipientAccountId:
            account.id,
          reminderKey,
          destination: {
            page: "game-hub",
            context: {
              gameId: game.id
            }
          }
        });

        if (result.duplicate) {
          duplicateCount += 1;
        } else if (
          result.success &&
          !result.suppressed
        ) {
          createdCount += 1;
        }
      });

    return {
      success: true,
      createdCount,
      duplicateCount
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
    isCategoryEnabled,
    generateUpcomingGameReminders
  };
})();
