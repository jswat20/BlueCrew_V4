// js/ui/operationsCenter.js

let operationsCenterActiveQueue = "all";
let operationsCenterActivityVisibleCount = 4;
const OPERATIONS_CENTER_ACTIVITY_BATCH = 10;

const OPERATIONS_CENTER_QUEUE_IDS =
  Object.freeze([
    "all",
    "assignments",
    "claims",
    "reviews",
    "accounts",
    "conflicts"
  ]);

function normalizeOperationsCenterQueue(
  queueId
) {
  const normalized =
    String(queueId || "all")
      .trim()
      .toLowerCase();

  return OPERATIONS_CENTER_QUEUE_IDS
    .includes(normalized)
      ? normalized
      : "all";
}

function setOperationsCenterQueue(
  queueId
) {
  operationsCenterActiveQueue =
    normalizeOperationsCenterQueue(
      queueId
    );

  const existingContext =
    typeof currentPageContext !==
      "undefined" &&
    currentPageContext &&
    typeof currentPageContext === "object"
      ? currentPageContext
      : {};

  renderPage(
    "operations-center",
    {
      ...existingContext,
      operationsQueue:
        operationsCenterActiveQueue
    }
  );
}

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
  if (action === "create-event") {
    window.navigateTo("schedule", {
      origin: "operations-center",
      returnPage: "operations-center"
    });

    if (typeof openGameEditor === "function") {
      openGameEditor();
    }
    return;
  }

  if (action === "schedule-today") {
    currentScheduleView = "daily";
    currentScheduleDate =
      new Date().toISOString().split("T")[0];
    uiStateService?.setScheduleFilter?.("all");

    window.navigateTo("schedule", {
      view: "daily",
      date: currentScheduleDate,
      filter: "all",
      origin: "operations-center",
      returnPage: "operations-center"
    });
    return;
  }

  if (action === "assigner-workbench") {
    window.navigateTo("assigner-workbench", {
      staffing: item.staffing || "",
      origin: "operations-center",
      returnPage: "operations-center"
    });
    return;
  }

  if (action === "pending-account") {
    if (
      typeof uiStateService !== "undefined" &&
      typeof uiStateService.setAccountFilter === "function"
    ) {
      uiStateService.setAccountFilter("pending");
    }

    window.navigateTo("accounts", {
      filter: "pending",
      accountId: item.accountId || item.id || "",
      origin: "operations-center",
      returnPage: "operations-center"
    });
    return;
  }

  if (action === "schedule-conflict") {
    window.navigateTo("schedule", {
      gameId: item.gameId || item.id || "",
      conflictId: item.id || "",
      origin: "operations-center",
      returnPage: "operations-center"
    });
    return;
  }

  if (
    typeof window.handleWorkbenchAction !==
    "function"
  ) {
    return;
  }

  window.handleWorkbenchAction(
    action,
    {
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
    },
    "operations-center"
  );
}

function handleOperationsCenterActivity(
  item = {}
) {
  if (item.gameId) {
    handleOperationsCenterTask(
      "activity",
      item
    );
    return;
  }

  if (
    item.accountId &&
    typeof authorizationService !== "undefined" &&
    authorizationService.canManageAccounts()
  ) {
    window.navigateTo("accounts", {
      accountId: item.accountId,
      origin: "operations-center",
      returnPage: "operations-center"
    });
    return;
  }

  window.navigateTo("notifications", {
    origin: "operations-center",
    returnPage: "operations-center"
  });
}

function setOperationsCenterActionMessage(
  message,
  isError = false
) {
  const element = document.querySelector(
    '[data-testid="operations-action-message"]'
  );

  if (!element) {
    return;
  }

  element.textContent = message || "";
  element.hidden = !message;
  element.dataset.state =
    isError ? "error" : "success";
}

function finishOperationsCenterQuickAction(
  result
) {
  if (!result || result.success === false) {
    setOperationsCenterActionMessage(
      result?.message ||
        "Unable to complete this action.",
      true
    );

    return result;
  }

  const existingContext =
    typeof currentPageContext !==
      "undefined" &&
    currentPageContext &&
    typeof currentPageContext === "object"
      ? currentPageContext
      : {};

  renderPage(
    "operations-center",
    {
      ...existingContext,
      operationsFlash: {
        success: true,
        message:
          result.message ||
          "Action completed."
      }
    }
  );

  return result;
}

function assignRecommendedFromOperations(
  item = {}
) {
  const gameId =
    item.gameId ||
    item.game?.id ||
    item.id ||
    "";

  if (!gameId) {
    return finishOperationsCenterQuickAction({
      success: false,
      message: "Game not found."
    });
  }

  const game =
    typeof gameService !== "undefined"
      ? gameService.getById(gameId)
      : null;

  if (!game) {
    return finishOperationsCenterQuickAction({
      success: false,
      message: "Game not found."
    });
  }

  if (
    typeof recommendationService ===
      "undefined" ||
    typeof recommendationService
      .getBestCrewForGame !== "function"
  ) {
    return finishOperationsCenterQuickAction({
      success: false,
      message:
        "Crew recommendation is unavailable."
    });
  }

  const recommendation =
    recommendationService
      .getBestCrewForGame(game);

  if (!recommendation?.crewId) {
    return finishOperationsCenterQuickAction({
      success: false,
      message:
        "No eligible crew recommendation is available."
    });
  }

  if (
    typeof assignmentService ===
      "undefined" ||
    typeof assignmentService.assignCrew !==
      "function"
  ) {
    return finishOperationsCenterQuickAction({
      success: false,
      message:
        "Assignment service is unavailable."
    });
  }

  return finishOperationsCenterQuickAction(
    assignmentService.assignCrew(
      gameId,
      recommendation.crewId
    )
  );
}

function approveClaimFromOperations(
  item = {}
) {
  const gameId =
    item.gameId ||
    item.game?.id ||
    item.id ||
    "";

  const assignmentId =
    item.assignmentId ||
    item.assignment?.id ||
    "";

  if (
    typeof claimsQueueService ===
      "undefined" ||
    typeof claimsQueueService.approveClaim !==
      "function"
  ) {
    return finishOperationsCenterQuickAction({
      success: false,
      message:
        "Claims service is unavailable."
    });
  }

  return finishOperationsCenterQuickAction(
    claimsQueueService.approveClaim(
      gameId,
      assignmentId
    )
  );
}

