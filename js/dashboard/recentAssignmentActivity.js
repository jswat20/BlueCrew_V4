
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
  const since =
    getDashboardActivityStartTime();

  if (
    typeof timelineService !== "undefined" &&
    typeof timelineService.getSince ===
      "function"
  ) {
    return timelineService.getSince(
      since,
      20
    );
  }

  if (
    typeof activityService === "undefined"
  ) {
    return [];
  }

  const activities =
    typeof activityService.getSince ===
      "function"
      ? activityService.getSince(
          since,
          20
        )
      : activityService.getRecent(20);

  return activities.map(activity => ({
    id: activity.id || "",
    type: activity.type || "general",
    category: "Activity",
    story:
      activity.message ||
      activity.matchup ||
      "Activity recorded.",
    createdAt:
      activity.createdAt || ""
  }));
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
      "
      data-testid="dashboard-assignment-activity"
    >
      <div class="card-header">
        <div>
          <h2>Recent Activity</h2>

          <span
            class="card-subtitle"
            data-testid="dashboard-activity-period"
          >
            ${getDashboardActivityHeading()}
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
                    renderDashboardActivityItem
                  )
                  .join("")}
              </div>
            `
          : `
              <div
                class="empty-state"
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
      "
      data-testid="dashboard-assignment-activity-item"
      data-activity-id="${escapeDashboardActivityHtml(
        activity.id
      )}"
      data-activity-type="${escapeDashboardActivityHtml(
        activity.type
      )}"
    >
      <div
        class="dashboard-timeline-marker"
        aria-hidden="true"
      ></div>

      <div class="assignment-activity-content">
        <span
          class="dashboard-timeline-category"
          data-testid="dashboard-activity-category"
        >
          ${escapeDashboardActivityHtml(
            activity.category
          )}
        </span>

        <strong
          data-testid="dashboard-assignment-activity-action"
        >
          ${escapeDashboardActivityHtml(
            activity.story
          )}
        </strong>

        <span
          data-testid="dashboard-assignment-activity-matchup"
          hidden
        >
          ${escapeDashboardActivityHtml(
            activity.matchup || ""
          )}
        </span>
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
