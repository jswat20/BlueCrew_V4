
// js/dashboard/recentAssignmentActivity.js

function getDashboardActivityStartTime() {
  const session =
    typeof loginService !== "undefined" &&
    typeof loginService
      .getCurrentSession === "function"
      ? loginService.getCurrentSession()
      : null;

  if (session?.previousLoginAt) {
    return session.previousLoginAt;
  }

  return new Date(
    Date.now() -
    24 * 60 * 60 * 1000
  ).toISOString();
}

function getDashboardRecentActivity() {
  if (
    typeof dashboardService === "undefined" ||
    typeof dashboardService.getRecentOperationalActivity !== "function"
  ) {
    return [];
  }

  const cutoff = Date.now() - 24 * 60 * 60 * 1000;

  return dashboardService
    .getRecentOperationalActivity(50)
    .filter(activity => {
      const timestamp = new Date(activity.createdAt || "").getTime();
      return Number.isFinite(timestamp) && timestamp >= cutoff;
    });
}

function getDashboardActivityHeading() {
  const session =
    typeof loginService !== "undefined" &&
    typeof loginService
      .getCurrentSession === "function"
      ? loginService.getCurrentSession()
      : null;

  return session?.previousLoginAt
    ? "Since your last login"
    : "Activity from the last 24 hours";
}

function renderRecentAssignmentActivity() {
  const activities =
    getDashboardRecentActivity();

  return `
    <section
      class="
        dashboard-card
        dashboard-activity-feed
        operations-panel
        operations-log
      "
      data-testid="dashboard-assignment-activity"
    >
      <div class="card-header operations-section-heading">
        <div>
          <h3>Recent Activity</h3>

          <span
            class="card-subtitle"
            data-testid="dashboard-activity-period"
            hidden
          >
            ${getDashboardActivityHeading()}
          </span>
        </div>
      </div>

      ${
        activities.length
          ? `
              <div
                class="assignment-activity-list operations-log-list"
                data-testid="dashboard-assignment-activity-list"
              >
                ${activities
                  .map((activity, index) =>
                    renderOperationsCenterActivityItem(
                      activity,
                      index,
                      { dashboard: true }
                    )
                  )
                  .join("")}
              </div>
            `
          : `
              <div
                class="empty-state operations-feed-empty"
                data-testid="dashboard-assignment-activity-empty"
              >
                No recent activity.
              </div>
            `
      }
    </section>
  `;
}

function renderDashboardActivityItem(
  activity
) {
  return `
    <article
      class="
        assignment-activity-item
        dashboard-timeline-item
        operations-log-row
      "
      data-testid="dashboard-assignment-activity-item"
      data-activity-id="${escapeDashboardActivityHtml(
        activity.id
      )}"
      data-activity-type="${escapeDashboardActivityHtml(
        activity.type
      )}"
    >
      <time
        class="assignment-activity-time operations-log-time"
        data-testid="dashboard-assignment-activity-time"
        datetime="${escapeDashboardActivityHtml(
          activity.createdAt
        )}"
      >
        ${formatDashboardActivityTimestamp(
          activity.createdAt
        )}
      </time>

      <span class="operations-log-type dashboard-timeline-category" data-testid="dashboard-activity-category">
        <span class="operations-feed-signal" aria-hidden="true"></span>
        ${escapeDashboardActivityHtml(activity.category)}
      </span>

      <span class="operations-log-location" data-testid="dashboard-assignment-activity-matchup">
        ${escapeDashboardActivityHtml(activity.matchup || "—")}
      </span>

      <span class="operations-log-actor">${escapeDashboardActivityHtml(activity.actor || "System")}</span>

      <strong class="operations-log-action" data-testid="dashboard-assignment-activity-action">
        ${escapeDashboardActivityHtml(activity.story)}
      </strong>
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

  const elapsed =
    Date.now() - date.getTime();

  const minutes =
    Math.floor(
      elapsed / 60000
    );

  if (minutes < 1) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours =
    Math.floor(
      minutes / 60
    );

  if (hours < 24) {
    return `${hours}h ago`;
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