function rejectClaimFromOperations(
  item = {}
) {
  const gameId =
    item.gameId ||
    item.game?.id ||
    item.id ||
    "";

  const assignmentId =
    item.assignmentId ||
    item.assignment?.id ||
    "";

  if (
    typeof claimsQueueService ===
      "undefined" ||
    typeof claimsQueueService.rejectClaim !==
      "function"
  ) {
    return finishOperationsCenterQuickAction({
      success: false,
      message:
        "Claims service is unavailable."
    });
  }

  return finishOperationsCenterQuickAction(
    claimsQueueService.rejectClaim(
      gameId,
      assignmentId
    )
  );
}

function decideAccountFromOperations(
  action,
  item = {}
) {
  const accountId =
    item.accountId || item.id || "";

  if (
    !accountId ||
    typeof accountService === "undefined"
  ) {
    return finishOperationsCenterQuickAction({
      success: false,
      message: "Account service is unavailable."
    });
  }

  const mutation =
    action === "approve-account"
      ? accountService.approveAccount
      : accountService.rejectAccount;

  if (typeof mutation !== "function") {
    return finishOperationsCenterQuickAction({
      success: false,
      message: "Account action is unavailable."
    });
  }

  return finishOperationsCenterQuickAction(
    mutation(accountId)
  );
}

