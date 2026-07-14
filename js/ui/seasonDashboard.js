// js/ui/seasonDashboard.js

function renderSeasonDashboard() {
  const dashboard =
    dashboardService.getSeasonDashboard();

  return `
    <section
      class="season-dashboard"
      data-testid="season-dashboard"
    >
      <div class="season-dashboard-grid">
        ${renderSeasonMetricCard(
          "operations",
          "Operations",
          [
            [
              "scheduled-games",
              "Scheduled Games",
              dashboard.operations.scheduledGames
            ],
            [
              "completed-games",
              "Completed Games",
              dashboard.operations.completedGames
            ],
            [
              "awaiting-review",
              "Awaiting Review",
              dashboard.operations.awaitingReview,
              {
                action: "awaiting-reviews"
              }
            ],
            [
              "returned-reviews",
              "Returned Reviews",
              dashboard.operations.returnedReviews,
              {
                action: "returned-reviews"
              }
            ],
            [
              "approved-reviews",
              "Approved Reviews",
              dashboard.operations.approvedReviews,
              {
                action: "review-report"
              }
            ]
          ]
        )}

        ${renderSeasonMetricCard(
          "staffing",
          "Staffing",
          [
            [
              "assignment-coverage",
              "Assignment Coverage",
              formatSeasonPercentage(
                dashboard.staffing
                  .assignmentCoveragePercentage
              ),
              {
                action: "assignment-report"
              }
            ],
            [
              "fully-staffed-games",
              "Fully Staffed Games",
              dashboard.staffing.fullyStaffedGames
            ],
            [
              "open-assignments",
              "Open Assignments",
              dashboard.staffing.openAssignments,
              {
                action: "open-assignments"
              }
            ],
            [
              "pending-claims",
              "Pending Claims",
              dashboard.staffing.pendingClaims,
              {
                action: "pending-claims"
              }
            ]
          ]
        )}

        ${renderSeasonMetricCard(
          "availability",
          "Availability",
          [
            [
              "available",
              "Available",
              dashboard.availability.available
            ],
            [
              "unavailable",
              "Unavailable",
              dashboard.availability.unavailable
            ],
            [
              "maybe",
              "Maybe",
              dashboard.availability.maybe
            ],
            [
              "no-response",
              "No Response",
              dashboard.availability.noResponse
            ],
            [
              "response-percentage",
              "Response Rate",
              formatSeasonPercentage(
                dashboard.availability
                  .responsePercentage
              ),
              {
                action: "availability-report"
              }
            ]
          ]
        )}

        ${renderSeasonMetricCard(
          "officials",
          "Officials",
          [
            [
              "active-officials",
              "Active Officials",
              dashboard.officials.activeOfficials
            ],
            [
              "pending-approvals",
              "Pending Approvals",
              dashboard.officials.pendingApprovals,
              {
                action: "pending-approvals"
              }
            ]
          ]
        )}

        ${renderSeasonAttentionCard(
          dashboard.highPriorityItems
        )}

        ${renderSeasonUpcomingCard(
          dashboard.upcomingDeadlines
        )}

        ${renderSeasonHealthCard(
          dashboard.operationalHealth
        )}

        ${renderSeasonActivityCard(
          dashboard.activity
        )}
      </div>
    </section>
  `;
}

