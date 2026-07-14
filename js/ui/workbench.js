function escapeWorkbenchHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getWorkbenchItemLabel(item) {
  if (!item || typeof item !== "object") {
    return "";
  }

  if (item.matchup) {
    return item.matchup;
  }

  if (item.awayTeam || item.homeTeam) {
    return `${item.awayTeam || ""} @ ${item.homeTeam || ""}`;
  }

  if (item.claimedByName) {
    return `${item.claimedByName}${
      item.position ? ` — ${item.position}` : ""
    }`;
  }

  return (
    item.title ||
    item.message ||
    item.game ||
    item.name ||
    item.id ||
    "View details"
  );
}

function getWorkbenchItemDetail(item) {
  if (!item || typeof item !== "object") {
    return "";
  }

  return [
    item.date,
    item.time,
    item.field || item.venue,
    item.level
  ]
    .filter(Boolean)
    .join(" · ");
}

function handleWorkbenchAction(
  type,
  payload = {},
  origin = ""
) {
  const gameId =
    payload.gameId ||
    payload.id ||
    "";

  const originContext =
    origin === "operations-center"
      ? {
          origin: "operations-center",
          returnPage: "operations-center"
        }
      : {};

  switch (type) {
    case "needs-assignment":
      if (
        typeof uiStateService !== "undefined" &&
        typeof uiStateService.setScheduleFilter ===
          "function"
      ) {
        uiStateService.setScheduleFilter("open");
      }

      if (
        typeof currentScheduleView !== "undefined"
      ) {
        currentScheduleView = "all";
      }

      window.navigateTo("schedule", {
        filter: "open",
        gameId,
        assignmentId:
          payload.assignmentId ||
          payload.assignment?.id ||
          "",
        ...originContext
      });
      return;

    case "pending-claim":
      window.navigateTo("claims-queue", {
        status: "pending",
        assignmentId:
          payload.assignmentId ||
          payload.assignment?.id ||
          "",
        gameId,
        ...originContext
      });
      return;

    case "awaiting-review":
      window.navigateTo("review-queue", {
        filter: "submitted",
        status: "submitted",
        gameId,
        ...originContext
      });
      return;

    case "returned-review":
      window.navigateTo("review-queue", {
        filter: "returned",
        status: "returned",
        gameId,
        ...originContext
      });
      return;

    case "today-priority":
      if (gameId) {
        window.navigateTo("game-hub", {
          gameId,
          ...originContext
        });
        return;
      }

      window.navigateTo("season-dashboard", {
        focus: "today",
        ...originContext
      });
      return;

    case "activity":
      if (gameId) {
        window.navigateTo("game-hub", {
          gameId,
          ...originContext
        });
        return;
      }

      window.navigateTo(
        "notifications",
        originContext
      );
      return;

    default:
      return;
  }
}

function renderWorkbenchItem(
  item,
  action,
  testid
) {
  const label =
    getWorkbenchItemLabel(item);

  const detail =
    getWorkbenchItemDetail(item);

  const payload = {
    id: item?.id || "",
    gameId:
      item?.gameId ||
      item?.game?.id ||
      item?.id ||
      "",
    assignmentId:
      item?.assignmentId ||
      item?.assignment?.id ||
      ""
  };

  return `
    <li class="workbench-item">
      <button
        type="button"
        class="workbench-item-action"
        data-testid="${escapeWorkbenchHtml(
          testid
        )}-item"
        onclick='handleWorkbenchAction(
          ${JSON.stringify(action)},
          ${JSON.stringify(payload)}
        )'
      >
        <strong>
          ${escapeWorkbenchHtml(label)}
        </strong>

        ${
          detail
            ? `
                <span class="muted">
                  ${escapeWorkbenchHtml(detail)}
                </span>
              `
            : ""
        }
      </button>
    </li>
  `;
}

