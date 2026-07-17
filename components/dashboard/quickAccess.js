
// components/dashboard/quickAccess.js

function getDashboardQuickLinks() {
  return [
    {
      id: "operations",
      label: "Operations",
      description:
        "Resolve assignments, claims, reviews, and conflicts.",
      page: "operations-center"
    },
    {
      id: "schedule",
      label: "Schedule",
      description:
        "View games and assignment coverage.",
      page: "schedule"
    },
    {
      id: "crew",
      label: "Crew",
      description:
        "Manage officials and crew information.",
      page: "crew"
    },
    {
      id: "reports",
      label: "Reports",
      description:
        "Review performance and season data.",
      page: "reports"
    },
    {
      id: "notifications",
      label: "Notifications",
      description:
        "Review recent changes and alerts.",
      page: "notifications"
    },
    {
      id: "admin",
      label: "Administration",
      description:
        "Manage accounts and application data.",
      page: "admin"
    }
  ];
}

function renderDashboardQuickAccess() {
  return `
    <section
      class="
        dashboard-card
        dashboard-quick-access
      "
      data-testid="dashboard-quick-access"
    >
      <div class="dashboard-card-header">
        <div>
          <h2>Quick Access</h2>

          <span class="card-subtitle">
            Go directly to the work you need.
          </span>
        </div>
      </div>

      <div class="dashboard-quick-grid">
        ${getDashboardQuickLinks()
          .map(renderDashboardQuickLink)
          .join("")}
      </div>
    </section>
  `;
}

function renderDashboardQuickLink(link) {
  return `
    <button
      type="button"
      class="dashboard-quick-link"
      data-testid="dashboard-quick-${link.id}"
      onclick='navigateTo(
        "${link.page}"
      )'
    >
      <strong>${link.label}</strong>
      <span>${link.description}</span>
    </button>
  `;
}
