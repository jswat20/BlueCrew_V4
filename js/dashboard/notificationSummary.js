// js/dashboard/notificationSummary.js

function renderNotificationSummary() {
  const summary =
    dashboardService
      .getNotificationsSummary();

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

      <button
        type="button"
        class="secondary-button"
        data-testid="dashboard-open-notifications"
        onclick="navigateTo(
          'notifications',
          {}
        )"
      >
        View Notifications
      </button>
    </section>
  `;
}
