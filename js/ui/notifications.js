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
      ${
        notification.virtual
          ? ""
          : `
              <label
                class="notification-selection"
              >
                <input
                  type="checkbox"
                  data-testid="notification-select"
                  data-notification-id="${escapeNotificationHtml(
                    notification.id
                  )}"
                  ${
                    uiStateService
                      .getSelectedNotificationIds()
                      .includes(
                        String(
                          notification.id
                        )
                      )
                      ? "checked"
                      : ""
                  }
                  onchange="handleNotificationSelection(
                    this.dataset.notificationId,
                    this.checked
                  )"
                >
                <span>Select</span>
              </label>
            `
      }

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

function getNotificationCenterQuery() {
  const filter =
    uiStateService
      .getNotificationFilter();

  const status =
    filter === "unread"
      ? "unread"
      : "all";

  const category = [
    "assignments",
    "claims",
    "reviews",
    "availability",
    "accounts"
  ].includes(filter)
    ? filter
    : "all";

  return {
    status,
    category,
    search:
      uiStateService
        .getNotificationSearch(),
    sort:
      uiStateService
        .getNotificationSort()
  };
}

function renderNotificationFilterChip(
  value,
  label
) {
  const active =
    uiStateService
      .getNotificationFilter() === value;

  return `
    <button
      type="button"
      class="${
        active
          ? "filter-chip active"
          : "filter-chip"
      }"
      data-testid="notification-filter-${value}"
      data-filter="${value}"
      aria-pressed="${
        active ? "true" : "false"
      }"
      onclick="handleNotificationFilter(
        this.dataset.filter
      )"
    >
      ${label}
    </button>
  `;
}

