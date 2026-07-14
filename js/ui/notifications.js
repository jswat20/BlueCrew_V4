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
  "review-submitted": {
    label: "Review Game",
    page: "game-hub",
    context: relatedId => ({
      gameId: relatedId,
      reviewMode: true
    })
  },
  "review-approved": {
    label: "View Game",
    page: "game-hub",
    context: relatedId => ({
      gameId: relatedId
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
  },
  "availability-saved": {
    label: "View Availability",
    page: "availability",
    context: relatedId => ({
      crewId: relatedId
    })
  },
  "availability-conflict": {
    label: "Review Availability",
    page: "availability",
    context: relatedId => ({
      crewId: relatedId
    })
  },
  "availability-weekend": {
    label: "View Availability",
    page: "availability",
    context: relatedId => ({
      crewId: relatedId
    })
  },
  "availability-range": {
    label: "View Availability",
    page: "availability",
    context: relatedId => ({
      crewId: relatedId
    })
  },
  "availability-copy": {
    label: "View Availability",
    page: "availability",
    context: relatedId => ({
      crewId: relatedId
    })
  },
  "account-approved": {
    label: "Open Profile",
    page: "profile",
    context: () => ({})
  },
  "account-rejected": {
    label: "Open Profile",
    page: "profile",
    context: () => ({})
  }
};

function escapeNotificationHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getReturnedReviewNotifications() {
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
          "",
        virtual: true
      };
    })
    .sort((a, b) =>
      String(b.createdAt || "").localeCompare(
        String(a.createdAt || "")
      )
    );
}

function formatNotificationType(type) {
  return {
    assignment: "Assignment",
    claim: "Claim",
    "claim-submitted": "Claim",
    "claim-approved": "Claim",
    "claim-rejected": "Claim",
    "review-submitted": "Review",
    "review-approved": "Review",
    "returned-review": "Review",
    "availability-saved": "Availability",
    "availability-conflict": "Availability",
    "availability-weekend": "Availability",
    "availability-range": "Availability",
    "availability-copy": "Availability",
    "account-approved": "Account",
    "account-rejected": "Account"
  }[type] || "General";
}

function formatNotificationTimestamp(
  createdAt
) {
  if (!createdAt) return "";

  const timestamp = new Date(createdAt);

  if (
    Number.isNaN(timestamp.getTime())
  ) {
    return "";
  }

  return timestamp.toLocaleString();
}

function getNotificationAction(
  notification
) {
  if (notification.destination?.page) {
    return {
      label: "Open",
      page: notification.destination.page,
      context:
        notification.destination.context ||
        {}
    };
  }

  const configured =
    notificationActionConfig[
      notification.type
    ];

  if (!configured) return null;

  return {
    label: configured.label,
    page: configured.page,
    context: configured.context
      ? configured.context(
          notification.relatedId
        )
      : {}
  };
}

function renderNotificationAction(
  notification
) {
  const action =
    getNotificationAction(notification);

  if (!action) return "";

  return `
    <button
      type="button"
      class="secondary-button"
      data-testid="notification-action"
      data-notification-id="${escapeNotificationHtml(
        notification.id
      )}"
      data-notification-type="${escapeNotificationHtml(
        notification.type
      )}"
      data-related-id="${escapeNotificationHtml(
        notification.relatedId || ""
      )}"
      onclick="handleNotificationAction(
        this.dataset.notificationType,
        this.dataset.relatedId,
        this.dataset.notificationId
      )"
    >
      ${escapeNotificationHtml(
        action.label
      )}
    </button>
  `;
}

function renderNotificationCard(
  notification
) {
  return `
    <article
      class="dashboard-card notification-card"
      data-testid="notification-card"
      data-notification-id="${escapeNotificationHtml(
        notification.id
      )}"
      data-notification-status="${
        notification.read
          ? "read"
          : "unread"
      }"
    >
      <div class="section-header">
        <span
          class="status-pill"
          data-testid="notification-type"
        >
          ${escapeNotificationHtml(
            formatNotificationType(
              notification.type
            )
          )}
        </span>

        <time
          class="muted"
          data-testid="notification-timestamp"
        >
          ${escapeNotificationHtml(
            formatNotificationTimestamp(
              notification.createdAt
            )
          )}
        </time>
      </div>

      <h3>
        ${escapeNotificationHtml(
          notification.title
        )}
      </h3>

      <p>
        ${escapeNotificationHtml(
          notification.message
        )}
      </p>

      <div class="notification-card-actions">
        ${renderNotificationAction(
          notification
        )}

        ${
          notification.read ||
          notification.virtual
            ? ""
            : `
              <button
                type="button"
                data-testid="notification-mark-read"
                data-notification-id="${escapeNotificationHtml(
                  notification.id
                )}"
                onclick="handleMarkNotificationRead(
                  this.dataset.notificationId
                )"
              >
                Mark Read
              </button>
            `
        }
      </div>
    </article>
  `;
}

