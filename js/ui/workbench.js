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

function handleWorkbenchAction(type, payload = {}) {
  const gameId =
    payload.gameId ||
    payload.id ||
    "";

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
        gameId
      });
      return;

    case "pending-claim":
      window.navigateTo("claims-queue", {
        status: "pending",
        assignmentId:
          payload.assignmentId ||
          payload.assignment?.id ||
          "",
        gameId
      });
      return;

    case "awaiting-review":
      window.navigateTo("review-queue", {
        filter: "submitted",
        status: "submitted",
        gameId
      });
      return;

    case "returned-review":
      window.navigateTo("review-queue", {
        filter: "returned",
        status: "returned",
        gameId
      });
      return;

    case "today-priority":
      if (gameId) {
        window.navigateTo("game-hub", {
          gameId
        });
        return;
      }

      window.navigateTo("season-dashboard", {
        focus: "today"
      });
      return;

    case "activity":
      if (gameId) {
        window.navigateTo("game-hub", {
          gameId
        });
        return;
      }

      window.navigateTo("notifications");
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
      class="empty-state"
      data-testid="assigner-workbench-empty"
    >
      <h2>Assigner Workbench</h2>

      <p>
        No operational work requires attention.
      </p>
    </section>
  `;
}

function renderWorkbench() {
  const workbench =
    dashboardService.getWorkbench();

  const nextSectionKey =
    workbench.nextSection?.key || "";

  if (workbench.isEmpty) {
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
      <div class="workbench-launch">
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
