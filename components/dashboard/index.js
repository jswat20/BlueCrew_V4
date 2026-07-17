
// components/dashboard/index.js

function renderDashboard() {
  return `
    <div
      class="operations-dashboard"
      data-testid="operations-dashboard"
    >
      ${renderDashboardWelcome()}

      <div class="dashboard-entry-grid">
        <div class="dashboard-entry-main">
          ${renderDashboardDailyBrief()}
          ${renderDashboardTodayGames()}
        </div>

        <div class="dashboard-entry-activity">
          ${
            typeof renderRecentAssignmentActivity ===
              "function"
              ? renderRecentAssignmentActivity()
              : ""
          }
        </div>
      </div>
    </div>
  `;
}