function renderSeasonMetricCard(
  id,
  title,
  metrics
) {
  return `
    <section
      class="dashboard-card season-dashboard-card"
      data-testid="season-dashboard-${id}"
    >
      <div class="card-header">
        <div>
          <h2>${escapeSeasonDashboardHtml(title)}</h2>
        </div>
      </div>

      <div class="summary-grid">
        ${metrics
          .map(
            ([
              metricId,
              label,
              value,
              options = {}
            ]) => {
              const content = `
                <div
                  class="summary-value"
                  data-testid="season-dashboard-${metricId}-value"
                >
                  ${escapeSeasonDashboardHtml(value)}
                </div>

                <div class="summary-label">
                  ${escapeSeasonDashboardHtml(label)}
                </div>
              `;

              return options.action
                ? `
                    <button
                      type="button"
                      class="
                        summary-tile
                        season-dashboard-metric-action
                      "
                      data-testid="season-dashboard-${metricId}"
                      data-action="${escapeSeasonDashboardHtml(
                        options.action
                      )}"
                      onclick="handleSeasonDashboardAction(
                        '${escapeSeasonDashboardJs(
                          options.action
                        )}'
                      )"
                    >
                      ${content}
                    </button>
                  `
                : `
                    <div
                      class="summary-tile"
                      data-testid="season-dashboard-${metricId}"
                    >
                      ${content}
                    </div>
                  `;
            }
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderSeasonAttentionCard(items) {
  return `
    <section
      class="
        dashboard-card
        season-dashboard-card
        season-dashboard-intelligence
      "
      data-testid="season-dashboard-needs-attention"
    >
      <div class="card-header">
        <div>
          <h2>Needs Attention</h2>

          <span class="card-subtitle">
            Current operational priorities
          </span>
        </div>
      </div>

      ${
        items.length
          ? `
              <div
                class="season-intelligence-list"
                data-testid="season-dashboard-attention-list"
              >
                ${items
                  .map(renderSeasonAttentionItem)
                  .join("")}
              </div>
            `
          : `
              <div
                class="empty-state"
                data-testid="season-dashboard-attention-empty"
              >
                No operational items require attention.
              </div>
            `
      }
    </section>
  `;
}

function renderSeasonAttentionItem(item) {
  return `
    <article
      class="
        season-intelligence-item
        season-intelligence-${escapeSeasonDashboardHtml(
          item.priority
        )}
      "
      data-testid="season-dashboard-attention-item"
      data-key="${escapeSeasonDashboardHtml(
        item.key
      )}"
    >
      <div class="season-intelligence-content">
        <div class="season-intelligence-heading">
          <strong>
            ${escapeSeasonDashboardHtml(
              item.title
            )}
          </strong>

          <span
            class="season-intelligence-count"
            data-testid="season-dashboard-attention-${escapeSeasonDashboardHtml(
              item.key
            )}-count"
          >
            ${escapeSeasonDashboardHtml(
              item.count
            )}
          </span>
        </div>

        <span class="muted">
          ${escapeSeasonDashboardHtml(
            item.detail
          )}
        </span>
      </div>

      ${
        item.destination
          ? `
              <button
                type="button"
                class="secondary-button"
                data-testid="season-dashboard-attention-${escapeSeasonDashboardHtml(
                  item.key
                )}-action"
                onclick="handleSeasonDashboardAction(
                  '${escapeSeasonDashboardJs(
                    item.key
                  )}'
                )"
              >
                View
              </button>
            `
          : ""
      }
    </article>
  `;
}

function renderSeasonUpcomingCard(items) {
  return `
    <section
      class="
        dashboard-card
        season-dashboard-card
        season-dashboard-intelligence
      "
      data-testid="season-dashboard-upcoming"
    >
      <div class="card-header">
        <div>
          <h2>Upcoming</h2>

          <span class="card-subtitle">
            Games with unresolved staffing
          </span>
        </div>
      </div>

      ${
        items.length
          ? `
              <div
                class="season-intelligence-list"
                data-testid="season-dashboard-upcoming-list"
              >
                ${items
                  .map(renderSeasonUpcomingItem)
                  .join("")}
              </div>
            `
          : `
              <div
                class="empty-state"
                data-testid="season-dashboard-upcoming-empty"
              >
                No upcoming staffing issues.
              </div>
            `
      }
    </section>
  `;
}

function renderSeasonUpcomingItem(item) {
  const staffingDetail = [
    item.openAssignments
      ? `${item.openAssignments} open`
      : "",
    item.pendingClaims
      ? `${item.pendingClaims} pending`
      : ""
  ]
    .filter(Boolean)
    .join(" • ");

  return `
    <article
      class="season-intelligence-item"
      data-testid="season-dashboard-upcoming-item"
      data-game-id="${escapeSeasonDashboardHtml(
        item.gameId
      )}"
    >
      <div class="season-intelligence-content">
        <strong>
          ${escapeSeasonDashboardHtml(
            item.title
          )}
        </strong>

        ${
          item.detail
            ? `
                <span class="muted">
                  ${escapeSeasonDashboardHtml(
                    item.detail
                  )}
                </span>
              `
            : ""
        }

        <span>
          ${escapeSeasonDashboardHtml(
            staffingDetail
          )}
        </span>
      </div>

      <button
        type="button"
        class="secondary-button"
        data-testid="season-dashboard-upcoming-action"
        onclick="handleSeasonDashboardUpcoming(
          '${escapeSeasonDashboardJs(
            item.gameId
          )}'
        )"
      >
        View
      </button>
    </article>
  `;
}

function renderSeasonHealthCard(items) {
  return `
    <section
      class="
        dashboard-card
        season-dashboard-card
        season-dashboard-intelligence
      "
      data-testid="season-dashboard-health"
    >
      <div class="card-header">
        <div>
          <h2>Operational Health</h2>

          <span class="card-subtitle">
            Current season performance indicators
          </span>
        </div>
      </div>

      <div
        class="season-health-grid"
        data-testid="season-dashboard-health-list"
      >
        ${items
          .map(renderSeasonHealthItem)
          .join("")}
      </div>
    </section>
  `;
}

function renderSeasonHealthItem(item) {
  return `
    <article
      class="
        season-health-item
        season-health-${escapeSeasonDashboardHtml(
          item.status
        )}
      "
      data-testid="season-dashboard-health-item"
      data-key="${escapeSeasonDashboardHtml(
        item.key
      )}"
      data-status="${escapeSeasonDashboardHtml(
        item.status
      )}"
    >
      <span class="season-health-label">
        ${escapeSeasonDashboardHtml(
          item.title
        )}
      </span>

      <strong
        class="season-health-value"
        data-testid="season-dashboard-health-${escapeSeasonDashboardHtml(
          item.key
        )}-value"
      >
        ${escapeSeasonDashboardHtml(
          item.valueLabel
        )}
      </strong>

      <span class="muted">
        ${escapeSeasonDashboardHtml(
          item.detail
        )}
      </span>
    </article>
  `;
}

function renderSeasonActivityCard(activities) {
  return `
    <section
      class="
        dashboard-card
        season-dashboard-card
        season-dashboard-activity
      "
      data-testid="season-dashboard-activity"
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
              <div
                class="assignment-activity-list"
                data-testid="season-dashboard-activity-list"
              >
                ${activities
                  .map(renderSeasonActivityItem)
                  .join("")}
              </div>
            `
          : `
              <div
                class="empty-state"
                data-testid="season-dashboard-activity-empty"
              >
                No recent operational activity.
              </div>
            `
      }
    </section>
  `;
}

