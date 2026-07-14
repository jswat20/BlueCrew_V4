// js/dashboard/notificationSummary.js

function renderNotificationSummary() {
  const summary =
    dashboardService
      .getNotificationsSummary();

  const categoryLabels = {
    assignments: "Assignments",
    claims: "Claims",
    reviews: "Reviews",
    availability: "Availability",
    accounts: "Accounts",
    returnedReview:
      "Returned Reviews",
    activityDigest:
      "Activity"
  };

  return `
    <section
      class="dashboard-card"
      data-testid="dashboard-notifications-card"
    >
      <div class="dashboard-card-header">
        <div>
          <h2>Notifications</h2>

          <span class="card-subtitle">
            Operational updates
          </span>
        </div>

        <span
          class="status-badge"
          data-testid="dashboard-notifications-count"
        >
          ${summary.unreadCount}
        </span>
      </div>

      <p
        class="muted"
        data-testid="dashboard-notifications-summary"
      >
        ${
          summary.unreadCount === 1
            ? "1 unread notification"
            : `${summary.unreadCount} unread notifications`
        }
      </p>

      ${
        summary.unreadCategories.length
          ? `
              <div
                class="filter-chip-group"
                data-testid="dashboard-notification-categories"
              >
                ${summary.unreadCategories
                  .map(
                    category => `
                      <button
                        type="button"
                        class="filter-chip"
                        data-testid="dashboard-notification-${
                          category.key
                        }"
                        onclick="handleOpenNotificationFilter(
                          '${category.key}'
                        )"
                      >
                        ${
                          categoryLabels[
                            category.key
                          ] ||
                          category.key
                        }
                        ${category.count}
                      </button>
                    `
                  )
                  .join("")}
              </div>
            `
          : ""
      }

      <p
        class="muted"
        data-testid="dashboard-notifications-muted"
      >
        ${
          summary.mutedCategoryCount
            ? `${summary.mutedCategoryCount} muted ${
                summary.mutedCategoryCount === 1
                  ? "category"
                  : "categories"
              }`
            : "No muted categories"
        }
      </p>

      <div class="notification-center-actions">
        <button
          type="button"
          class="secondary-button"
          data-testid="dashboard-open-notifications"
          onclick="handleOpenNotificationFilter(
            'all'
          )"
        >
          View Notifications
        </button>

        ${
          summary.hasUnread
            ? `
                <button
                  type="button"
                  class="secondary-button"
                  data-testid="dashboard-open-unread-notifications"
                  onclick="handleOpenNotificationFilter(
                    'unread'
                  )"
                >
                  View Unread
                </button>
              `
            : ""
        }
      </div>
    </section>
  `;
}

function handleOpenNotificationFilter(
  filter
) {
  uiStateService
    .setNotificationFilter(
      filter || "all"
    );

  uiStateService
    .clearNotificationSelection();

  navigateTo(
    "notifications",
    {
      filter:
        filter || "all"
    }
  );
}
