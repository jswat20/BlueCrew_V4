// js/ui/operationsCenter.js

function escapeOperationsCenterHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function handleOperationsCenterTask(
  action,
  item = {}
) {
  if (
    typeof window.handleWorkbenchAction !==
    "function"
  ) {
    return;
  }

  window.handleWorkbenchAction(action, {
    id: item.id || "",
    gameId:
      item.gameId ||
      item.game?.id ||
      item.id ||
      "",
    assignmentId:
      item.assignmentId ||
      item.assignment?.id ||
      ""
  });
}

function renderOperationsCenterTaskLabel(item) {
  if (
    typeof getWorkbenchItemLabel ===
    "function"
  ) {
    return getWorkbenchItemLabel(item);
  }

  return (
    item?.matchup ||
    item?.title ||
    item?.message ||
    item?.name ||
    "View operational task"
  );
}

function renderOperationsCenterTaskDetail(item) {
  if (
    typeof getWorkbenchItemDetail ===
    "function"
  ) {
    return getWorkbenchItemDetail(item);
  }

  return [
    item?.date,
    item?.time,
    item?.field || item?.venue,
    item?.level
  ]
    .filter(Boolean)
    .join(" · ");
}

function renderOperationsCenterCurrentTask(task) {
  if (!task) {
    return `
      <section
        class="
          dashboard-card
          operations-current-task
        "
        data-testid="operations-current-task"
      >
        <div class="dashboard-card-header">
          <div>
            <h2>Current Task</h2>
            <span class="card-subtitle">
              Today's highest-priority work
            </span>
          </div>

          <span
            class="status-badge"
            data-testid="operations-current-task-count"
          >
            0
          </span>
        </div>

        <div
          class="empty-state"
          data-testid="operations-current-task-empty"
        >
          Today's operational queues are complete.
        </div>
      </section>
    `;
  }

  const firstItem =
    task.items?.[0] || {};

  const label =
    renderOperationsCenterTaskLabel(
      firstItem
    );

  const detail =
    renderOperationsCenterTaskDetail(
      firstItem
    );

  return `
    <section
      class="
        dashboard-card
        workbench-priority-card
        operations-current-task
      "
      data-testid="operations-current-task"
      data-task-key="${escapeOperationsCenterHtml(
        task.key
      )}"
      data-priority="true"
    >
      <div class="dashboard-card-header">
        <div>
          <h2>Current Task</h2>

          <span
            class="card-subtitle"
            data-testid="operations-current-task-title"
          >
            ${escapeOperationsCenterHtml(
              task.title
            )}
          </span>
        </div>

        <span
          class="status-badge"
          data-testid="operations-current-task-count"
        >
          ${task.count}
        </span>
      </div>

      <div class="operations-task-content">
        <strong>
          ${escapeOperationsCenterHtml(
            label
          )}
        </strong>

        ${
          detail
            ? `
                <span class="muted">
                  ${escapeOperationsCenterHtml(
                    detail
                  )}
                </span>
              `
            : ""
        }

        <button
          type="button"
          class="primary-button"
          data-testid="operations-current-task-action"
          data-operations-action="${escapeOperationsCenterHtml(
            task.action
          )}"
          data-operations-payload="${escapeOperationsCenterHtml(
            JSON.stringify(firstItem)
          )}"
        >
          Continue
        </button>
      </div>
    </section>
  `;
}

function renderOperationsCenterRemainingTasks(
  tasks
) {
  return `
    <section
      class="
        dashboard-card
        operations-remaining-tasks
      "
      data-testid="operations-remaining-tasks"
    >
      <div class="dashboard-card-header">
        <div>
          <h2>Remaining Tasks</h2>

          <span class="card-subtitle">
            Outstanding work in priority order
          </span>
        </div>

        <span
          class="status-badge"
          data-testid="operations-remaining-tasks-count"
        >
          ${tasks.length}
        </span>
      </div>

      ${
        tasks.length
          ? `
              <div class="operations-task-list">
                ${tasks
                  .map(
                    task => `
                      <button
                        type="button"
                        class="workbench-item-action"
                        data-testid="operations-remaining-task"
                        data-task-key="${escapeOperationsCenterHtml(
                          task.key
                        )}"
                        data-operations-action="${escapeOperationsCenterHtml(
                          task.action
                        )}"
                        data-operations-payload="${escapeOperationsCenterHtml(
                          JSON.stringify(
                            task.items?.[0] || {}
                          )
                        )}"
                      >
                        <span>
                          <strong>
                            ${escapeOperationsCenterHtml(
                              task.title
                            )}
                          </strong>

                          <span class="muted">
                            ${task.count}
                            outstanding
                          </span>
                        </span>

                        <span class="status-badge">
                          ${task.count}
                        </span>
                      </button>
                    `
                  )
                  .join("")}
              </div>
            `
          : `
              <div
                class="empty-state"
                data-testid="operations-remaining-tasks-empty"
              >
                No additional operational tasks.
              </div>
            `
      }
    </section>
  `;
}