function renderSeasonActivityItem(activity) {
  if (
    typeof renderRecentAssignmentActivityItem ===
      "function" &&
    activity.actionLabel
  ) {
    return renderRecentAssignmentActivityItem(
      activity
    );
  }

  return `
    <article
      class="assignment-activity-item"
      data-testid="season-dashboard-activity-item"
      data-activity-id="${escapeSeasonDashboardHtml(
        activity.id
      )}"
    >
      <div class="assignment-activity-content">
        <strong>
          ${escapeSeasonDashboardHtml(
            activity.actionLabel ||
            activity.action ||
            activity.type ||
            "Activity"
          )}
        </strong>

        ${
          activity.matchup
            ? `
                <span>
                  ${escapeSeasonDashboardHtml(
                    activity.matchup
                  )}
                </span>
              `
            : ""
        }

        ${
          activity.message
            ? `
                <span class="muted">
                  ${escapeSeasonDashboardHtml(
                    activity.message
                  )}
                </span>
              `
            : ""
        }
      </div>

      <time
        class="assignment-activity-time"
        datetime="${escapeSeasonDashboardHtml(
          activity.createdAt
        )}"
      >
        ${formatSeasonActivityTimestamp(
          activity.createdAt
        )}
      </time>
    </article>
  `;
}

function handleSeasonDashboardAction(action) {
  switch (action) {
    case "open-assignments":
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

      navigateTo("schedule", {
        filter: "open"
      });
      return;

    case "pending-claims":
      navigateTo("claims-queue", {
        status: "pending"
      });
      return;

    case "pending-approvals":
      navigateTo("accounts", {
        filter: "pending",
        status: "pending"
      });
      return;

    case "returned-reviews":
      navigateTo("review-queue", {
        filter: "returned",
        status: "returned"
      });
      return;

    case "awaiting-reviews":
      navigateTo("review-queue", {
        filter: "submitted",
        status: "submitted"
      });
      return;

    case "assignment-report":
      navigateTo("reports", {
        report: "assignments",
        type: "assignments"
      });
      return;

    case "availability-report":
      navigateTo("reports", {
        report: "availability",
        type: "availability"
      });
      return;

    case "review-report":
      navigateTo("reports", {
        report: "reviews",
        type: "reviews"
      });
      return;

    default:
      return;
  }
}

function handleSeasonDashboardUpcoming(gameId) {
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

  navigateTo("schedule", {
    filter: "open",
    highlightId: gameId
  });
}

function formatSeasonPercentage(value) {
  const numericValue = Number(value);

  return `${
    Number.isFinite(numericValue)
      ? numericValue
      : 0
  }%`;
}

function formatSeasonActivityTimestamp(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString();
}

function escapeSeasonDashboardJs(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'");
}

function escapeSeasonDashboardHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
