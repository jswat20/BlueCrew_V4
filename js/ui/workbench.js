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

  const game = item?.game || item;
  const crew = game?.assignments || [];

  return `
    <li class="workbench-item workbench-mini-game">
      <button
        type="button"
        class="workbench-item-action"
        data-testid="${escapeWorkbenchHtml(
          testid
        )}-item"
        onclick='openWorkbenchGameDialog(
          ${JSON.stringify(action)},
          ${JSON.stringify(payload)}
        )'
      >
        <span class="workbench-mini-game-time">${escapeWorkbenchHtml(game?.time || "Time TBD")}</span>
        <span class="workbench-mini-game-main"><strong>${escapeWorkbenchHtml(label)}</strong><small>${escapeWorkbenchHtml([game?.level, game?.field || game?.venue, game?.date].filter(Boolean).join(" · "))}</small></span>
        <span class="workbench-mini-game-crew">${action === "pending-claim" ? `<strong>${escapeWorkbenchHtml(item.position || "Position")}</strong><small>Claimed by ${escapeWorkbenchHtml(item.claimedByName || item.claimedBy || "Unknown umpire")}</small>` : `<strong class="workbench-staffing-count" data-incomplete="${crew.filter(slot => slot.crewId).length < crew.length}">${crew.filter(slot => slot.crewId).length}/${crew.length || "—"} staffed</strong>${action === "needs-assignment" ? "" : `<small>${action === "returned-review" ? "Review returned" : "Review submitted"}</small>`}`}</span>
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
      id="${escapeWorkbenchHtml(testid)}"
      tabindex="-1"
      ${isPriority ? 'data-priority="true"' : ""}
    >
      <div class="dashboard-card-header">
        <div class="workbench-card-title">
          <h3>${escapeWorkbenchHtml(title)}</h3>

          <span
            class="status-badge"
            data-testid="${escapeWorkbenchHtml(
              testid
            )}-count"
          >
            ${items.length}
          </span>

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

        <button
          type="button"
          class="secondary-button workbench-card-view-all"
          data-testid="${escapeWorkbenchHtml(testid)}-view-all"
          onclick='handleWorkbenchAction(${JSON.stringify(action)}, {})'
        >
          View all ${items.length}
        </button>
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

function renderWorkbenchOpenPositions(games = []) {
  return `
    <section class="workbench-open-positions" data-testid="workbench-open-positions-focus">
      <div class="presentation-page-header presentation-panel workbench-open-positions-header">
        <div>
          <span class="dashboard-eyebrow">Staffing Queue</span>
          <h2>Games With Open Positions</h2>
          <p>${games.length} ${games.length === 1 ? "game requires" : "games require"} crew assignment.</p>
        </div>
        <button type="button" class="button button-secondary" data-testid="workbench-show-all" onclick="navigateTo('assigner-workbench')">Show All Workbench</button>
      </div>

      <div class="presentation-table-wrapper workbench-open-table-wrap">
        <table class="presentation-table workbench-open-table">
          <thead><tr><th>Date</th><th>Time</th><th>Game</th><th>Location</th><th>Open Positions</th><th>Action</th></tr></thead>
          <tbody>
            ${games.length ? games.map(game => {
              const openAssignments = assignmentService.getAssignments(game).filter(assignment => !assignment.crewId);
              return `
                <tr data-testid="workbench-open-game-${escapeWorkbenchHtml(game.id)}">
                  <td>${escapeWorkbenchHtml(game.date || "—")}</td>
                  <td>${escapeWorkbenchHtml(game.time || "TBD")}</td>
                  <td><strong>${escapeWorkbenchHtml(getWorkbenchItemLabel(game))}</strong><br><span class="muted">${escapeWorkbenchHtml(game.level || "")}</span></td>
                  <td>${escapeWorkbenchHtml(game.field || game.venue || "Location TBD")}</td>
                  <td><div class="workbench-open-position-list">${openAssignments.map(assignment => `<span class="status-badge status-badge-open">${escapeWorkbenchHtml(assignment.position)}</span>`).join("")}</div></td>
                  <td><button type="button" class="button button-primary" data-testid="workbench-manage-crew-${escapeWorkbenchHtml(game.id)}" onclick="openAssignmentDrawer('${escapeWorkbenchHtml(game.id)}')">Manage Crew</button></td>
                </tr>
              `;
            }).join("") : `<tr><td colspan="6"><div class="presentation-empty-state" role="status">No games currently have open positions.</div></td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

let workbenchVisibleNotifications = [];
let workbenchNotificationsCollapsed = false;

function getWorkbenchNotifications() {
  const center = notificationService.getNotificationCenter();
  const pendingGameIds = new Set(
    claimsQueueService.getPendingClaims().map(claim => String(claim.gameId))
  );
  const rawOperationalChanges = (dashboardService?.getRecentOperationalActivity?.(50) || [])
    .filter(activity => activity.gameId)
    .filter(activity =>
      (activity.type !== "assignment" || /(assigned to|changed to|removed from)/i.test(activity.message || "")) &&
      !(activity.type === "game" && activity.action === "game_updated" && !activity.message)
    );
  const preciseAssignmentGameIds = new Set(
    rawOperationalChanges.filter(activity => activity.type === "assignment").map(activity => String(activity.gameId))
  );
  const persisted = [...center.unread, ...center.read].filter(notification =>
    (notification.type !== "claim-submitted" || pendingGameIds.has(String(notification.relatedId))) &&
    !(String(notification.type || "").toLowerCase().includes("assignment") && notification.relatedId && preciseAssignmentGameIds.has(String(notification.relatedId))) &&
    !(String(notification.type || "").toLowerCase().includes("assignment") && /assignment updated for/i.test(notification.message || ""))
  );
  const session = loginService?.getCurrentSession?.() || {};
  const since = new Date(
    session.previousLoginAt ||
    session.loginAt ||
    Date.now() - 24 * 60 * 60 * 1000
  ).getTime();

  const completedGames = gameService.getAll()
    .filter(game => {
      const completedAt = new Date(
        game.completion?.completionTime ||
        game.completedAt ||
        ""
      ).getTime();
      return game.completion?.completed === true &&
        Number.isFinite(completedAt) &&
        completedAt >= since;
    })
    .map(game => ({
      id: `completed-game-${game.id}`,
      type: "game_completed",
      title: "Game Completed",
      message: `Game Completed — Final score ${game.completion?.awayScore ?? "—"}-${game.completion?.homeScore ?? "—"}.`,
      relatedId: game.id,
      createdAt: game.completion?.completionTime || game.completedAt,
      read: false,
      virtual: true
    }));

  const operationalChanges = rawOperationalChanges
    .map(activity => ({
      id: `activity-${activity.id}`,
      type: activity.type || "activity",
      title: activity.matchup || activity.object || "Game Update",
      message: activity.message || "Game updated.",
      relatedId: activity.gameId,
      createdAt: activity.createdAt,
      read: true,
      virtual: true,
      activity: true
    }));

  return [...persisted, ...completedGames, ...operationalChanges]
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

function formatWorkbenchNotificationTime(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function getWorkbenchNotificationChange(notification) {
  if (String(notification.type || "").toLowerCase().includes("assignment") && notification.relatedId) {
    const activity = (dashboardService?.getRecentOperationalActivity?.(50) || []).find(item =>
      String(item.gameId) === String(notification.relatedId) && item.type === "assignment"
    );
    if (activity) return activity.message;
  }
  return notification.message || notification.title || "No additional details.";
}

function renderWorkbenchNotificationCenter() {
  workbenchVisibleNotifications = getWorkbenchNotifications();
  const summary = dashboardService.getNotificationsSummary();

  return `
    <section class="workbench-notification-center" data-testid="workbench-notifications">
      <header class="workbench-section-header">
        <div class="workbench-notification-title"><h2>Notifications</h2><span class="workbench-count" data-testid="workbench-notifications-count">${summary.unreadCount}</span></div>
        <div class="workbench-notification-actions">
          <button type="button" class="button button-secondary" data-testid="workbench-toggle-notifications" aria-expanded="${!workbenchNotificationsCollapsed}" onclick="toggleWorkbenchNotifications()">${workbenchNotificationsCollapsed ? "Expand" : "Collapse"}</button>
          <button type="button" class="button button-secondary" data-testid="workbench-open-notifications" onclick="navigateTo('notifications', {})">View All</button>
        </div>
      </header>
      ${workbenchNotificationsCollapsed ? "" : workbenchVisibleNotifications.length ? `
        <div class="workbench-notification-list">
          ${workbenchVisibleNotifications.map(notification => `
            <button type="button" class="workbench-notification-row" data-testid="workbench-notification-item" data-notification-id="${escapeWorkbenchHtml(notification.id)}" data-read="${notification.read === true}" onclick="openWorkbenchNotification('${escapeWorkbenchHtml(notification.id)}')">
              <time><strong>${escapeWorkbenchHtml(formatWorkbenchNotificationTime(notification.createdAt))}</strong></time>
              ${(() => { const game = notification.relatedId ? gameService.getById(notification.relatedId) : null; return `<span class="workbench-notification-game"><strong>${escapeWorkbenchHtml(game ? `${game.awayTeam} @ ${game.homeTeam}${game.time ? ` · ${game.time}` : ""}` : notification.title || "Application Notification")}</strong></span>`; })()}
              <span class="workbench-notification-change">${escapeWorkbenchHtml(getWorkbenchNotificationChange(notification))}</span>
              <span class="workbench-notification-state">${notification.read ? "Read" : "New"}</span>
            </button>
          `).join("")}
        </div>
      ` : `<div class="presentation-empty-state" data-testid="workbench-notifications-empty">No notifications require your attention.</div>`}
    </section>
  `;
}

function toggleWorkbenchNotifications() {
  workbenchNotificationsCollapsed = !workbenchNotificationsCollapsed;
  refreshWorkbenchIfActive();
}

function renderWorkbenchTools() {
  return `
    <section class="workbench-tools" data-testid="workbench-tools">
      <div><h2>Schedule Tools</h2><p>Create and move schedule data from one operational workspace.</p></div>
      <div class="workbench-tool-actions">
        <button type="button" class="button button-primary" data-testid="workbench-create-event" onclick="createEventFromWorkbench()">Create Event</button>
        <button type="button" class="button button-secondary" data-testid="workbench-import-schedule" onclick="importScheduleFromWorkbench()">Import Games</button>
        <button type="button" class="button button-secondary" data-testid="workbench-export-schedule" onclick="exportSchedule()">Export Games</button>
      </div>
    </section>
  `;
}

function focusWorkbenchQueue(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
  document.getElementById(id)?.focus({ preventScroll: true });
}

function renderWorkbenchStatusStrip(workbench) {
  const metrics = [
    ["needs-assignment", "Needs Assignment", workbench.sections.needsAssignment.length],
    ["pending-claims", "Pending Claims", workbench.sections.pendingClaims.length],
    ["awaiting-review", "Awaiting Review", workbench.sections.awaitingReview.length],
    ["returned-review", "Returned Reviews", workbench.sections.returnedReviews.length]
  ];
  return `<nav class="workbench-status-strip" aria-label="Workbench status" data-testid="workbench-status-strip">${metrics.map(([id, label, value]) => `<button type="button" data-attention="${value > 0}" onclick="focusWorkbenchQueue('workbench-${id}')"><span>${label}</span><strong>${value}</strong></button>`).join("")}</nav>`;
}

function openWorkbenchNotification(notificationId) {
  const notification = workbenchVisibleNotifications.find(item => String(item.id) === String(notificationId));
  if (!notification) return;

  if (!notification.virtual && !notification.read) {
    notificationService.markAsRead(notification.id);
    notification.read = true;
    const row = document.querySelector(`[data-notification-id="${CSS.escape(String(notification.id))}"]`);
    if (row) {
      row.dataset.read = "true";
      const state = row.querySelector(".workbench-notification-state");
      if (state) state.textContent = "Read";
    }
  }

  if (notification.type !== "game_completed" && notification.destination?.page) {
    navigateTo(notification.destination.page, notification.destination.context || {});
    return;
  }

  if (notification.activity && notification.relatedId) {
    openWorkbenchGameDialog("activity", { gameId: notification.relatedId });
    return;
  }

  document.getElementById("workbench-notification-dialog")?.remove();
  const game = notification.relatedId ? gameService.getById(notification.relatedId) : null;
  const completion = game?.completion || {};
  const dialog = document.createElement("dialog");
  dialog.id = "workbench-notification-dialog";
  dialog.className = "workbench-notification-dialog";
  dialog.dataset.testid = "workbench-notification-dialog";
  dialog.innerHTML = notification.type === "game_completed" && game ? `
    <article class="workbench-game-notification">
      <header><div><span class="dashboard-eyebrow">Game Hub</span><h2>${escapeWorkbenchHtml(game.awayTeam)} @ ${escapeWorkbenchHtml(game.homeTeam)}</h2></div><button type="button" class="button button-secondary" onclick="this.closest('dialog').close()">Close</button></header>
      <div class="workbench-final-score"><span>${escapeWorkbenchHtml(game.awayTeam)} <strong>${completion.awayScore ?? "—"}</strong></span><span>${escapeWorkbenchHtml(game.homeTeam)} <strong>${completion.homeScore ?? "—"}</strong></span></div>
      <dl class="workbench-game-facts"><div><dt>Date</dt><dd>${escapeWorkbenchHtml(game.date || "—")}</dd></div><div><dt>Location</dt><dd>${escapeWorkbenchHtml(game.field || "—")}</dd></div><div><dt>Level</dt><dd>${escapeWorkbenchHtml(game.level || "—")}</dd></div></dl>
      <section><h3>Game Notes</h3><p>${escapeWorkbenchHtml(completion.notes || game.notes || game.gameNotes || "No game notes were entered.")}</p></section>
      <footer><button type="button" class="button button-primary" onclick="this.closest('dialog').close(); navigateTo('game-hub', { gameId: '${escapeWorkbenchHtml(game.id)}', origin: 'assigner-workbench', returnPage: 'assigner-workbench' })">Open Full Game Hub</button></footer>
    </article>
  ` : `
    <article class="workbench-notification-detail">
      <header><div><span class="dashboard-eyebrow">${escapeWorkbenchHtml(notification.type || "Notification")}</span><h2>${escapeWorkbenchHtml(notification.title || "Notification")}</h2></div><button type="button" class="button button-secondary" onclick="this.closest('dialog').close()">Close</button></header>
      <time>${escapeWorkbenchHtml(formatWorkbenchNotificationTime(notification.createdAt))}</time>
      <p>${escapeWorkbenchHtml(notification.message || "No additional details were provided.")}</p>
      ${game ? `<p><strong>Related game:</strong> ${escapeWorkbenchHtml(game.awayTeam)} @ ${escapeWorkbenchHtml(game.homeTeam)}</p>` : ""}
    </article>
  `;
  document.body.appendChild(dialog);
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  dialog.showModal();
}

function openWorkbenchGameDialog(action, payload = {}) {
  const gameId = payload.gameId || payload.id || "";
  const sourceGame = gameService.getById(gameId);
  const game = portalService.getGameHub(gameId);
  if (!sourceGame || !game) {
    handleWorkbenchAction(action, payload);
    return;
  }

  document.getElementById("workbench-game-dialog")?.remove();
  const claim = action === "pending-claim"
    ? claimsQueueService.getPendingClaims().find(item => String(item.assignmentId) === String(payload.assignmentId) || String(item.gameId) === String(gameId))
    : null;
  const showReview = action === "awaiting-review" || action === "returned-review";
  const dialog = document.createElement("dialog");
  dialog.id = "workbench-game-dialog";
  dialog.className = "workbench-game-dialog";
  dialog.dataset.action = action;
  dialog.dataset.gameId = gameId;
  dialog.dataset.testid = "workbench-game-dialog";
  const claimOnlyContent = claim ? `
    <section class="workbench-dialog-callout" data-testid="workbench-claim-detail">
      <div><strong>Pending ${escapeWorkbenchHtml(claim.position)} claim</strong><span>Requested by ${escapeWorkbenchHtml(claim.claimedByName || claim.claimedBy || "Unknown umpire")}</span></div>
      <div class="workbench-claim-actions">
        <button type="button" class="button button-primary" data-testid="workbench-accept-claim" onclick="resolveWorkbenchClaim('${escapeWorkbenchHtml(claim.gameId)}', '${escapeWorkbenchHtml(claim.assignmentId)}', true)">Accept</button>
        <button type="button" class="button button-secondary" data-testid="workbench-reject-claim" onclick="resolveWorkbenchClaim('${escapeWorkbenchHtml(claim.gameId)}', '${escapeWorkbenchHtml(claim.assignmentId)}', false)">Reject</button>
      </div>
    </section>
    <section class="game-hub-command-card game-hub-command-summary">
      <div class="game-hub-command-title"><span class="dashboard-eyebrow">${escapeWorkbenchHtml(game.date)}</span><h2>${escapeWorkbenchHtml(game.matchup)}</h2></div>
      <dl><div><dt>Time</dt><dd>${escapeWorkbenchHtml(game.time)}</dd></div><div><dt>Location</dt><dd>${escapeWorkbenchHtml(game.gameInformation?.field || game.field || "")}</dd></div><div><dt>Level</dt><dd>${escapeWorkbenchHtml(game.level)}</dd></div></dl>
    </section>
    <section class="game-hub-command-card game-hub-command-crew"><header><h3>Requested Officials</h3></header><div class="game-hub-command-slots">${assignmentService.getAssignments(sourceGame).map(assignment => `<div class="game-hub-command-slot"><span>${escapeWorkbenchHtml(assignment.position)}</span><strong>${escapeWorkbenchHtml(assignment.crewId ? crewService.getDisplayName(assignment.crewId) : String(assignment.id) === String(claim.assignmentId) ? `${claim.claimedByName || claim.claimedBy} — Pending` : "Open")}</strong></div>`).join("")}</div></section>` : "";
  dialog.innerHTML = `
    <article>
      <header class="workbench-game-dialog-header">
        <div><span class="dashboard-eyebrow">Game Hub</span><h2>${escapeWorkbenchHtml(game.matchup || `${sourceGame.awayTeam} @ ${sourceGame.homeTeam}`)}</h2></div>
        <button type="button" class="button button-secondary" onclick="this.closest('dialog').close()">Close</button>
      </header>
      ${claim ? claimOnlyContent : renderAdministrativeGameHub(game)}
      ${showReview ? `<section class="workbench-dialog-review" data-testid="workbench-review-detail">${renderGameHubReview(game, game.completion || {}, true)}</section>` : ""}
      <footer><button type="button" class="button button-secondary" onclick="this.closest('dialog').close(); navigateTo('game-hub', { gameId: '${escapeWorkbenchHtml(gameId)}', reviewMode: ${action === "awaiting-review"}, origin: 'assigner-workbench', returnPage: 'assigner-workbench' })">Open Full Game Hub</button></footer>
    </article>`;
  document.body.appendChild(dialog);
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  dialog.showModal();
}

function resolveWorkbenchClaim(gameId, assignmentId, approve) {
  const result = approve
    ? claimsQueueService.approveClaim(gameId, assignmentId)
    : claimsQueueService.rejectClaim(gameId, assignmentId);
  if (result?.success === false) return result;
  document.getElementById("workbench-game-dialog")?.close();
  refreshWorkbenchIfActive();
  return result;
}

function refreshWorkbenchGameDialog(gameId) {
  const dialog = document.getElementById("workbench-game-dialog");
  if (!dialog || String(dialog.dataset.gameId) !== String(gameId)) return false;
  const action = dialog.dataset.action || "needs-assignment";
  dialog.remove();
  openWorkbenchGameDialog(action, { gameId });
  return true;
}

function renderWorkbench(context = {}) {
  const workbench =
    dashboardService.getWorkbench();

  const notificationSummary =
    dashboardService
      .getNotificationsSummary();

  const nextSectionKey =
    workbench.nextSection?.key || "";

  if (context.focus === "open-positions") {
    const openPositionGames =
      context.scope === "today"
        ? (workbench.sections.needsAssignment || [])
            .filter(game =>
              game.date ===
              new Date().toISOString().split("T")[0]
            )
        : workbench.sections.needsAssignment || [];

    return `
      <section class="page-section" data-testid="assigner-workbench">
        ${renderWorkbenchOpenPositions(
          openPositionGames
        )}
      </section>
    `;
  }

  return `
    <section
      class="page-section"
      data-testid="assigner-workbench"
    >
      ${renderWorkbenchStatusStrip(workbench)}
      ${renderWorkbenchTools()}
      ${renderWorkbenchNotificationCenter()}

      <div class="dashboard-grid workbench-grid">
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

      </div>
    </section>
  `;
}

function createEventFromWorkbench() {
  window.navigateTo("schedule", {
    origin: "assigner-workbench",
    returnPage: "assigner-workbench"
  });
  openGameEditor();
}

function importScheduleFromWorkbench() {
  window.navigateTo("schedule", {
    origin: "assigner-workbench",
    returnPage: "assigner-workbench"
  });
  openScheduleImport();
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
