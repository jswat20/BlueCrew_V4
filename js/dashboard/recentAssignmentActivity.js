// js/dashboard/recentAssignmentActivity.js

function renderRecentAssignmentActivity() {
  const activities =
    dashboardService.getRecentAssignmentActivity();

  return `
    <section
      class="
        dashboard-card
        recent-assignment-activity
      "
      data-testid="dashboard-assignment-activity"
    >
      <div class="card-header">
        <div>
          <h2>
            Recent Assignment Activity
          </h2>

          <span class="card-subtitle">
            Latest assignment updates
          </span>
        </div>
      </div>

      ${
        activities.length
          ? `
              <div
                class="assignment-activity-list"
                data-testid="dashboard-assignment-activity-list"
              >
                ${activities
                  .map(
                    renderRecentAssignmentActivityItem
                  )
                  .join("")}
              </div>
            `
          : `
              <div
                class="empty-state"
                data-testid="dashboard-assignment-activity-empty"
              >
                No recent assignment activity.
              </div>
            `
      }
    </section>
  `;
}

function renderRecentAssignmentActivityItem(
  activity
) {
  return `
    <article
      class="assignment-activity-item"
      data-testid="dashboard-assignment-activity-item"
      data-activity-id="${escapeDashboardActivityHtml(
        activity.id
      )}"
      data-action="${escapeDashboardActivityHtml(
        activity.action
      )}"
    >
      <div class="assignment-activity-content">
        <strong
          data-testid="dashboard-assignment-activity-action"
        >
          ${escapeDashboardActivityHtml(
            activity.actionLabel
          )}
        </strong>

        <span
          data-testid="dashboard-assignment-activity-matchup"
        >
          ${escapeDashboardActivityHtml(
            activity.matchup
          )}
        </span>

        ${
          activity.message
            ? `
                <span class="muted">
                  ${escapeDashboardActivityHtml(
                    activity.message
                  )}
                </span>
              `
            : ""
        }
      </div>

      <time
        class="assignment-activity-time"
        data-testid="dashboard-assignment-activity-time"
        datetime="${escapeDashboardActivityHtml(
          activity.createdAt
        )}"
      >
        ${formatDashboardActivityTimestamp(
          activity.createdAt
        )}
      </time>
    </article>
  `;
}

function formatDashboardActivityTimestamp(
  createdAt
) {
  if (!createdAt) {
    return "";
  }

  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString();
}

function escapeDashboardActivityHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