function renderOperationsCenterQueueSummary(
  counts
) {
  const queues = [
    {
      key: "needsAssignment",
      label: "Needs Assignment"
    },
    {
      key: "pendingClaims",
      label: "Pending Claims"
    },
    {
      key: "awaitingReview",
      label: "Awaiting Review"
    },
    {
      key: "returnedReviews",
      label: "Returned Reviews"
    },
    {
      key: "todaysPriorities",
      label: "Today's Priorities"
    }
  ];

  return `
    <section
      class="
        dashboard-card
        operations-queue-summary
      "
      data-testid="operations-queue-summary"
    >
      <div class="dashboard-card-header">
        <div>
          <h2>Queue Counts</h2>

          <span class="card-subtitle">
            Today's operational workload
          </span>
        </div>
      </div>

      <div class="operations-queue-grid">
        ${queues
          .map(
            queue => `
              <div
                class="operations-queue-item"
                data-testid="operations-queue-${escapeOperationsCenterHtml(
                  queue.key
                )}"
              >
                <span>
                  ${escapeOperationsCenterHtml(
                    queue.label
                  )}
                </span>

                <span class="status-badge">
                  ${counts[queue.key] || 0}
                </span>
              </div>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderOperationsCenterProgress(
  progress
) {
  return `
    <section
      class="
        dashboard-card
        operations-progress
      "
      data-testid="operations-progress"
    >
      <div class="dashboard-card-header">
        <div>
          <h2>Operational Progress</h2>

          <span class="card-subtitle">
            Queue completion for today
          </span>
        </div>

        <span
          class="status-badge"
          data-testid="operations-progress-percent"
        >
          ${progress.percent}%
        </span>
      </div>

      <div class="operations-progress-content">
        <strong
          data-testid="operations-progress-summary"
        >
          ${progress.completed} of
          ${progress.total} queues complete
        </strong>

        <progress
          value="${progress.completed}"
          max="${progress.total || 1}"
          data-testid="operations-progress-bar"
        >
          ${progress.percent}%
        </progress>
      </div>
    </section>
  `;
}

function renderOperationsCenterActivity(
  activities
) {
  return `
    <section
      class="
        dashboard-card
        recent-assignment-activity
        operations-recent-activity
      "
      data-testid="operations-recent-activity"
    >
      <div class="card-header">
        <div>
          <h2>Recent Activity</h2>

          <span class="card-subtitle">
            Latest operational updates
          </span>
        </div>
      </div>

      ${
        activities.length
          ? `
              <div class="assignment-activity-list">
                ${activities
                  .map(activity =>
                    typeof renderRecentAssignmentActivityItem ===
                    "function"
                      ? renderRecentAssignmentActivityItem(
                          activity
                        )
                      : `
                          <article
                            class="assignment-activity-item"
                            data-testid="operations-activity-item"
                          >
                            ${escapeOperationsCenterHtml(
                              activity.message ||
                              activity.matchup ||
                              activity.actionLabel
                            )}
                          </article>
                        `
                  )
                  .join("")}
              </div>
            `
          : `
              <div
                class="empty-state"
                data-testid="operations-recent-activity-empty"
              >
                No recent operational activity.
              </div>
            `
      }
    </section>
  `;
}

function renderOperationsCenter() {
  const operations =
    dashboardService.getOperationsCenter();

  return `
    <section
      class="page-section"
      data-testid="operations-center"
    >
      ${
        operations.isEmpty
          ? `
              <section
                class="empty-state"
                data-testid="operations-center-empty"
              >
                <h2>Today's work is complete</h2>

                <p>
                  No operational queues currently
                  require attention.
                </p>
              </section>
            `
          : ""
      }

      <div
        class="
          dashboard-grid
          operations-center-grid
        "
      >
        ${renderOperationsCenterCurrentTask(
          operations.currentTask
        )}

        ${renderOperationsCenterRemainingTasks(
          operations.remainingTasks
        )}

        ${renderOperationsCenterQueueSummary(
          operations.queueCounts
        )}

        ${renderOperationsCenterProgress(
          operations.operationalProgress
        )}

        ${renderOperationsCenterActivity(
          operations.recentActivity
        )}
      </div>
    </section>
  `;
}

function setupOperationsCenterActions() {
  document
    .querySelectorAll(
      "[data-operations-action]"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          const action =
            button.dataset
              .operationsAction || "";

          let payload = {};

          try {
            payload = JSON.parse(
              button.dataset
                .operationsPayload || "{}"
            );
          } catch {
            payload = {};
          }

          handleOperationsCenterTask(
            action,
            payload
          );
        }
      );
    });
}

function refreshOperationsCenterIfActive() {
  if (
    typeof currentPage !== "undefined" &&
    currentPage === "operations-center"
  ) {
    renderPage(
      "operations-center",
      typeof currentPageContext !==
        "undefined"
        ? currentPageContext
        : {}
    );
  }
}

window.refreshOperationsCenterIfActive =
  refreshOperationsCenterIfActive;

window.handleOperationsCenterTask =
  handleOperationsCenterTask;

window.setupOperationsCenterActions =
  setupOperationsCenterActions;
