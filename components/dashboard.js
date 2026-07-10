// components/dashboard.js

function renderDashboard() {
  return `
    <div
      class="dashboard-grid"
      data-testid="operations-dashboard">

      ${
        typeof renderOperationsSummary === "function"
          ? renderOperationsSummary()
          : ""
      }

      ${
        typeof renderNeedsAttention === "function"
          ? renderNeedsAttention()
          : ""
      }

      ${
        typeof renderUpcomingSchedule === "function"
          ? renderUpcomingSchedule()
          : (
              typeof renderTodaysSchedule === "function"
                ? renderTodaysSchedule()
                : ""
            )
      }

    </div>
  `;
}
