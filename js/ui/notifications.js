let selectedNotificationStatus = "all";

const notificationActionConfig = {
  claim: {
    label: "View Claim",
    page: "claims-queue",
    context: relatedId => ({
      highlightId: relatedId
    })
  },
  "claim-submitted": {
    label: "View Claim",
    page: "claims-queue",
    context: relatedId => ({
      highlightId: relatedId
    })
  },
  "claim-approved": {
    label: "View Assignment",
    page: "schedule",
    context: relatedId => ({
      highlightId: relatedId
    })
  },
  "claim-rejected": {
    label: "View History",
    page: "claim-history",
    context: relatedId => ({
      highlightId: relatedId
    })
  },
  "returned-review": {
    label: "Resume Review",
    page: "game-hub",
    context: relatedId => ({
      gameId: relatedId
    })
  },

  assignment: {
    label: "View Assignment",
    page: "game-hub",
    context: relatedId => ({
      gameId: relatedId
    })
  }
};
function getReturnedReviewNotifications() {
  if (selectedNotificationStatus === "read") {
    return [];
  }

  if (
    typeof reviewService === "undefined" ||
    typeof reviewService
      .getReturnedGamesForCurrentUmpire !==
      "function"
  ) {
    return [];
  }

  return reviewService
    .getReturnedGamesForCurrentUmpire()
    .map(game => {
      const review = game.review || {};

      return {
        id: `returned-${game.id}`,
        type: "returned-review",
        title: "Returned Review",
        message:
          review.returnReason ||
          "This game was returned for corrections.",
        relatedId: game.id,
        audience: "umpire",
        read: false,
        createdAt:
          review.reviewedAt ||
          review.submittedAt ||
          ""
      };
    });
}

function renderNotifications() {
  const notifications = [
  ...getReturnedReviewNotifications(),
  ...notificationService.getNotifications({
    status: selectedNotificationStatus
  })
].sort(/* newest first */);


  if (!notifications.length) {
    return `
      <section class="page-section" data-testid="notifications">
        <h2>Notifications</h2>

        ${renderNotificationFilters()}

        <div class="empty-state" data-testid="notifications-empty">
          You have no notifications.
        </div>
      </section>
    `;
  }

  return `
    <section class="page-section" data-testid="notifications">
      <h2>Notifications</h2>

      ${renderNotificationFilters()}
      ${renderMarkAllNotificationsReadButton()}

      <div data-testid="notifications-list">
        ${notifications.map(renderNotificationCard).join("")}
      </div>
    </section>
  `;
}

function renderNotificationFilters() {
  return `
    <div class="filter-group" data-testid="notification-filters">
      <button
        type="button"
        data-testid="notification-filter-all"
        class="${selectedNotificationStatus === "all" ? "active" : ""}"
        onclick="setNotificationFilter('all')"
      >
        All
      </button>

      <button
        type="button"
        data-testid="notification-filter-unread"
        class="${selectedNotificationStatus === "unread" ? "active" : ""}"
        onclick="setNotificationFilter('unread')"
      >
        Unread
      </button>

      <button
        type="button"
        data-testid="notification-filter-read"
        class="${selectedNotificationStatus === "read" ? "active" : ""}"
        onclick="setNotificationFilter('read')"
      >
        Read
      </button>
    </div>
  `;
}

function renderMarkAllNotificationsReadButton() {
  if (!notificationService.getUnreadCount()) return "";

  return `
    <button
      type="button"
      data-testid="notifications-mark-all-read"
      onclick="handleMarkAllNotificationsRead()"
    >
      Mark All as Read
    </button>
  `;
}

function renderNotificationCard(notification) {
  return `
    <article class="notification-card" data-testid="notification-card">
      <h3>${notification.title}</h3>

      <p>${notification.message}</p>

      <p data-testid="notification-timestamp">
        ${formatNotificationTimestamp(notification.createdAt)}
      </p>

      ${renderNotificationAction(notification)}

      ${
        notification.read
          ? ""
          : `
            <button
              type="button"
              data-testid="notification-mark-read"
              data-notification-id="${notification.id}"
              onclick="handleMarkNotificationRead(this.dataset.notificationId)"
            >
              Mark as Read
            </button>
          `
      }
    </article>
  `;
}

function getNotificationAction(type) {
  return notificationActionConfig[type] || null;
}

function renderNotificationAction(notification) {
  const action = getNotificationAction(notification.type);

  if (!action) return "";

  return `
    <button
      type="button"
      data-testid="notification-action"
      data-notification-type="${notification.type}"
      data-related-id="${notification.relatedId || ""}"
      onclick="handleNotificationAction(
        this.dataset.notificationType,
        this.dataset.relatedId
      )"
    >
      ${action.label}
    </button>
  `;
}

function handleNotificationAction(type, relatedId) {
  const action = getNotificationAction(type);

  if (!action) return;

  const context = action.context
    ? action.context(relatedId)
    : {};

  navigateTo(action.page, context);
}

function setNotificationFilter(status) {
  selectedNotificationStatus = status;
  renderPage("notifications");
}

function formatNotificationTimestamp(createdAt) {
  if (!createdAt) return "";

  return new Date(createdAt).toLocaleString();
}

function handleMarkNotificationRead(notificationId) {
  const result = notificationService.markAsRead(notificationId);

  if (!result.success) return;

  renderPage("notifications");
}

function handleMarkAllNotificationsRead() {
  const result = notificationService.markAllAsRead();

  if (!result.success) return;

  renderPage("notifications");
}