function handleOperationsCenterQuickAction(
  action,
  item = {}
) {
  switch (action) {
    case "assign-recommended":
      return assignRecommendedFromOperations(
        item
      );

    case "approve-claim":
      return approveClaimFromOperations(
        item
      );

    case "reject-claim":
      return rejectClaimFromOperations(
        item
      );

    case "approve-account":
    case "reject-account":
      return decideAccountFromOperations(
        action,
        item
      );

    default:
      return {
        success: false,
        message:
          "This quick action is unavailable."
      };
  }
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

function renderOperationsCenterWorkflowHeader(
  operations
) {
  const currentQueue =
    operations.currentTask?.title ||
    "Complete";

  return `
    <section
      class="
        dashboard-card
        operations-workflow-header
      "
      data-testid="operations-workflow-header"
    >
      <div class="operations-workflow-metrics">
        <div
          class="operations-workflow-metric"
          data-testid="operations-workflow-outstanding"
        >
          <span class="card-subtitle">
            Outstanding
          </span>

          <strong>
            ${operations.outstandingCount}
          </strong>
        </div>

        <div
          class="operations-workflow-metric"
          data-testid="operations-workflow-current-queue"
        >
          <span class="card-subtitle">
            Current Queue
          </span>

          <strong>
            ${escapeOperationsCenterHtml(
              currentQueue
            )}
          </strong>
        </div>

        <div
          class="operations-workflow-metric"
          data-testid="operations-workflow-progress"
        >
          <span class="card-subtitle">
            Progress
          </span>

          <strong>
            ${operations.operationalProgress.percent}%
          </strong>
        </div>
      </div>
    </section>
  `;
}


function renderOperationsCenterQuickActions(
  task,
  item
) {
  if (!task) {
    return "";
  }

  const payload =
    escapeOperationsCenterHtml(
      JSON.stringify(item || {})
    );

  if (task.key === "needsAssignment") {
    return `
      <div
        class="operations-quick-actions responsive-actions"
        data-testid="operations-quick-actions"
      >
        <button
          type="button"
          class="button button-primary"
          data-testid="operations-assign-recommended"
          data-operations-quick-action="assign-recommended"
          data-operations-payload="${payload}"
        >
          Assign Recommended
        </button>
      </div>
    `;
  }

  if (task.key === "pendingClaims") {
    return `
      <div
        class="operations-quick-actions responsive-actions"
        data-testid="operations-quick-actions"
      >
        <button
          type="button"
          class="button button-primary"
          data-testid="operations-approve-claim"
          data-operations-quick-action="approve-claim"
          data-operations-payload="${payload}"
        >
          Approve
        </button>

        <button
          type="button"
          class="button button-danger"
          data-testid="operations-reject-claim"
          data-operations-quick-action="reject-claim"
          data-operations-payload="${payload}"
        >
          Reject
        </button>
      </div>
    `;
  }

  return "";
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

        <div class="operations-task-actions responsive-actions">
          ${renderOperationsCenterQuickActions(
            task,
            firstItem
          )}

          <button
            type="button"
            class="button button-primary primary-button"
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


function getOperationsCenterWorkItems(
  operations
) {
  if (
    Array.isArray(
      operations.activeWorkItems
    )
  ) {
    return operations.activeWorkItems;
  }

  const legacyTasks = [
    operations.currentTask,
    ...(
      Array.isArray(
        operations.remainingTasks
      )
        ? operations.remainingTasks
        : []
    )
  ].filter(Boolean);

  return legacyTasks.flatMap(
    task =>
      (task.items || []).map(
        (item, index) => ({
          id:
            item.id ||
            item.gameId ||
            item.accountId ||
            `${task.key}-${index}`,
          task,
          item
        })
      )
  );
}

function getOperationsCenterWorkActionLabel(
  task
) {
  const labels = {
    conflicts: "Resolve",
    todaysPriorities: "Assign Crew",
    needsAssignment: "Assign Crew",
    pendingClaims: "Review Claim",
    awaitingReview: "Open Review",
    returnedReviews: "Open Review",
    pendingAccounts: "Review Account"
  };

  return labels[task?.key] || "Open";
}

function renderOperationsCenterWorkQueue(
  operations
) {
  const workItems =
    getOperationsCenterWorkItems(
      operations
    );

  const activeQueue =
    operations.queues?.find(
      queue =>
        queue.id ===
        operations.activeQueue
    );

  const queueLabel =
    activeQueue?.label ||
    "All Work";

  return `
    <section
      class="operations-work-queue"
      data-testid="operations-work-queue"
      data-active-queue="${escapeOperationsCenterHtml(
        operations.activeQueue || "all"
      )}"
    >
      <div class="operations-work-queue-header">
        <div>
          <span class="operations-console-eyebrow">
            Active Queue
          </span>

          <h3
            data-testid="operations-work-queue-title"
          >
            ${escapeOperationsCenterHtml(
              queueLabel
            )}
          </h3>
        </div>

        <strong
          data-testid="operations-work-queue-count"
        >
          ${workItems.length}
        </strong>
      </div>

      ${
        workItems.length
          ? `
              <div
                class="operations-work-list"
                data-testid="operations-work-list"
              >
                ${workItems
                  .map(
                    (
                      workItem,
                      index
                    ) => {
                      const task =
                        workItem.task || {};

                      const item =
                        workItem.item || {};

                      const label =
                        renderOperationsCenterTaskLabel(
                          item
                        ) ||
                        task.title ||
                        "Operational work";

                      const detail =
                        renderOperationsCenterTaskDetail(
                          item
                        );

                      const payload =
                        escapeOperationsCenterHtml(
                          JSON.stringify(item)
                        );

                      const urgency =
                        task.key === "conflicts" ||
                        task.key === "todaysPriorities" ||
                        task.key === "returnedReviews"
                          ? "urgent"
                          : "attention";

                      return `
                        <article
                          class="
                            operations-work-item
                            ${
                              index === 0
                                ? "operations-work-item-primary"
                                : ""
                            }
                          "
                          data-testid="operations-work-item"
                          data-task-key="${escapeOperationsCenterHtml(
                            task.key || ""
                          )}"
                          data-urgency="${urgency}"
                          ${
                            index === 0
                              ? 'data-priority="true"'
                              : ""
                          }
                        >
                          <div class="operations-work-item-signal">
                            ${String(
                              index + 1
                            ).padStart(2, "0")}
                          </div>

                          <div
                            class="operations-work-item-content"
                            ${
                              index === 0
                                ? 'data-testid="operations-current-task"'
                                : index === 1
                                  ? 'data-testid="operations-remaining-tasks"'
                                  : ""
                            }
                          >
                            <span class="operations-work-item-type">
                              <span class="visually-hidden">Urgency: </span>
                              ${urgency === "urgent" ? "Urgent · " : "Action needed · "}
                              ${escapeOperationsCenterHtml(
                                task.title ||
                                "Operational Work"
                              )}
                            </span>

                            <strong
                              data-testid="operations-work-item-title"
                            >
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
                          </div>

                          <div class="operations-work-item-actions">
                            ${renderOperationsCenterQuickActions(
                              task,
                              item
                            )}

                            <button
                              type="button"
                              class="operations-work-item-action"
                              data-testid="${
                                index === 0
                                  ? "operations-current-task-action"
                                  : "operations-work-item-action"
                              }"
                              data-operations-action="${escapeOperationsCenterHtml(
                                task.action || ""
                              )}"
                              data-operations-payload="${payload}"
                            >
                              ${escapeOperationsCenterHtml(
                                getOperationsCenterWorkActionLabel(
                                  task
                                )
                              )}
                              →
                            </button>
                          </div>
                        </article>
                      `;
                    }
                  )
                  .join("")}
              </div>
            `
          : `
              <div
                class="operations-work-queue-empty"
                data-testid="operations-work-queue-empty"
              >
                <strong>Queue clear</strong>

                <span>
                  No work currently requires attention.
                </span>
              </div>
            `
      }

    </section>
  `;
}

function renderOperationsCenterQueueSummary(
  counts,
  activeQueue = "all",
  allowedQueueIds =
    OPERATIONS_CENTER_QUEUE_IDS
) {
  const normalizedActiveQueue =
    normalizeOperationsCenterQueue(
      activeQueue
    );

  const allowedQueues =
    new Set(
      [
        "all",
        ...(
          Array.isArray(allowedQueueIds)
            ? allowedQueueIds
            : OPERATIONS_CENTER_QUEUE_IDS
        )
      ]
    );

  const queueControls = [
    {
      id: "all",
      label: "All Work",
      count: counts.all || 0
    },
    {
      id: "assignments",
      label: "Assignments",
      count: counts.assignments || 0
    },
    {
      id: "claims",
      label: "Claims",
      count: counts.claims || 0
    },
    {
      id: "reviews",
      label: "Reviews",
      count: counts.reviews || 0
    },
    {
      id: "accounts",
      label: "Accounts",
      count: counts.accounts || 0
    },
    {
      id: "conflicts",
      label: "Conflicts",
      count: counts.conflicts || 0
    }
  ].filter(queue =>
    allowedQueues.has(queue.id)
  );

  const activeControl =
    queueControls.find(
      queue =>
        queue.id === normalizedActiveQueue
    ) || queueControls[0];

  return `
    <aside
      class="
        operations-console-panel
        operations-queue-rail
      "
      data-testid="operations-queue-summary"
      aria-label="Operations queues"
    >
      <div class="operations-console-panel-header">
        <div>
          <span class="operations-console-eyebrow">
            Queue Control
          </span>

          <h2>Work Channels</h2>
        </div>

        <span
          class="operations-console-indicator"
          aria-hidden="true"
        ></span>
      </div>

      <div
        class="operations-queue-controls"
        role="group"
        aria-label="Select an operations queue"
      >
        ${queueControls
          .map(queue => {
            const isActive =
              queue.id ===
              normalizedActiveQueue;

            return `
              <button
                type="button"
                class="
                  operations-queue-control
                  ${
                    isActive
                      ? "operations-queue-control-active"
                      : ""
                  }
                "
                data-testid="operations-queue-${escapeOperationsCenterHtml(
                  queue.id
                )}"
                data-operations-queue="${escapeOperationsCenterHtml(
                  queue.id
                )}"
                aria-pressed="${
                  isActive
                    ? "true"
                    : "false"
                }"
              >
                <span class="operations-queue-control-status">
                  <span
                    class="operations-queue-control-light"
                    aria-hidden="true"
                  ></span>

                  <span>
                    ${escapeOperationsCenterHtml(
                      queue.label
                    )}
                  </span>
                </span>

                <strong>
                  ${queue.count}
                </strong>
              </button>
            `;
          })
          .join("")}
      </div>

      <div class="operations-queue-rail-footer">
        <span class="operations-console-label">
          Active Channel
        </span>

        <strong data-testid="operations-active-queue-label">
          ${escapeOperationsCenterHtml(
            activeControl.label
          )}
        </strong>
      </div>
    </aside>
  `;
}

