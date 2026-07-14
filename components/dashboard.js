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
        typeof renderAccountRoleSummary === "function"
          ? renderAccountRoleSummary()
          : ""
      }

      ${
        typeof renderNeedsAttention === "function"
          ? renderNeedsAttention()
          : ""
      }

      ${
        typeof renderNotificationSummary ===
          "function"
          ? renderNotificationSummary()
          : ""
      }

      ${
        typeof renderAvailabilityReminder === "function"
          ? renderAvailabilityReminder()
          : ""
      }

      ${
        typeof renderReviewQueueSummary === "function"
          ? renderReviewQueueSummary()
          : ""
      }

      ${
        typeof renderRecentAssignmentActivity === "function"
          ? renderRecentAssignmentActivity()
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
