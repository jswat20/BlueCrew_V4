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
  "assignment-updated": {
    label: "View Game",
    page: "game-hub",
    context: relatedId => ({ gameId: relatedId })
  },
  "game-available": {
    label: "View Available Games",
    page: "claim-games",
    context: relatedId => ({ highlightId: relatedId })
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
    "assignment-updated": "Assignment",
    "game-available": "Available Game",
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

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(timestamp);
}

function formatNotificationDate(value) {
  const date = new Date(`${String(value || "").slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return String(value || "");
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function formatNotificationPositions(value) {
  return String(value || "")
    .replace(/\bPlate\b/g, presentationFormattingService.formatAssignmentPosition("Plate"))
    .replace(/\bBase\b/g, presentationFormattingService.formatAssignmentPosition("Base"));
}

function getNotificationGameIdentifier(game, notification) {
  if (!game) return notification.relatedId || "";
  const metadata = {
    year: game.year,
    seasonCode: game.seasonCode,
    organizationCode: game.organizationCode,
    leagueCode: game.leagueCode,
    canonicalLevel: game.canonicalLevel,
    level: game.level,
    sequence: game.sequence,
    gameNumber: game.gameNumber
  };
  const complete = metadata.year && metadata.seasonCode &&
    (metadata.organizationCode || metadata.leagueCode) &&
    (metadata.canonicalLevel || metadata.level) &&
    (metadata.sequence || metadata.gameNumber);
  return complete
    ? presentationFormattingService.formatGameIdentifier(metadata)
    : game.gameIdentifier || game.gameCode || notification.relatedId || game.id || "";
}

function getNotificationPresentation(notification) {
  const game = notification.relatedId && typeof gameService !== "undefined"
    ? gameService.getById(notification.relatedId)
    : null;
  const type = String(notification.type || "").toLowerCase();
  const gameIdentifier = getNotificationGameIdentifier(game, notification);
  const supporting = gameIdentifier ? `Game: ${gameIdentifier}` : "";

  if (["game-available", "game-added", "game_created", "game-created"].includes(type) && game) {
    return {
      title: "Game Added",
      message: [formatNotificationDate(game.date), dateTimeFormattingService.formatTime12Hour(game.time, "")]
        .filter(Boolean).join(" • "),
      supporting: [game.locationComplex || game.complex || "", supporting].filter(Boolean).join(" · ")
    };
  }

  if (type.includes("claim")) {
    return {
      title: type === "claim-submitted" || type === "claim" ? "Game Claimed" : notification.title,
      message: formatNotificationPositions(notification.message),
      supporting
    };
  }

  return {
    title: notification.title,
    message: formatNotificationPositions(notification.message),
    supporting
  };
}

function getNotificationAction(
  notification
) {
  if (notification.destination?.page) {
    const destination = typeof authorizationService !== "undefined" &&
      typeof authorizationService.resolveNotificationDestination === "function"
        ? authorizationService.resolveNotificationDestination(notification)
        : notification.destination;

    if (!destination) return null;

    return {
      label: "Open",
      page: destination.page,
      context: destination.context || {}
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
      class="button button-secondary"
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
  const presentation = getNotificationPresentation(notification);
  const selection =
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
            `;
  const actions = `
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
      `;
  return renderNotificationRow({
    notification,
    title: presentation.title,
    message: presentation.message,
    supporting: presentation.supporting,
    timestamp: formatNotificationTimestamp(notification.createdAt),
    selection,
    actions
  });
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
          ? "filter-chip responsive-chip active"
          : "filter-chip responsive-chip"
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
  const hydrationState = typeof notificationService.getNotificationHydrationState === "function"
    ? notificationService.getNotificationHydrationState()
    : { status: "ready", message: "" };
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
        { ...query, filter: "all", search: "", sort: "newest" }
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

  const selectedUnreadCount = notifications.filter(notification =>
    !notification.virtual &&
    notification.read !== true &&
    selectedIds.includes(String(notification.id))
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

      ${hydrationState.status === "error" ? `
        <div class="form-message error" data-testid="notification-hydration-error" role="status">
          <span>${escapeNotificationHtml(hydrationState.message || "Notifications could not be loaded.")}</span>
          <button type="button" class="button button-secondary" data-testid="notification-hydration-retry" onclick="retryNotificationHydration()">Retry</button>
        </div>
      ` : ""}

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
                class="notification-center-actions responsive-actions"
                data-testid="notification-bulk-actions"
              >
                <button
                  type="button"
                  class="button button-secondary"
                  data-testid="notifications-select-visible"
                  ${
                    visibleStoredIds.length
                      ? ""
                      : "disabled"
                  }
                  onclick="handleSelectVisibleNotifications()"
                >
                  Select All
                </button>

                <button
                  type="button"
                  class="button button-primary"
                  data-testid="notifications-mark-selected-read"
                  ${selectedUnreadCount ? "" : "disabled"}
                  onclick="handleMarkSelectedNotificationsRead()"
                >
                  Mark as Read
                </button>

                <button
                  type="button"
                  class="button button-secondary"
                  data-testid="notifications-clear-selection"
                  ${
                    selectedIds.length
                      ? ""
                      : "disabled"
                  }
                  onclick="handleClearNotificationSelection()"
                >
                  Clear Selections
                </button>

                <button
                  type="button"
                  class="button button-danger"
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
                  : ""
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

async function retryNotificationHydration() {
  const result = await notificationService.refreshAuthenticatedNotifications();
  refreshNotificationCenter();
  return result;
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

async function handleMarkSelectedNotificationsRead() {
  const ids =
    uiStateService
      .getSelectedNotificationIds();

  const result =
    await notificationService
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

async function handleDeleteSelectedNotifications() {
  const ids =
    uiStateService
      .getSelectedNotificationIds();

  const result =
    await notificationService
      .deleteBulk(ids);

  if (!result.success) {
    toastService?.error?.(result.message || "Selected notifications could not be deleted.");
    return;
  }

  uiStateService
    .clearNotificationSelection();

  refreshNotificationCenter();

  toastService?.success?.(result.message || "Selected notifications deleted.");

  announceToScreenReader(
    result.message ||
      "Selected notifications deleted."
  );

  focusElementWhenReady(
    '[data-testid="notifications-select-visible"]'
  );
}

async function handleMarkNotificationRead(
  notificationId
) {
  const result =
    await notificationService.markAsRead(
      notificationId
    );

  if (!result.success) return;

  refreshNotificationCenter();
}

async function handleMarkAllNotificationsRead() {
  const result =
    await notificationService
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

async function handleNotificationAction(
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
    await notificationService.markAsRead(
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