function getOperationsCenterTelemetryProfile(
  operations = {}
) {
  const activeQueue =
    normalizeOperationsCenterQueue(
      operations.activeQueue ||
      "all"
    );

  const profiles = {
    all: {
      eyebrow: "System Health",
      title: "Operational State",
      detail:
        "System-wide operational posture.",
      feedEyebrow: "Event Stream",
      feedTitle: "Live Feed"
    },

    assignments: {
      eyebrow: "Staffing Health",
      title: "Assignment Channel",
      detail:
        "Assignment coverage and open staffing work.",
      feedEyebrow: "Assignment Stream",
      feedTitle: "Staffing Feed"
    },

    claims: {
      eyebrow: "Decision Health",
      title: "Claims Channel",
      detail:
        "Pending claim decisions and claim activity.",
      feedEyebrow: "Claim Stream",
      feedTitle: "Claims Feed"
    },

    reviews: {
      eyebrow: "Review Health",
      title: "Review Channel",
      detail:
        "Review backlog and decision throughput.",
      feedEyebrow: "Review Stream",
      feedTitle: "Review Feed"
    },

    accounts: {
      eyebrow: "Account Health",
      title: "Accounts Channel",
      detail:
        "Pending registrations and account decisions.",
      feedEyebrow: "Account Stream",
      feedTitle: "Account Feed"
    },

    conflicts: {
      eyebrow: "Conflict Health",
      title: "Conflict Channel",
      detail:
        "Schedule issues requiring operational review.",
      feedEyebrow: "Conflict Stream",
      feedTitle: "Conflict Feed"
    }
  };

  return {
    activeQueue,
    ...(
      profiles[activeQueue] ||
      profiles.all
    )
  };
}

function getOperationsCenterHealthStatus(
  operations = {}
) {
  const activeQueue =
    normalizeOperationsCenterQueue(
      operations.activeQueue ||
      "all"
    );

  const counts =
    operations.queueCounts || {};

  const conflicts =
    Number(
      counts.conflicts || 0
    );

  const activeOutstanding =
    Number(
      counts[activeQueue] ??
      operations.outstandingCount ??
      0
    );

  const totalOutstanding =
    Number(
      operations.totalOutstandingCount ??
      counts.all ??
      operations.outstandingCount ??
      0
    );

  if (
    activeQueue === "conflicts" &&
    conflicts > 0
  ) {
    return {
      status: "critical",
      label: "Immediate Attention",
      detail:
        "Active schedule conflicts require resolution."
    };
  }

  if (
    activeQueue === "all" &&
    conflicts > 0
  ) {
    return {
      status: "critical",
      label: "Attention Required",
      detail:
        "Schedule conflicts are affecting overall system health."
    };
  }

  if (
    activeQueue !== "all" &&
    activeOutstanding > 0
  ) {
    return {
      status: "watch",
      label: "Channel Active",
      detail:
        "This queue still contains operational work."
    };
  }

  if (
    activeQueue !== "all" &&
    activeOutstanding === 0
  ) {
    return {
      status: "healthy",
      label: "Channel Clear",
      detail:
        "No work currently requires attention in this queue."
    };
  }

  if (totalOutstanding > 0) {
    return {
      status: "watch",
      label: "Work In Progress",
      detail:
        "Operational queues remain active."
    };
  }

  return {
    status: "healthy",
    label: "Operations Ready",
    detail:
      "No operational work currently requires attention."
  };
}

function getOperationsCenterQueueHealth(
  operations = {}
) {
  const counts =
    operations.queueCounts || {};

  const activeQueue =
    normalizeOperationsCenterQueue(
      operations.activeQueue ||
      "all"
    );

  const definitions = [
    {
      id: "assignments",
      label: "Assignments"
    },
    {
      id: "claims",
      label: "Claims"
    },
    {
      id: "reviews",
      label: "Reviews"
    },
    {
      id: "accounts",
      label: "Accounts"
    },
    {
      id: "conflicts",
      label: "Conflicts"
    }
  ];

  return definitions.map(
    queue => {
      const count =
        Number(
          counts[queue.id] || 0
        );

      const isFocused =
        activeQueue === queue.id;

      if (
        queue.id === "conflicts" &&
        count > 0
      ) {
        return {
          ...queue,
          isFocused,
          status: "critical",
          statusLabel: "Action"
        };
      }

      if (count > 0) {
        return {
          ...queue,
          isFocused,
          status: "watch",
          statusLabel: "Active"
        };
      }

      return {
        ...queue,
        isFocused,
        status: "healthy",
        statusLabel: "Clear"
      };
    }
  );
}

function renderOperationsCenterProgress(
  progress,
  operations = {}
) {
  const normalizedProgress =
    progress || {
      completed: 0,
      total: 0,
      percent: 0
    };

  const profile =
    getOperationsCenterTelemetryProfile(
      operations
    );

  const health =
    getOperationsCenterHealthStatus(
      operations
    );

  const queueHealth =
    getOperationsCenterQueueHealth(
      operations
    );

  return `
    <section
      class="
        operations-telemetry-module
        operations-health-module
      "
      data-testid="operations-progress"
      data-active-queue="${escapeOperationsCenterHtml(
        profile.activeQueue
      )}"
    >
      <div class="operations-telemetry-heading">
        <div>
          <span
            class="operations-console-label"
            data-testid="operations-telemetry-eyebrow"
          >
            ${escapeOperationsCenterHtml(
              profile.eyebrow
            )}
          </span>

          <h3
            data-testid="operations-telemetry-title"
          >
            ${escapeOperationsCenterHtml(
              profile.title
            )}
          </h3>
        </div>

        <span
          class="
            operations-status-light
            operations-status-light-${escapeOperationsCenterHtml(
              health.status
            )}
          "
          data-testid="operations-health-light"
          data-status="${escapeOperationsCenterHtml(
            health.status
          )}"
          aria-hidden="true"
        ></span>
      </div>

      <div
        class="operations-telemetry-context"
        data-testid="operations-telemetry-context"
      >
        ${escapeOperationsCenterHtml(
          profile.detail
        )}
      </div>

      <div
        class="operations-health-state"
        data-testid="operations-health-state"
        data-status="${escapeOperationsCenterHtml(
          health.status
        )}"
      >
        <strong>
          ${escapeOperationsCenterHtml(
            health.label
          )}
        </strong>

        <span>
          ${escapeOperationsCenterHtml(
            health.detail
          )}
        </span>
      </div>

      <div
        class="operations-queue-health"
        data-testid="operations-queue-health"
      >
        ${queueHealth
          .map(
            queue => `
              <div
                class="
                  operations-queue-health-row
                  ${
                    queue.isFocused
                      ? "operations-queue-health-row-focused"
                      : ""
                  }
                "
                data-testid="operations-queue-health-item"
                data-queue="${escapeOperationsCenterHtml(
                  queue.id
                )}"
                data-status="${escapeOperationsCenterHtml(
                  queue.status
                )}"
                data-focused="${
                  queue.isFocused
                    ? "true"
                    : "false"
                }"
              >
                <span
                  class="
                    operations-status-light
                    operations-status-light-${escapeOperationsCenterHtml(
                      queue.status
                    )}
                  "
                  aria-hidden="true"
                ></span>

                <span>
                  ${escapeOperationsCenterHtml(
                    queue.label
                  )}
                </span>

                <strong>
                  ${escapeOperationsCenterHtml(
                    queue.isFocused
                      ? `Focused ? ${queue.statusLabel}`
                      : queue.statusLabel
                  )}
                </strong>
              </div>
            `
          )
          .join("")}
      </div>

      <div class="operations-progress-instrument">
        <div class="operations-progress-readout">
          <div>
            <span class="operations-console-label">
              Completion
            </span>

            <strong
              data-testid="operations-progress-percent"
            >
              ${normalizedProgress.percent}%
            </strong>
          </div>

          <span
            data-testid="operations-progress-summary"
          >
            ${normalizedProgress.completed} of
            ${normalizedProgress.total} queues complete
          </span>
        </div>

        <progress
          value="${normalizedProgress.completed}"
          max="${normalizedProgress.total || 1}"
          data-testid="operations-progress-bar"
          aria-label="Operational progress"
        >
          ${normalizedProgress.percent}%
        </progress>
      </div>
    </section>
  `;
}