function renderWorkbenchCard({
  title,
  items,
  action,
  testid,
  emptyMessage,
  isPriority = false
}) {
  return `
    <section
      class="
        dashboard-card
        season-dashboard-card
        ${isPriority ? "workbench-priority-card" : ""}
      "
      data-testid="${escapeWorkbenchHtml(testid)}"
      ${isPriority ? 'data-priority="true"' : ""}
    >
      <div class="dashboard-card-header">
        <div>
          <h3>${escapeWorkbenchHtml(title)}</h3>

          ${
            isPriority
              ? `
                  <span
                    class="muted"
                    data-testid="workbench-next-label"
                  >
                    Work next
                  </span>
                `
              : ""
          }
        </div>

        <span
          class="status-badge"
          data-testid="${escapeWorkbenchHtml(
            testid
          )}-count"
        >
          ${items.length}
        </span>
      </div>

      ${
        items.length
          ? `
              <ul class="workbench-list">
                ${items
                  .slice(0, 5)
                  .map(item =>
                    renderWorkbenchItem(
                      item,
                      action,
                      testid
                    )
                  )
                  .join("")}
              </ul>

              ${
                items.length > 5
                  ? `
                      <button
                        type="button"
                        class="secondary-button"
                        data-testid="${escapeWorkbenchHtml(
                          testid
                        )}-view-all"
                        onclick='handleWorkbenchAction(
                          ${JSON.stringify(action)},
                          {}
                        )'
                      >
                        View all ${items.length}
                      </button>
                    `
                  : ""
              }
            `
          : `
              <p
                class="muted"
                data-testid="${escapeWorkbenchHtml(
                  testid
                )}-empty"
              >
                ${escapeWorkbenchHtml(
                  emptyMessage
                )}
              </p>
            `
      }
    </section>
  `;
}

function renderWorkbenchEmptyState() {
  return `
    <section
      data-testid="assigner-workbench-empty"
    >
      ${renderEmptyState({
        title:
          "Assigner Workbench",
        message:
          "No operational work requires attention.",
        testId:
          "assigner-workbench-empty-content"
      })}
    </section>
  `;
}

function renderWorkbenchNotificationCard() {
  const summary =
    dashboardService
      .getNotificationsSummary();

  const communicationSummary =
    dashboardService
      .getCommunicationPreferencesSummary();

  const categoryLabels = {
    assignments: "Assignments",
    claims: "Claims",
    reviews: "Reviews",
    availability: "Availability",
    accounts: "Accounts",
    returnedReview:
      "Returned Reviews",
    activityDigest: "Activity"
  };

  return `
    <section
      class="
        dashboard-card
        season-dashboard-card
      "
      data-testid="workbench-notifications"
    >
      ${renderCardHeader({
        title: "Notifications",
        subtitle:
          "Communication queue",
        badge:
          summary.unreadCount,
        badgeTestId:
          "workbench-notifications-count",
        headingLevel: 3
      })}

      <p class="muted">
        ${
          summary.unreadCount === 1
            ? "1 unread notification."
            : `${summary.unreadCount} unread notifications.`
        }
      </p>

      ${
        summary.newestNotification
          ? `
              <p
                data-testid="workbench-newest-notification"
              >
                <strong>Newest:</strong>
                ${escapeWorkbenchHtml(
                  summary
                    .newestNotification
                    .title || ""
                )}
              </p>
            `
          : `
              <p
                class="muted"
                data-testid="workbench-newest-notification-empty"
              >
                No notifications.
              </p>
            `
      }

      ${
        summary.oldestUnread
          ? `
              <p
                class="muted"
                data-testid="workbench-oldest-unread-age"
              >
                Oldest unread:
                ${escapeWorkbenchHtml(
                  summary
                    .oldestUnreadAgeLabel
                )}
              </p>
            `
          : ""
      }

      ${
        summary.unreadCategories.length
          ? `
              <ul
                class="workbench-muted-categories"
                data-testid="workbench-unread-by-category"
              >
                ${summary.unreadCategories
                  .map(
                    category => `
                      <li
                        data-testid="workbench-unread-${
                          escapeWorkbenchHtml(
                            category.key
                          )
                        }"
                      >
                        ${escapeWorkbenchHtml(
                          categoryLabels[
                            category.key
                          ] ||
                          category.key
                        )}:
                        ${category.count}
                      </li>
                    `
                  )
                  .join("")}
              </ul>
            `
          : ""
      }

      ${
        communicationSummary.hasMuted
          ? `
              <ul
                class="workbench-muted-categories"
                data-testid="workbench-muted-categories"
              >
                ${communicationSummary.muted
                  .map(
                    category => `
                      <li
                        class="muted"
                        data-testid="workbench-muted-${
                          escapeWorkbenchHtml(
                            category.key
                          )
                        }"
                      >
                        ${escapeWorkbenchHtml(
                          category.text
                        )}
                      </li>
                    `
                  )
                  .join("")}
              </ul>
            `
          : ""
      }

      <button
        type="button"
        class="secondary-button"
        data-testid="workbench-open-notifications"
        onclick="navigateTo(
          'notifications',
          {}
        )"
      >
        View Notifications
      </button>
    </section>
  `;
}