function renderNotifications() {
  const query =
    getNotificationCenterQuery();

  const stored =
    notificationService
      .getNotifications();

  const returned =
    getReturnedReviewNotifications();

  const notifications =
    notificationService
      .queryNotifications(
        [
          ...returned,
          ...stored
        ],
        query
      );

  const unreadCount =
    notificationService
      .getUnreadCount();

  const selectedIds =
    uiStateService
      .getSelectedNotificationIds();

  const visibleStoredIds =
    notifications
      .filter(
        notification =>
          !notification.virtual
      )
      .map(
        notification =>
          String(notification.id)
      );

  const selectedVisibleCount =
    visibleStoredIds.filter(id =>
      selectedIds.includes(id)
    ).length;

  const hasNotifications =
    [
      ...returned,
      ...stored
    ].length > 0;

  return `
    <section
      class="page-section"
      data-testid="notifications"
    >
      ${renderPageHeader({
        title: "Notification Center",
        subtitle:
          "Assignments, claims, reviews, and operational updates.",
        badge:
          `${unreadCount} unread`,
        badgeTestId:
          "notifications-unread-count"
      })}

      ${
        !hasNotifications
          ? `
              ${renderEmptyState({
                title:
                  "You're all caught up",
                message:
                  "New notifications will appear here.",
                testId:
                  "notifications-empty"
              })}
            `
          : `
              <div
                class="notification-productivity-controls"
                data-testid="notification-productivity-controls"
              >
                <div
                  class="filter-chip-group"
                  data-testid="notification-filters"
                >
                  ${renderNotificationFilterChip(
                    "all",
                    "All"
                  )}

                  ${renderNotificationFilterChip(
                    "unread",
                    "Unread"
                  )}

                  ${renderNotificationFilterChip(
                    "assignments",
                    "Assignments"
                  )}

                  ${renderNotificationFilterChip(
                    "claims",
                    "Claims"
                  )}

                  ${renderNotificationFilterChip(
                    "reviews",
                    "Reviews"
                  )}

                  ${renderNotificationFilterChip(
                    "availability",
                    "Availability"
                  )}

                  ${renderNotificationFilterChip(
                    "accounts",
                    "Accounts"
                  )}
                </div>

                <label>
                  Search notifications

                  <input
                    type="search"
                    data-testid="notification-search"
                    value="${escapeNotificationHtml(
                      uiStateService
                        .getNotificationSearch()
                    )}"
                    placeholder="Search title, message, actor, or game"
                    oninput="handleNotificationSearch(
                      this.value
                    )"
                  >
                </label>

                <label>
                  Sort

                  <select
                    data-testid="notification-sort"
                    onchange="handleNotificationSort(
                      this.value
                    )"
                  >
                    <option
                      value="newest"
                      ${
                        query.sort === "newest"
                          ? "selected"
                          : ""
                      }
                    >
                      Newest
                    </option>

                    <option
                      value="oldest"
                      ${
                        query.sort === "oldest"
                          ? "selected"
                          : ""
                      }
                    >
                      Oldest
                    </option>
                  </select>
                </label>
              </div>

              <div
                class="notification-center-actions"
                data-testid="notification-bulk-actions"
              >
                ${
                  unreadCount
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
                  data-testid="notifications-select-visible"
                  ${
                    visibleStoredIds.length
                      ? ""
                      : "disabled"
                  }
                  onclick="handleSelectVisibleNotifications()"
                >
                  Select All Visible
                </button>

                <button
                  type="button"
                  class="secondary-button"
                  data-testid="notifications-clear-selection"
                  ${
                    selectedIds.length
                      ? ""
                      : "disabled"
                  }
                  onclick="handleClearNotificationSelection()"
                >
                  Clear Selection
                </button>

                <button
                  type="button"
                  data-testid="notifications-mark-selected-read"
                  ${
                    selectedIds.length
                      ? ""
                      : "disabled"
                  }
                  onclick="handleMarkSelectedNotificationsRead()"
                >
                  Mark Selected Read
                </button>

                <button
                  type="button"
                  class="secondary-button"
                  data-testid="notifications-delete-selected"
                  ${
                    selectedIds.length
                      ? ""
                      : "disabled"
                  }
                  onclick="handleDeleteSelectedNotifications()"
                >
                  Delete Selected
                </button>

                <span
                  class="muted"
                  data-testid="notification-selection-count"
                >
                  ${selectedVisibleCount}
                  selected
                </span>
              </div>

              ${
                notifications.length
                  ? `
                      <div
                        class="dashboard-grid"
                        data-testid="notifications-list"
                      >
                        ${notifications
                          .map(
                            renderNotificationCard
                          )
                          .join("")}
                      </div>
                    `
                  : `
                      ${renderEmptyState({
                        title:
                          "No matching notifications",
                        message:
                          "Adjust the filters or search terms.",
                        testId:
                          "notifications-filtered-empty"
                      })}
                    `
              }
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

function handleNotificationFilter(
  filter
) {
  uiStateService
    .setNotificationFilter(filter);

  uiStateService
    .clearNotificationSelection();

  refreshNotificationCenter();
}

function handleNotificationSearch(
  search
) {
  uiStateService
    .setNotificationSearch(search);

  uiStateService
    .clearNotificationSelection();

  refreshNotificationCenter();
}

function handleNotificationSort(sort) {
  uiStateService
    .setNotificationSort(sort);

  refreshNotificationCenter();
}

function handleNotificationSelection(
  notificationId,
  selected
) {
  const ids =
    uiStateService
      .getSelectedNotificationIds();

  const next = selected
    ? [
        ...ids,
        String(notificationId)
      ]
    : ids.filter(
        id =>
          id !==
          String(notificationId)
      );

  uiStateService
    .setSelectedNotificationIds(next);

  refreshNotificationCenter();
}

function getVisibleStoredNotificationIds() {
  const query =
    getNotificationCenterQuery();

  return notificationService
    .getNotifications(query)
    .map(
      notification =>
        String(notification.id)
    );
}

function handleSelectVisibleNotifications() {
  uiStateService
    .setSelectedNotificationIds(
      getVisibleStoredNotificationIds()
    );

  refreshNotificationCenter();
}

function handleClearNotificationSelection() {
  uiStateService
    .clearNotificationSelection();

  refreshNotificationCenter();
}

function handleMarkSelectedNotificationsRead() {
  const ids =
    uiStateService
      .getSelectedNotificationIds();

  const result =
    notificationService
      .markAsReadBulk(ids);

  if (!result.success) return;

  uiStateService
    .clearNotificationSelection();

  refreshNotificationCenter();

  announceToScreenReader(
    result.message ||
      "Selected notifications marked as read."
  );

  focusElementWhenReady(
    '[data-testid="notifications-select-visible"]'
  );
}

function handleDeleteSelectedNotifications() {
  const ids =
    uiStateService
      .getSelectedNotificationIds();

  const result =
    notificationService
      .deleteBulk(ids);

  if (!result.success) return;

  uiStateService
    .clearNotificationSelection();

  refreshNotificationCenter();

  announceToScreenReader(
    result.message ||
      "Selected notifications deleted."
  );

  focusElementWhenReady(
    '[data-testid="notifications-select-visible"]'
  );
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

  announceToScreenReader(
    result.message ||
      "All notifications marked as read."
  );

  focusElementWhenReady(
    '[data-testid="notifications-select-visible"]'
  );
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
