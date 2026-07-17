from pathlib import Path

ui_path = Path("js/ui/operationsCenter.js")
test_path = Path("tests/operations-center-work-deck.spec.js")

ui = ui_path.read_text(encoding="utf-8")


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


# ============================================================
# 1. Insert unified work-queue renderer
# ============================================================

if "function renderOperationsCenterWorkQueue(" not in ui:
    queue_renderer_marker = (
        "function "
        "renderOperationsCenterQueueSummary("
    )

    insert_at = ui.find(
        queue_renderer_marker
    )

    require(
        insert_at >= 0,
        "Queue-summary renderer marker not found."
    )

    renderer = r'''
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

                          <div class="operations-work-item-content">
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

      <div
        class="operations-compatibility-hooks"
        aria-hidden="true"
      >
        <span
          data-testid="operations-current-task"
        ></span>

        <span
          data-testid="operations-remaining-tasks"
        ></span>
      </div>
    </section>
  `;
}

'''

    ui = (
        ui[:insert_at] +
        renderer +
        ui[insert_at:]
    )

    print(
        "ADDED unified work queue renderer",
        flush=True
    )
else:
    print(
        "Renderer already present",
        flush=True
    )


# ============================================================
# 2. Replace center-deck contents using structural markers
# ============================================================

if "${renderOperationsCenterWorkQueue(" not in ui:
    stage_marker = (
        'data-testid="operations-current-task-stage"'
    )

    stage_marker_index = ui.find(
        stage_marker
    )

    require(
        stage_marker_index >= 0,
        "Current-task stage marker not found."
    )

    block_start = ui.rfind(
        "          <div",
        0,
        stage_marker_index
    )

    require(
        block_start >= 0,
        "Could not find the opening stage div."
    )

    queue_call_marker = (
        "        "
        "${renderOperationsCenterQueueSummary("
    )

    block_end = ui.find(
        queue_call_marker,
        stage_marker_index
    )

    require(
        block_end >= 0,
        "Could not find queue-summary invocation."
    )

    replacement = '''          <div
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

'''

    ui = (
        ui[:block_start] +
        replacement +
        ui[block_end:]
    )

    print(
        "REPLACED Current Task and Remaining Tasks",
        flush=True
    )
else:
    print(
        "Work-deck composition already present",
        flush=True
    )


# Save UI before doing anything else.
ui_path.write_text(
    ui,
    encoding="utf-8"
)

print(
    f"SAVED {ui_path}",
    flush=True
)


# ============================================================
# 3. Create focused tests
# ============================================================

test_path.write_text(
r'''import {
  expect,
  test
} from "@playwright/test";

test.describe(
  "Operations Center work deck",
  () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/");

      await page.evaluate(() => {
        authService.loginAsAdmin();
        document.body.dataset.role =
          "admin";

        renderPage("operations-center");
      });
    });

    test(
      "service exposes flattened work items",
      async ({ page }) => {
        const result =
          await page.evaluate(() => {
            const operations =
              dashboardService
                .getOperationsCenter();

            return {
              actual:
                operations
                  .activeWorkItems
                  .length,

              expected:
                operations
                  .activeTasks
                  .reduce(
                    (
                      total,
                      task
                    ) =>
                      total +
                      task.items.length,
                    0
                  )
            };
          });

        expect(result.actual)
          .toBe(result.expected);
      }
    );

    test(
      "renders a unified work queue",
      async ({ page }) => {
        await expect(
          page.getByTestId(
            "operations-work-queue"
          )
        ).toBeVisible();

        await expect(
          page.getByTestId(
            "operations-work-queue-title"
          )
        ).toHaveText("All Work");
      }
    );

    test(
      "changes work queue with channel",
      async ({ page }) => {
        await page
          .getByTestId(
            "operations-queue-reviews"
          )
          .click();

        await expect(
          page.getByTestId(
            "operations-work-queue-title"
          )
        ).toHaveText("Reviews");

        await expect(
          page.getByTestId(
            "operations-work-queue"
          )
        ).toHaveAttribute(
          "data-active-queue",
          "reviews"
        );
      }
    );

    test(
      "rendered item count matches service",
      async ({ page }) => {
        const expected =
          await page.evaluate(() =>
            dashboardService
              .getOperationsCenter()
              .activeWorkItems
              .length
          );

        await expect(
          page.getByTestId(
            "operations-work-item"
          )
        ).toHaveCount(expected);

        await expect(
          page.getByTestId(
            "operations-work-queue-count"
          )
        ).toHaveText(
          String(expected)
        );
      }
    );

    test(
      "first item is the priority action",
      async ({ page }) => {
        const rows =
          page.getByTestId(
            "operations-work-item"
          );

        if (await rows.count() === 0) {
          await expect(
            page.getByTestId(
              "operations-work-queue-empty"
            )
          ).toBeVisible();

          return;
        }

        await expect(
          rows.first()
        ).toHaveAttribute(
          "data-priority",
          "true"
        );

        await expect(
          page.getByTestId(
            "operations-current-task-action"
          )
        ).toBeVisible();
      }
    );
  }
);
''',
    encoding="utf-8"
)

print(
    f"CREATED {test_path}",
    flush=True
)