function formatOperationsActivityTimestamp(
  createdAt
) {
  if (!createdAt) {
    return "";
  }

  const date =
    new Date(createdAt);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  const elapsed =
    Date.now() -
    date.getTime();

  const minutes =
    Math.max(
      0,
      Math.floor(
        elapsed / 60000
      )
    );

  if (minutes < 1) {
    return "Now";
  }

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours =
    Math.floor(
      minutes / 60
    );

  if (hours < 24) {
    return `${hours}h`;
  }

  const days =
    Math.floor(
      hours / 24
    );

  return `${days}d`;
}

function getOperationsActivityLabel(
  activity = {}
) {
  return (
    activity.actionLabel ||
    activity.action ||
    activity.type ||
    "Operational Update"
  );
}

function getOperationsActivityMessage(
  activity = {}
) {
  return (
    activity.message ||
    activity.matchup ||
    activity.story ||
    "Activity recorded."
  );
}

function renderOperationsCenterActivityItem(
  activity,
  index
) {
  const label =
    getOperationsActivityLabel(
      activity
    );

  const message =
    getOperationsActivityMessage(
      activity
    );

  const timestamp =
    formatOperationsActivityTimestamp(
      activity.createdAt
    );

  const exactDate =
    new Date(activity.createdAt || "");

  const exactTimestamp =
    Number.isNaN(exactDate.getTime())
      ? "Timestamp unavailable"
      : new Intl.DateTimeFormat(
          "en-US",
          {
            dateStyle: "medium",
            timeStyle: "short"
          }
        ).format(exactDate);

  const payload =
    escapeOperationsCenterHtml(
      JSON.stringify(activity)
    );

  return `
    <button
      type="button"
      class="operations-log-row"
      data-testid="operations-activity-item"
      data-activity-id="${escapeOperationsCenterHtml(
        activity.id ||
        `operations-activity-${index}`
      )}"
      data-activity-type="${escapeOperationsCenterHtml(
        activity.type || ""
      )}"
      data-activity-category="${escapeOperationsCenterHtml(
        activity.category || "Operations"
      )}"
      data-operations-activity="${payload}"
    >
      <time
        class="operations-log-time"
        datetime="${escapeOperationsCenterHtml(
          activity.createdAt || ""
        )}"
        title="${escapeOperationsCenterHtml(
          exactTimestamp
        )}"
      >
        ${escapeOperationsCenterHtml(
          timestamp
        )}
      </time>

      <span class="operations-log-type">
        <span class="operations-feed-signal" aria-hidden="true"></span>
        <span class="visually-hidden">Activity type:</span>
        ${escapeOperationsCenterHtml(
          label
        )}
      </span>

      <span class="operations-log-location">
        ${escapeOperationsCenterHtml(
          activity.location || "—"
        )}
      </span>

      <span class="operations-log-actor">
        ${escapeOperationsCenterHtml(
          activity.actor ||
          activity.subject ||
          "System"
        )}
      </span>

      <span class="operations-log-action">
        ${escapeOperationsCenterHtml(
          message
        )}
      </span>
    </button>
  `;
}

function renderOperationsCenterActivity(
  activities,
  operations = {}
) {
  const normalizedActivities =
    Array.isArray(activities)
      ? activities
      : [];

  const visibleActivities =
    normalizedActivities.slice(
      0,
      operationsCenterActivityVisibleCount
    );

  const remainingCount =
    Math.max(
      normalizedActivities.length -
      visibleActivities.length,
      0
    );

  const nextBatchCount =
    Math.min(
      remainingCount,
      OPERATIONS_CENTER_ACTIVITY_BATCH
    );

  const profile =
    getOperationsCenterTelemetryProfile(
      operations
    );

  return `
    <section
      class="
        operations-panel
        operations-log
      "
      data-testid="operations-recent-activity"
      data-active-queue="${escapeOperationsCenterHtml(profile.activeQueue)}"
      aria-labelledby="operations-log-title"
    >
      <div class="operations-section-heading">
        <div>
          <span
            class="operations-console-label"
            data-testid="operations-feed-eyebrow"
          >
            ${escapeOperationsCenterHtml(profile.feedEyebrow)}
          </span>

          <h3 id="operations-log-title">
            Operations Log
          </h3>

          <span
            class="visually-hidden"
            data-testid="operations-feed-title"
          >
            ${escapeOperationsCenterHtml(profile.feedTitle)}
          </span>
        </div>
      </div>

      ${
        visibleActivities.length
          ? `
              <div
                id="operations-activity-list"
                class="operations-log-list"
                data-testid="operations-activity-list"
              >
                ${visibleActivities
                  .map(
                    renderOperationsCenterActivityItem
                  )
                  .join("")}
              </div>
            `
          : `
              <div
                class="operations-feed-empty"
                data-testid="operations-recent-activity-empty"
              >
                <span
                  class="
                    operations-status-light
                    operations-status-light-healthy
                  "
                  aria-hidden="true"
                ></span>

                <span>
                  No recent operational activity.
                </span>
              </div>
            `
      }

      ${remainingCount > 0 ? `
        <button
          type="button"
          class="button button-link operations-log-more"
          data-testid="operations-activity-more"
          data-operations-activity-more
          aria-controls="operations-activity-list"
          aria-expanded="${visibleActivities.length > 6 ? "true" : "false"}"
        >
          View previous activity (${nextBatchCount})
        </button>
      ` : ""}
    </section>
  `;
}