function renderWorkbench() {
  const workbench =
    dashboardService.getWorkbench();

  const notificationSummary =
    dashboardService
      .getNotificationsSummary();

  const nextSectionKey =
    workbench.nextSection?.key || "";

  if (
    workbench.isEmpty &&
    !notificationSummary.hasUnread
  ) {
    return `
      <section
        class="page-section"
        data-testid="assigner-workbench"
      >
        ${renderWorkbenchEmptyState()}
      </section>
    `;
  }

  return `
    <section
      class="page-section"
      data-testid="assigner-workbench"
    >
      <div class="workbench-launch responsive-actions">
        <button
          type="button"
          class="primary-button"
          data-testid="workbench-launch-operations-center"
          onclick="launchOperationsCenter()"
        >
          Open Operations Center
        </button>
      </div>

      <div class="dashboard-grid workbench-grid">
        ${renderWorkbenchNotificationCard()}

        ${renderWorkbenchCard({
          title: "Needs Assignment",
          items:
            workbench.sections.needsAssignment,
          action: "needs-assignment",
          testid:
            "workbench-needs-assignment",
          emptyMessage:
            "No games need assignment.",
          isPriority:
            nextSectionKey ===
            "needsAssignment"
        })}

        ${renderWorkbenchCard({
          title: "Pending Claims",
          items:
            workbench.sections.pendingClaims,
          action: "pending-claim",
          testid:
            "workbench-pending-claims",
          emptyMessage:
            "No claims are pending.",
          isPriority:
            nextSectionKey ===
            "pendingClaims"
        })}

        ${renderWorkbenchCard({
          title: "Awaiting Review",
          items:
            workbench.sections.awaitingReview,
          action: "awaiting-review",
          testid:
            "workbench-awaiting-review",
          emptyMessage:
            "No submitted reviews are waiting.",
          isPriority:
            nextSectionKey ===
            "awaitingReview"
        })}

        ${renderWorkbenchCard({
          title: "Returned Reviews",
          items:
            workbench.sections.returnedReviews,
          action: "returned-review",
          testid:
            "workbench-returned-review",
          emptyMessage:
            "No returned reviews require follow-up.",
          isPriority:
            nextSectionKey ===
            "returnedReviews"
        })}

        ${renderWorkbenchCard({
          title: "Today's Priorities",
          items:
            workbench.sections.todaysPriorities,
          action: "today-priority",
          testid:
            "workbench-today",
          emptyMessage:
            "No games need operational attention today.",
          isPriority:
            nextSectionKey ===
            "todaysPriorities"
        })}

        ${renderWorkbenchCard({
          title: "Recent Activity",
          items:
            workbench.sections.recentActivity,
          action: "activity",
          testid:
            "workbench-activity",
          emptyMessage:
            "No recent operational activity."
        })}
      </div>
    </section>
  `;
}

function refreshWorkbenchIfActive() {
  if (
    typeof currentPage !== "undefined" &&
    currentPage === "assigner-workbench"
  ) {
    renderPage(
      "assigner-workbench",
      typeof currentPageContext !== "undefined"
        ? currentPageContext
        : {}
    );
  }
}


function launchOperationsCenter() {
  window.navigateTo("operations-center");
}

window.handleWorkbenchAction =
  handleWorkbenchAction;
