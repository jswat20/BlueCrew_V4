// js/ui/operationsCenter.js

let operationsCenterActiveQueue = "all";

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
          class="button button-secondary"
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
  activeQueue = "all"
) {
  const normalizedActiveQueue =
    normalizeOperationsCenterQueue(
      activeQueue
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
  ];

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

  return `
    <article
      class="operations-feed-item"
      data-testid="operations-activity-item"
      data-activity-id="${escapeOperationsCenterHtml(
        activity.id ||
        `operations-activity-${index}`
      )}"
      data-activity-type="${escapeOperationsCenterHtml(
        activity.type || ""
      )}"
    >
      <span
        class="operations-feed-signal"
        aria-hidden="true"
      ></span>

      <div class="operations-feed-content">
        <strong>
          ${escapeOperationsCenterHtml(
            label
          )}
        </strong>

        <span>
          ${escapeOperationsCenterHtml(
            message
          )}
        </span>
      </div>

      <time
        class="operations-feed-time"
        datetime="${escapeOperationsCenterHtml(
          activity.createdAt || ""
        )}"
      >
        ${escapeOperationsCenterHtml(
          timestamp
        )}
      </time>
    </article>
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

  const profile =
    getOperationsCenterTelemetryProfile(
      operations
    );

  return `
    <section
      class="
        operations-telemetry-module
        operations-live-feed
      "
      data-testid="operations-recent-activity"
      data-active-queue="${escapeOperationsCenterHtml(
        profile.activeQueue
      )}"
    >
      <div class="operations-telemetry-heading">
        <div>
          <span
            class="operations-console-label"
            data-testid="operations-feed-eyebrow"
          >
            ${escapeOperationsCenterHtml(
              profile.feedEyebrow
            )}
          </span>

          <h3
            data-testid="operations-feed-title"
          >
            ${escapeOperationsCenterHtml(
              profile.feedTitle
            )}
          </h3>
        </div>

        <span
          class="operations-live-indicator"
          aria-label="Live activity feed"
        >
          <span aria-hidden="true"></span>
          Live
        </span>
      </div>

      ${
        normalizedActivities.length
          ? `
              <div
                class="operations-feed-list"
                data-testid="operations-activity-list"
              >
                ${normalizedActivities
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
    </section>
  `;
}

function renderOperationsCenter(context = {}) {
  operationsCenterActiveQueue =
    normalizeOperationsCenterQueue(
      context.operationsQueue ||
      operationsCenterActiveQueue
    );

  const operations =
    dashboardService.getOperationsCenter(
      operationsCenterActiveQueue
    );

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
        <div>
          <span class="operations-console-eyebrow">
            The Slate
          </span>

          <h1>Operations Center</h1>

          <p>
            Live command surface for today's operational work.
          </p>
        </div>

        <div
          class="operations-system-state"
          data-testid="operations-system-state"
        >
          <span
            class="operations-system-state-light"
            aria-hidden="true"
          ></span>

          <span>
            System Ready
          </span>
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

      <div
        class="operations-command-strip"
        data-testid="operations-command-strip"
      >
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
        class="operations-center-shell"
        data-testid="operations-center-shell"
      >
        ${renderOperationsCenterQueueSummary(
          operations.queueCounts,
          operations.activeQueue
        )}

        <main
          class="
            operations-console-panel
            operations-work-deck
          "
          data-testid="operations-work-deck"
        >
          <div class="operations-console-panel-header">
            <div>
              <span class="operations-console-eyebrow">
                Active Work
              </span>

              <h2>Command Deck</h2>
            </div>

            <span class="operations-console-label">
              Priority ordered
            </span>
          </div>

          <div
            class="${
              successMessage
                ? "operations-current-task-advanced"
                : ""
            }"
            data-testid="operations-current-task-stage"
            data-advanced="${
              successMessage
                ? "true"
                : "false"
            }"
          >
            ${renderOperationsCenterWorkQueue(
              operations
            )}
          </div>
        </main>

        <aside
          class="
            operations-console-panel
            operations-status-rail
          "
          data-testid="operations-status-rail"
        >
          <div class="operations-console-panel-header">
            <div>
              <span class="operations-console-eyebrow">
                Telemetry
              </span>

              <h2>System Status</h2>
            </div>

            <span
              class="operations-console-indicator"
              aria-hidden="true"
            ></span>
          </div>

          ${renderOperationsCenterProgress(
            operations.operationalProgress,
            operations
          )}

          ${renderOperationsCenterActivity(
            operations.recentActivity,
            operations
          )}
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