function formatOperationsCenterDate(value) {
  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "Current operational period";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      weekday: "long",
      month: "long",
      day: "numeric"
    }
  ).format(date);
}

function renderOperationsCenterStatusStrip(
  metrics = []
) {
  return `
    <nav
      class="operations-status-strip"
      aria-label="Operational status"
      data-testid="operations-status-strip"
    >
      ${metrics.map(metric => {
        const hasDetailDialog =
          Array.isArray(metric.detailItems);

        return `
        <button
          type="button"
          class="operations-status-metric ${metric.requiresAction && Number(metric.value) > 0 ? "operations-status-metric-attention" : ""}"
          data-attention="${metric.requiresAction && Number(metric.value) > 0 ? "true" : "false"}"
          data-testid="operations-metric-${escapeOperationsCenterHtml(metric.id)}"
          ${hasDetailDialog
            ? `data-operations-dialog-target="operations-detail-${escapeOperationsCenterHtml(metric.id)}"`
            : `data-operations-action="${escapeOperationsCenterHtml(metric.action || "")}"`}
          data-operations-payload="${escapeOperationsCenterHtml(JSON.stringify(metric.item || {}))}"
          aria-label="${escapeOperationsCenterHtml(metric.label)}: ${metric.value}"
        >
          <span>${escapeOperationsCenterHtml(metric.label)}</span>
          <strong>${Number(metric.value) || 0}</strong>
        </button>
      `;
      }).join("")}
    </nav>
  `;
}

function renderOperationsCenterMetricDialogs(
  metrics = []
) {
  return metrics
    .filter(metric =>
      Array.isArray(metric.detailItems)
    )
    .map(metric => `
      <dialog
        class="operations-detail-dialog"
        id="operations-detail-${escapeOperationsCenterHtml(metric.id)}"
        data-testid="operations-detail-${escapeOperationsCenterHtml(metric.id)}"
        aria-labelledby="operations-detail-${escapeOperationsCenterHtml(metric.id)}-title"
      >
        <header class="operations-detail-header">
          <div>
            <span class="operations-console-eyebrow">Action queue</span>
            <h2 id="operations-detail-${escapeOperationsCenterHtml(metric.id)}-title">
              ${escapeOperationsCenterHtml(metric.label)}
            </h2>
          </div>
          <button
            type="button"
            class="button button-link button-compact"
            data-operations-dialog-close
            aria-label="Close ${escapeOperationsCenterHtml(metric.label)}"
          >×</button>
        </header>

        ${metric.detailItems.length ? `
          <div class="operations-detail-list">
            ${metric.detailItems.map(item => `
              <article class="operations-detail-item">
                <div>
                  <strong>${escapeOperationsCenterHtml(renderOperationsCenterTaskLabel(item))}</strong>
                  ${renderOperationsCenterTaskDetail(item)
                    ? `<span>${escapeOperationsCenterHtml(renderOperationsCenterTaskDetail(item))}</span>`
                    : ""}
                </div>
                <div class="operations-detail-actions">
                  ${metric.id === "pending-claims" ? `
                    <button type="button" class="button button-primary" data-operations-quick-action="approve-claim" data-operations-payload="${escapeOperationsCenterHtml(JSON.stringify(item))}">Approve</button>
                    <button type="button" class="button button-secondary" data-operations-quick-action="reject-claim" data-operations-payload="${escapeOperationsCenterHtml(JSON.stringify(item))}">Deny</button>
                  ` : ""}
                  ${metric.id === "pending-accounts" ? `
                    <button type="button" class="button button-primary" data-operations-quick-action="approve-account" data-operations-payload="${escapeOperationsCenterHtml(JSON.stringify(item))}">Approve</button>
                    <button type="button" class="button button-secondary" data-operations-quick-action="reject-account" data-operations-payload="${escapeOperationsCenterHtml(JSON.stringify(item))}">Deny</button>
                  ` : ""}
                  <button
                    type="button"
                    class="button button-secondary"
                    data-operations-action="${escapeOperationsCenterHtml(metric.detailAction || metric.action || "")}"
                    data-operations-payload="${escapeOperationsCenterHtml(JSON.stringify(item))}"
                  >${metric.id === "pending-claims" || metric.id === "pending-accounts" ? "Review" : escapeOperationsCenterHtml(metric.detailActionLabel || "Open")}</button>
                </div>
              </article>
            `).join("")}
          </div>
        ` : `
          <div class="operations-work-queue-empty" role="status">
            <strong>Queue clear</strong>
            <span>No items currently require action.</span>
          </div>
        `}
      </dialog>
    `)
    .join("");
}

function getOperationsTimelineGroup(
  event,
  today
) {
  if (event.date === today) {
    return "Today";
  }

  const tomorrow =
    new Date(`${today}T12:00:00`);
  tomorrow.setDate(
    tomorrow.getDate() + 1
  );

  if (
    event.date ===
    tomorrow.toISOString().split("T")[0]
  ) {
    return "Tomorrow";
  }

  return "Later";
}

