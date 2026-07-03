// dashboard.js

// dashboard.js

function renderDashboard() {
  return `
    <div class="dashboard-grid">

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
        typeof renderTodaysSchedule === "function"
          ? renderTodaysSchedule()
          : ""
      }

      ${
        typeof renderCrewStatus === "function"
          ? renderCrewStatus()
          : ""
      }

      ${
        typeof renderAIRecommendations === "function"
          ? renderAIRecommendations()
          : ""
      }

      ${
        typeof renderRecentActivity === "function"
          ? renderRecentActivity()
          : ""
      }

    </div>
  `;
}