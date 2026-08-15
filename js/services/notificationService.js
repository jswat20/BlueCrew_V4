const notificationService = (() => {
  const STORAGE_KEY = "bluecrew_notifications";
  const getRepository = () => repositoryProvider.get("notifications");
  let authenticatedNotifications = null;
  let notificationHydrationState = { status: "idle", message: "" };

  function isSupabaseNotificationMode() {
    return typeof supabaseClientService !== "undefined" && supabaseClientService.isConfigured();
  }

  function cloneNotifications(notifications) {
    return structuredClone(Array.isArray(notifications) ? notifications : []);
  }

  function mapSupabaseNotification(row) {
    const destinationContext = row.destination_context && typeof row.destination_context === "object"
      ? structuredClone(row.destination_context)
      : {};
    return {
      id: row.id,
      organizationId: row.organization_id,
      type: row.type || "",
      audience: row.audience || "account",
      recipientProfileId: row.recipient_profile_id || "",
      recipientAccountId: row.recipient_profile_id || "",
      title: row.title || "",
      message: row.message || "",
      relatedId: row.related_legacy_id || "",
      destinationPage: row.destination_page || "",
      destinationContext,
      destination: row.destination_page
        ? { page: row.destination_page, context: destinationContext }
        : null,
      reminderKey: row.reminder_key || "",
      read: Boolean(row.read_at),
      readAt: row.read_at || null,
      createdAt: row.created_at || ""
    };
  }

  async function hydrateAuthenticatedNotifications() {
    if (!isSupabaseNotificationMode()) {
      notificationHydrationState = { status: "ready", message: "" };
      return { success: true, message: "Local notifications ready.", data: getAll() };
    }
    notificationHydrationState = { status: "loading", message: "" };
    let result;
    try {
      result = await supabaseNotificationRepository.getNotifications();
    } catch (error) {
      notificationHydrationState = { status: "error", message: error?.message || "Notifications could not be loaded." };
      return { success: false, message: notificationHydrationState.message };
    }
    if (result.error) {
      notificationHydrationState = { status: "error", message: result.error.message || "Notifications could not be loaded." };
      return { success: false, message: notificationHydrationState.message };
    }
    const mapped = (result.data || [])
      .map(mapSupabaseNotification)
      .sort((left, right) => `${right.createdAt}\u0000${right.id}`.localeCompare(`${left.createdAt}\u0000${left.id}`));
    authenticatedNotifications = cloneNotifications(mapped);
    notificationHydrationState = { status: "ready", message: "" };
    return { success: true, message: "Notifications loaded.", data: getAll() };
  }

  function refreshAuthenticatedNotifications() {
    return hydrateAuthenticatedNotifications();
  }

  function clearAuthenticatedNotifications() {
    authenticatedNotifications = null;
    notificationHydrationState = { status: "idle", message: "" };
  }

  function getNotificationHydrationState() {
    return { ...notificationHydrationState };
  }

  function getAll() {
    if (isSupabaseNotificationMode()) return cloneNotifications(authenticatedNotifications || []);
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
    if (isSupabaseNotificationMode()) return false;
    getRepository().write(notifications);
    return true;
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

    if (audience === "account") {
      const recipientAccountId = notification.recipientAccountId || notification.recipientProfileId || "";
      return Boolean(account && recipientAccountId && String(account.id) === String(recipientAccountId));
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
    if (isSupabaseNotificationMode()) {
      return {
        success: false,
        message: "Notification creation is managed by the shared backend."
      };
    }
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

  async function markAuthenticatedNotificationRead(notificationId) {
    const current = getAll();
    const notification = current.find(item => String(item.id) === String(notificationId));
    if (!notification || !isVisibleToCurrentUser(notification)) {
      return { success: false, message: "Notification not found." };
    }
    if (notification.read) {
      return { success: true, message: "Notification already read.", data: notification };
    }
    const result = await supabaseNotificationRepository.markRead(notification.id);
    if (result.error) return { success: false, message: result.error.message || "Notification could not be marked as read." };
    const readAt = new Date().toISOString();
    authenticatedNotifications = current.map(item => String(item.id) === String(notification.id)
      ? { ...item, read: true, readAt }
      : item);
    return { success: true, message: "Notification marked as read.", data: getAll().find(item => String(item.id) === String(notification.id)) };
  }

  async function markAllAuthenticatedNotificationsRead() {
    const current = getAll();
    const result = await supabaseNotificationRepository.markAllRead();
    if (result.error) return { success: false, message: result.error.message || "Notifications could not be marked as read." };
    const readAt = new Date().toISOString();
    authenticatedNotifications = current.map(notification => notification.read
      ? notification
      : { ...notification, read: true, readAt });
    return { success: true, message: "All notifications marked as read." };
  }

  async function markAuthenticatedNotificationsReadBulk(notificationIds = []) {
    const ids = new Set(notificationIds.map(String));
    const targets = getAll().filter(notification => ids.has(String(notification.id)) && !notification.read);
    if (!targets.length) return { success: true, message: "Selected notifications marked as read.", data: { updatedCount: 0 } };
    const results = await Promise.all(targets.map(notification => supabaseNotificationRepository.markRead(notification.id)));
    const failure = results.find(result => result.error);
    if (failure) return { success: false, message: failure.error.message || "Selected notifications could not be marked as read." };
    const readAt = new Date().toISOString();
    authenticatedNotifications = getAll().map(notification => ids.has(String(notification.id))
      ? { ...notification, read: true, readAt: notification.readAt || readAt }
      : notification);
    return { success: true, message: "Selected notifications marked as read.", data: { updatedCount: targets.length } };
  }

  async function deleteAuthenticatedNotificationsBulk(notificationIds = []) {
    const ids = new Set(notificationIds.map(String));
    const targets = getAll().filter(notification => ids.has(String(notification.id)));
    if (!targets.length) return { success: true, message: "Selected notifications deleted.", data: { deletedCount: 0 } };
    let result;
    try {
      result = await supabaseNotificationRepository.deleteMany(targets.map(notification => notification.id));
    } catch (error) {
      return { success: false, message: error?.message || "Selected notifications could not be deleted." };
    }
    if (result.error) return { success: false, message: result.error.message || "Selected notifications could not be deleted." };
    const refresh = await hydrateAuthenticatedNotifications();
    if (!refresh.success) return { success: false, message: "Notifications were deleted, but the notification center could not be refreshed. Please reload." };
    const remainingIds = new Set(getAll().map(notification => String(notification.id)));
    const deletedCount = targets.filter(notification => !remainingIds.has(String(notification.id))).length;
    if (deletedCount !== targets.length) return { success: false, message: "Some selected notifications could not be deleted." };
    return { success: true, message: "Selected notifications deleted.", data: { deletedCount } };
  }

  function markAsRead(notificationId) {
    if (isSupabaseNotificationMode()) return markAuthenticatedNotificationRead(notificationId);
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
    if (isSupabaseNotificationMode()) return markAllAuthenticatedNotificationsRead();
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
    if (isSupabaseNotificationMode()) return { success: false, message: "Deleting shared notifications is not available." };
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
    if (isSupabaseNotificationMode()) return { success: false, message: "Deleting shared notifications is not available." };
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
    if (isSupabaseNotificationMode()) return markAuthenticatedNotificationsReadBulk(notificationIds);
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
    if (isSupabaseNotificationMode()) return deleteAuthenticatedNotificationsBulk(notificationIds);
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
      hoursUntilGame <= 0 ||
      hoursUntilGame > 24
    ) {
      return null;
    }

    if (hoursUntilGame <= 0.5) {
      return {
        key: "30-minute",
        type: "game-reminder-30-minute"
      };
    }

    if (hoursUntilGame <= 2) {
      return {
        key: "2-hour",
        type: "game-reminder-2-hour"
      };
    }

    return {
      key: "24-hour",
      type: "game-reminder-24-hour"
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

        const assignment = assignmentService.getAssignments(game).find(item =>
          String(item.crewId || "") === String(account.crewId) && ["assigned", "locked"].includes(item.status));
        const reminderKey = [window.type, game.id, assignment?.id || account.crewId, account.id].join(":");
        const result = communicationService.publish({
          type: window.type, organizationId: account.organizationId || "local", recipientProfileId: account.id,
          subjectEntityType: "assignment", subjectEntityId: assignment?.id || game.id, gameId: game.id,
          assignmentId: assignment?.id || "", occurredAt: now.toISOString(), idempotencyKey: reminderKey,
          metadata: { gameDisplay: presentationFormattingService.formatGameIdentifier(game), level: game.level,
            divisionAlias: levelTerminologyService.aliasFor(game.level), date: game.date, time: game.time,
            location: game.locationComplex, field: game.locationField || game.field, position: assignment?.position || "",
            actionPath: "my-schedule", reminderWindow: window.key }
        });
        const inApp = result.data?.deliveries?.find(delivery => delivery.channel === "in_app");

        if (inApp?.duplicate) {
          duplicateCount += 1;
        } else if (result.success && inApp?.status === "sent") {
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
    hydrateAuthenticatedNotifications,
    refreshAuthenticatedNotifications,
    clearAuthenticatedNotifications,
    getNotificationHydrationState,
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