function renderOperationsCenterUpcoming(
  events = [],
  today = ""
) {
  const groups =
    ["Today", "Tomorrow", "Later"]
      .map(label => ({
        label,
        events: events.filter(
          event =>
            getOperationsTimelineGroup(
              event,
              today
            ) === label
        )
      }))
      .filter(group => group.events.length);

  return `
    <section
      class="operations-panel operations-upcoming"
      data-testid="operations-upcoming-work"
      aria-labelledby="operations-upcoming-title"
    >
      <div class="operations-section-heading">
        <div>
          <span class="operations-console-label">Timeline</span>
          <h2 id="operations-upcoming-title">Today & Upcoming Work</h2>
        </div>
      </div>

      ${groups.length ? groups.map(group => `
        <section class="operations-timeline-group">
          <h3>${group.label}</h3>
          <ol>
            ${group.events.map(event => `
              <li>
                <time datetime="${escapeOperationsCenterHtml(`${event.date} ${event.time || ""}`)}">
                  ${escapeOperationsCenterHtml(event.time || event.date)}
                </time>
                <button
                  type="button"
                  class="operations-timeline-event"
                  data-testid="operations-upcoming-event"
                  data-operations-action="today-priority"
                  data-operations-payload="${escapeOperationsCenterHtml(JSON.stringify(event))}"
                >
                  <strong>${escapeOperationsCenterHtml(event.matchup)}</strong>
                  <span>${escapeOperationsCenterHtml([event.field, event.level].filter(Boolean).join(" · "))}</span>
                  <span class="operations-timeline-status" data-status="${event.fullyStaffed ? "healthy" : "watch"}">
                    ${event.fullyStaffed
                      ? "Fully staffed"
                      : `${event.openAssignmentCount || 0} open · ${event.pendingClaimCount || 0} pending`}
                  </span>
                </button>
              </li>
            `).join("")}
          </ol>
        </section>
      `).join("") : `
        <div class="operations-console-complete" data-testid="operations-upcoming-empty" role="status">
          <strong>No upcoming events</strong>
          <span>The supported schedule has no current or future work.</span>
        </div>
      `}
    </section>
  `;
}

function formatOperationsWorkDate(dateValue, today) {
  if (dateValue === today) return "Today";
  const tomorrow = new Date(`${today}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateValue === tomorrow.toISOString().split("T")[0]) return "Tomorrow";
  const date = new Date(`${dateValue}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? dateValue
    : new Intl.DateTimeFormat("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long"
      }).format(date);
}

function renderOperationsStaffingBoard(events = [], today = "") {
  const groups = [];
  events.forEach(event => {
    const label = formatOperationsWorkDate(event.date, today);
    let group = groups.find(candidate => candidate.label === label);
    if (!group) {
      group = { label, events: [] };
      groups.push(group);
    }
    group.events.push(event);
  });

  const positions = [...new Set(events.flatMap(event =>
    (event.assignments || []).map(assignment => assignment.position)
  ))];

  return `
    <section class="operations-panel operations-upcoming" data-testid="operations-upcoming-work" aria-labelledby="operations-upcoming-title">
      <div class="operations-section-heading"><h2 id="operations-upcoming-title">Today & Upcoming Work</h2></div>
      ${groups.length ? groups.map(group => `
        <section class="operations-timeline-group">
          <h3>${escapeOperationsCenterHtml(group.label)}</h3>
          <div class="operations-staffing-table-wrap">
            <table class="operations-staffing-table">
              <thead><tr><th>Time</th><th>Age</th><th>Matchup</th><th>Location</th>${positions.map(position => `<th>${escapeOperationsCenterHtml(position)}</th>`).join("")}</tr></thead>
              <tbody>${group.events.map(event => `
                <tr>
                  <td><time datetime="${escapeOperationsCenterHtml(`${event.date} ${event.time || ""}`)}">${escapeOperationsCenterHtml(event.time || "—")}</time></td>
                  <td>${escapeOperationsCenterHtml(event.level || "—")}</td>
                  <td><button type="button" class="operations-timeline-event" data-testid="operations-upcoming-event" data-operations-action="today-priority" data-operations-payload="${escapeOperationsCenterHtml(JSON.stringify(event))}">${escapeOperationsCenterHtml(event.matchup)}</button></td>
                  <td>${escapeOperationsCenterHtml(event.field || "—")}</td>
                  ${positions.map(position => {
                    const assignment = (event.assignments || []).find(item => item.position === position);
                    return `<td class="operations-staffing-assignment" data-status="${assignment?.crewId ? "assigned" : "open"}">${escapeOperationsCenterHtml(assignment?.crewName || "—")}</td>`;
                  }).join("")}
                </tr>
              `).join("")}</tbody>
            </table>
          </div>
        </section>
      `).join("") : `<div class="operations-console-complete" data-testid="operations-upcoming-empty" role="status"><strong>No upcoming events</strong><span>The supported schedule has no current or future work.</span></div>`}
    </section>
  `;
}

function renderOperationsStaffingHealth(periods = []) {
  return `
    <section class="operations-staffing-health" data-testid="operations-progress" aria-labelledby="operations-health-title">
      <div class="operations-section-heading"><h2 id="operations-health-title">Operational State</h2></div>
      ${periods.map(period => `
        <article class="operations-period-health" data-testid="operations-period-${escapeOperationsCenterHtml(period.id)}" data-status="${escapeOperationsCenterHtml(period.status)}">
          <span class="operations-status-light operations-status-light-${escapeOperationsCenterHtml(period.status)}" aria-hidden="true"></span>
          <div><strong>${escapeOperationsCenterHtml(period.label)}</strong><span>${period.fullyStaffedCount} of ${period.eventCount} events fully staffed · ${period.openPositions} open positions</span></div>
        </article>
      `).join("")}
    </section>
  `;
}

function renderOperationsStaffingHealthCompact(periods = []) {
  return `
    <section class="operations-staffing-health" data-testid="operations-progress" aria-labelledby="operations-health-title">
      <div class="operations-section-heading"><h2 id="operations-health-title">Operational State</h2></div>
      ${periods.map(period => `
        <article class="operations-period-health" data-testid="operations-period-${escapeOperationsCenterHtml(period.id)}" data-status="${escapeOperationsCenterHtml(period.status)}">
          <span class="operations-status-light operations-status-light-${escapeOperationsCenterHtml(period.status)}" aria-hidden="true"></span>
          <div class="operations-period-health-content">
            <div class="operations-period-health-summary"><strong>${escapeOperationsCenterHtml(period.label)}</strong><span>${period.fullyStaffedCount}/${period.eventCount} staffed</span></div>
            <dl class="operations-period-signals">
              ${(period.signals || []).map(signal => `<div><dt>${escapeOperationsCenterHtml(signal.label)}</dt><dd class="${Number(signal.value) > 0 ? "operations-signal-active" : ""}">${Number(signal.value) || 0}</dd></div>`).join("")}
            </dl>
          </div>
        </article>
      `).join("")}
    </section>
  `;
}

