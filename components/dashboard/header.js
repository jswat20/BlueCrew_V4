
// components/dashboard/header.js

function getDashboardUnreadNotificationCount() {
  if (
    typeof dashboardService !== "undefined" &&
    typeof dashboardService
      .getNotificationsSummary === "function"
  ) {
    return (
      dashboardService
        .getNotificationsSummary()
        .unreadCount || 0
    );
  }

  return 0;
}

function renderDashboardNotificationBell() {
  const unreadCount =
    getDashboardUnreadNotificationCount();

  return `
    <button
      type="button"
      class="dashboard-notification-bell"
      data-testid="dashboard-notification-bell"
      aria-label="${
        unreadCount === 1
          ? "1 unread notification"
          : `${unreadCount} unread notifications`
      }"
      onclick='navigateTo(
        "notifications",
        {
          filter: "unread"
        }
      )'
    >
      <svg
        class="dashboard-notification-icon"
        aria-hidden="true"
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path
          d="M18 8a6 6 0 0 0-12 0
             c0 7-3 7-3 9h18
             c0-2-3-2-3-9"
        ></path>
        <path
          d="M13.73 21
             a2 2 0 0 1-3.46 0"
        ></path>
      </svg>

      ${
        unreadCount
          ? `
              <span
                class="dashboard-notification-count"
                data-testid="dashboard-notification-count"
              >
                ${
                  unreadCount > 99
                    ? "99+"
                    : unreadCount
                }
              </span>
            `
          : ""
      }
    </button>
  `;
}

function renderDashboardWelcome() {
  const dateKey =
    new Date()
      .toISOString()
      .split("T")[0];

  return `
    <header
      class="dashboard-welcome"
      data-testid="dashboard-welcome"
    >
      <div class="dashboard-welcome-copy">
        <span class="dashboard-eyebrow">
          ${getDashboardGreeting()}
        </span>

        <h1
          data-testid="dashboard-welcome-name"
        >
          ${getDashboardUserName()}
        </h1>
      </div>

      <div class="dashboard-welcome-tools">
        <time
          class="dashboard-current-date"
          data-testid="dashboard-current-date"
          datetime="${dateKey}"
        >
          ${formatDashboardCurrentDate()}
        </time>

        ${renderDashboardNotificationBell()}
      </div>
    </header>
  `;
}
