
// components/dashboard/dailyBrief.js

function renderDashboardBriefMetric({
  id,
  value,
  label,
  action,
  emphasis = ""
}) {
  const isPriority = id !== "today-games";
  const requiresAttention = emphasis === "dashboard-brief-alert";

  return `
    <button
      type="button"
      class="
        dashboard-brief-metric
        ${isPriority ? "dashboard-brief-metric-priority" : "dashboard-brief-metric-context"}
        ${emphasis}
      "
      data-testid="dashboard-summary-${id}"
      data-attention="${requiresAttention}"
      onclick='${action}'
    >
      <strong
        data-testid="dashboard-summary-${id}-value"
      >
        ${value}
      </strong>

      <span>${label}</span>
      <small>${isPriority ? "Open work" : "Operational context"}</small>
    </button>
  `;
}

function renderDashboardDailyBrief() {
  const brief = getDashboardBrief();

  const outstanding =
    getDashboardOutstandingCount(brief);

  return `
    <section
      class="
        dashboard-card
        presentation-card
        dashboard-daily-brief
      "
      data-testid="operations-summary"
    >
      <div class="dashboard-brief-heading">
        <div>
          <h2>The Daily Brief - Today At A Glance</h2>
        </div>

        <p
          class="dashboard-brief-message"
          data-testid="dashboard-brief-message"
        >
          ${
            outstanding
              ? `${outstanding} operational ${
                  outstanding === 1
                    ? "item requires"
                    : "items require"
                } attention.`
              : "No operational work is currently waiting."
          }
        </p>
      </div>

      <div class="dashboard-brief-grid">
        ${renderDashboardBriefMetric({
          id: "today-games",
          value: brief.todayGames,
          label:
            "Games Today",
          action:
            `openDashboardSchedule("today")`
        })}

        ${renderDashboardBriefMetric({
          id: "open-assignments",
          value: brief.openAssignments,
          label:
            "Open Positions",
          action:
            `openDashboardWorkbench(
              "open-positions"
            )`,
          emphasis:
            brief.openAssignments
              ? "dashboard-brief-alert"
              : ""
        })}

        ${renderDashboardBriefMetric({
          id: "pending-claims",
          value: brief.pendingClaims,
          label:
            "Pending Claims",
          action:
            `openDashboardOperations(
              "pendingClaims",
              "pending-claims"
            )`,
          emphasis:
            brief.pendingClaims
              ? "dashboard-brief-alert"
              : ""
        })}

        ${renderDashboardBriefMetric({
          id: "pending-reviews",
          value: brief.pendingReviews,
          label:
            "Reviews Waiting",
          action:
            `openDashboardOperations(
              "awaitingReview",
              "reviews"
            )`,
          emphasis:
            brief.pendingReviews
              ? "dashboard-brief-alert"
              : ""
        })}

        ${renderDashboardBriefMetric({
          id: "pending-accounts",
          value: brief.pendingAccounts,
          label:
            "Account Requests",
          action:
            `openDashboardOperations(
              "pendingAccounts",
              "pending-accounts"
            )`,
          emphasis:
            brief.pendingAccounts
              ? "dashboard-brief-alert"
              : ""
        })}
      </div>

    </section>
  `;
}