function renderOperationsCenter(context = {}) {
  operationsCenterActiveQueue =
    normalizeOperationsCenterQueue(
      context.operationsQueue ||
      operationsCenterActiveQueue
    );

  let operations;

  try {
    operations =
      dashboardService.getOperationsCenter(
        operationsCenterActiveQueue
      );
  } catch (error) {
    return `
      <section class="page-section operations-center-console" data-testid="operations-center">
        ${typeof renderErrorState === "function"
          ? renderErrorState({
              title: "Operations Center unavailable",
              message: "Operational data could not be displayed. No information was changed.",
              testId: "operations-center-error"
            })
          : '<div role="alert" data-testid="operations-center-error">Operations Center unavailable. No information was changed.</div>'}
      </section>
    `;
  }

  operations.operationalDate =
    operations.operationalDate ||
    new Date().toISOString().split("T")[0];
  operations.statusMetrics =
    operations.statusMetrics || [];
  operations.upcomingWork =
    operations.upcomingWork || [];
  operations.recentActivity =
    operations.recentActivity || [];

  const operationsFlash =
    context.operationsFlash &&
    typeof context.operationsFlash ===
      "object"
      ? context.operationsFlash
      : null;

  const successMessage =
    operationsFlash?.success === true
      ? String(
          operationsFlash.message ||
          "Action completed."
        )
      : "";

  return `
    <section
      class="
        page-section
        operations-center-console
      "
      data-testid="operations-center"
    >
      <header
        class="operations-console-titlebar"
        data-testid="operations-console-titlebar"
      >
        <div class="operations-title-context">
          <span class="operations-console-eyebrow">
            The Slate
          </span>

          <h1 data-page-heading tabindex="-1">Operations Center</h1>

          <p>
            ${escapeOperationsCenterHtml(
              formatOperationsCenterDate(
                operations.operationalDate
              )
            )}
          </p>
        </div>

        <div class="operations-header-actions">
          <div
            class="operations-system-state"
            data-testid="operations-system-state"
          >
            <span
              class="operations-system-state-light"
              aria-hidden="true"
            ></span>

            <span>
              ${operations.totalOutstandingCount > 0 ? "Active work" : "Operations ready"}
            </span>
          </div>

          <button
            type="button"
            class="button button-primary"
            data-testid="operations-primary-action"
            data-operations-action="create-event"
            data-operations-payload="{}"
          >
            Create Event
          </button>
        </div>
      </header>

      <div
        class="operations-action-message"
        data-testid="operations-action-message"
        role="status"
        aria-live="polite"
        data-state="${
          successMessage
            ? "success"
            : ""
        }"
        ${successMessage ? "" : "hidden"}
      >
        ${escapeOperationsCenterHtml(
          successMessage
        )}
      </div>

      ${renderOperationsCenterStatusStrip(
        operations.statusMetrics
      )}

      ${renderOperationsCenterMetricDialogs(
        operations.statusMetrics
      )}

      <div hidden aria-hidden="true">
        ${renderOperationsCenterWorkflowHeader(
          operations
        )}
      </div>

      ${
        operations.isEmpty
          ? `
              <section
                class="operations-console-complete"
              >
                ${renderEmptyState({
                  title:
                    "Today's work is complete",
                  message:
                    "No operational queues currently require attention.",
                  testId:
                    "operations-center-empty"
                })}
              </section>
            `
          : ""
      }

      <div
        class="operations-center-shell operations-center-shell-no-attention"
        data-testid="operations-center-shell"
      >
        ${renderOperationsStaffingBoard(
          operations.upcomingWork,
          operations.operationalDate
        )}

        ${renderOperationsCenterActivity(
          operations.recentActivity,
          operations
        )}

        <aside class="operations-secondary" data-testid="operations-secondary">
          <div class="operations-status-rail" data-testid="operations-status-rail">
            ${renderOperationsStaffingHealthCompact(
              operations.staffingPeriods || []
            )}
          </div>
        </aside>
      </div>
    </section>
  `;
}

function setupOperationsCenterActions() {
  if (
    typeof currentPageContext !==
      "undefined" &&
    currentPageContext &&
    typeof currentPageContext === "object" &&
    currentPageContext.operationsFlash
  ) {
    const {
      operationsFlash,
      ...remainingContext
    } = currentPageContext;

    currentPageContext =
      remainingContext;

    if (
      window.BlueCrew &&
      window.BlueCrew.test
    ) {
      window.BlueCrew.test.currentPage =
        "operations-center";
    }
  }

  document
    .querySelectorAll(
      "[data-operations-queue]"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          setOperationsCenterQueue(
            button.dataset
              .operationsQueue || "all"
          );
        }
      );
    });

  document
    .querySelectorAll(
      "[data-operations-activity]"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          let payload = {};

          try {
            payload = JSON.parse(
              button.dataset
                .operationsActivity || "{}"
            );
          } catch {
            payload = {};
          }

          handleOperationsCenterActivity(
            payload
          );
        }
      );
    });

  document
    .querySelectorAll(
      "[data-operations-dialog-target]"
    )
    .forEach(button => {
      button.addEventListener("click", () => {
        const dialog =
          document.getElementById(
            button.dataset
              .operationsDialogTarget || ""
          );

        if (
          dialog &&
          typeof dialog.showModal === "function"
        ) {
          dialog.showModal();
        }
      });
    });

  document
    .querySelectorAll(
      "[data-operations-dialog-close]"
    )
    .forEach(button => {
      button.addEventListener("click", () => {
        button.closest("dialog")?.close();
      });
    });

  const activityMore =
    document.querySelector(
      "[data-operations-activity-more]"
    );

  if (activityMore) {
    activityMore.addEventListener(
      "click",
      () => {
        operationsCenterActivityVisibleCount +=
          OPERATIONS_CENTER_ACTIVITY_BATCH;

        renderPage(
          "operations-center",
          typeof currentPageContext !== "undefined"
            ? currentPageContext
            : {}
        );
      }
    );
  }

  document
    .querySelectorAll(
      "[data-operations-quick-action]"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          const action =
            button.dataset
              .operationsQuickAction || "";

          let payload = {};

          try {
            payload = JSON.parse(
              button.dataset
                .operationsPayload || "{}"
            );
          } catch {
            payload = {};
          }

          handleOperationsCenterQuickAction(
            action,
            payload
          );
        }
      );
    });

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

window.setOperationsCenterQueue =
  setOperationsCenterQueue;

window.refreshOperationsCenterIfActive =
  refreshOperationsCenterIfActive;

window.handleOperationsCenterTask =
  handleOperationsCenterTask;

window.handleOperationsCenterQuickAction =
  handleOperationsCenterQuickAction;

window.setupOperationsCenterActions =
  setupOperationsCenterActions;