function renderNotificationSection(
  title,
  notifications,
  testId,
  emptyMessage
) {
  return `
    <section
      class="page-section"
      data-testid="${testId}"
    >
      <div class="section-header">
        <h2>${title}</h2>
        <span class="status-pill">
          ${notifications.length}
        </span>
      </div>

      ${
        notifications.length
          ? `
            <div
              class="dashboard-grid"
              data-testid="${testId}-list"
            >
              ${notifications
                .map(renderNotificationCard)
                .join("")}
            </div>
          `
          : `
            <p
              class="muted"
              data-testid="${testId}-empty"
            >
              ${emptyMessage}
            </p>
          `
      }
    </section>
  `;
}

function renderNotifications() {
  const stored =
    notificationService
      .getNotificationCenter();

  const returned =
    getReturnedReviewNotifications();

  const unread = [
    ...returned,
    ...stored.unread
  ].sort((a, b) =>
    String(b.createdAt || "").localeCompare(
      String(a.createdAt || "")
    )
  );

  const read = stored.read;

  const unreadCount = unread.length;
  const isEmpty =
    unreadCount === 0 &&
    read.length === 0;

  return `
    <section
      class="page-section"
      data-testid="notifications"
    >
      <div class="section-header">
        <div>
          <h2>Notification Center</h2>
          <p class="muted">
            Assignments, claims, reviews,
            and operational updates.
          </p>
        </div>

        <span
          class="status-pill"
          data-testid="notifications-unread-count"
        >
          ${unreadCount} unread
        </span>
      </div>

      ${
        isEmpty
          ? `
            <div
              class="empty-state"
              data-testid="notifications-empty"
            >
              <h3>You're all caught up</h3>
              <p>
                New notifications will
                appear here.
              </p>
            </div>
          `
          : `
            <div
              class="notification-center-actions"
            >
              ${
                stored.unreadCount
                  ? `
                    <button
                      type="button"
                      data-testid="notifications-mark-all-read"
                      onclick="handleMarkAllNotificationsRead()"
                    >
                      Mark All Read
                    </button>
                  `
                  : ""
              }

              <button
                type="button"
                class="secondary-button"
                data-testid="notifications-clear-read"
                ${
                  stored.readCount
                    ? ""
                    : "disabled"
                }
                onclick="handleClearReadNotifications()"
              >
                Clear Read
              </button>
            </div>

            ${renderNotificationSection(
              "Unread",
              unread,
              "notifications-unread",
              "No unread notifications."
            )}

            ${renderNotificationSection(
              "Read",
              read,
              "notifications-read",
              "No read notifications."
            )}
          `
      }
    </section>
  `;
}

function refreshNotificationCenter() {
  renderPage(
    "notifications",
    currentPageContext || {}
  );

  if (
    typeof updateNotificationBadge ===
      "function"
  ) {
    updateNotificationBadge();
  }
}

function handleMarkNotificationRead(
  notificationId
) {
  const result =
    notificationService.markAsRead(
      notificationId
    );

  if (!result.success) return;

  refreshNotificationCenter();
}

function handleMarkAllNotificationsRead() {
  const result =
    notificationService
      .markAllAsRead();

  if (!result.success) return;

  refreshNotificationCenter();
}

function handleClearReadNotifications() {
  const result =
    notificationService.clearRead();

  if (!result.success) return;

  refreshNotificationCenter();
}

function handleNotificationAction(
  type,
  relatedId,
  notificationId = ""
) {
  let notification = null;

  if (notificationId) {
    notification = [
      ...getReturnedReviewNotifications(),
      ...notificationService
        .getNotifications()
    ].find(
      item =>
        String(item.id) ===
        String(notificationId)
    );
  }

  if (
    notification &&
    !notification.virtual &&
    !notification.read
  ) {
    notificationService.markAsRead(
      notification.id
    );
  }

  const action = notification
    ? getNotificationAction(notification)
    : notificationActionConfig[type]
      ? {
          label:
            notificationActionConfig[type]
              .label,
          page:
            notificationActionConfig[type]
              .page,
          context:
            notificationActionConfig[type]
              .context
              ? notificationActionConfig[type]
                  .context(relatedId)
              : {}
        }
      : null;

  if (!action) return;

  navigateTo(
    action.page,
    action.context || {}
  );
}
