
// components/dashboard/dailyBrief.js

function renderDashboardBriefMetric({
  id,
  value,
  label,
  action,
  emphasis = ""
}) {
  return `
    <button
      type="button"
      class="
        dashboard-brief-metric
        ${emphasis}
      "
      data-testid="dashboard-summary-${id}"
      onclick='${action}'
    >
      <strong
        data-testid="dashboard-summary-${id}-value"
      >
        ${value}
      </strong>

      <span>${label}</span>
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
          <span class="dashboard-eyebrow">
            Daily Brief
          </span>

          <h2>Today at a glance</h2>
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
            brief.todayGames === 1
              ? "game today"
              : "games today",
          action:
            `openDashboardSchedule("all")`
        })}

        ${renderDashboardBriefMetric({
          id: "open-assignments",
          value: brief.openAssignments,
          label:
            brief.openAssignments === 1
              ? "open position"
              : "open positions",
          action:
            `openDashboardOperations(
              "needsAssignment"
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
            brief.pendingClaims === 1
              ? "pending claim"
              : "pending claims",
          action:
            `openDashboardOperations(
              "pendingClaims"
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
            brief.pendingReviews === 1
              ? "review waiting"
              : "reviews waiting",
          action:
            `openDashboardOperations(
              "awaitingReview"
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
            brief.pendingAccounts === 1
              ? "account request"
              : "account requests",
          action:
            `openDashboardOperations(
              "pendingAccounts"
            )`,
          emphasis:
            brief.pendingAccounts
              ? "dashboard-brief-alert"
              : ""
        })}
      </div>

      <div class="dashboard-brief-actions">
        <button
          type="button"
          class="button button-primary primary-btn"
          data-testid="dashboard-open-operations"
          onclick='navigateTo(
            "operations-center"
          )'
        >
          Open Operations Center
        </button>
      </div>
    </section>
  `;
}
