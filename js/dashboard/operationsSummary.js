// js/dashboard/operationsSummary.js

function renderOperationsSummary() {
  const tiles = dashboardService.getOperationsSummary();

  return `
    <section
      class="dashboard-card operations-summary"
      data-testid="operations-summary">

      <div class="card-header">
        <h2>Schedule Overview</h2>
        <span class="card-subtitle">Upcoming workload</span>
      </div>

      <div class="summary-grid">
        ${tiles.map(renderSummaryTile).join("")}
      </div>
    </section>
  `;
}

function renderSummaryTile(tile) {
  return `
    <button
      type="button"
      class="summary-tile summary-${tile.color}"
      data-testid="dashboard-summary-${tile.id}"
      onclick="handleDashboardTileClick('${tile.action}')">

      <div
        class="summary-value"
        data-testid="dashboard-summary-${tile.id}-value">
        ${tile.value}
      </div>

      <div class="summary-label">${tile.label}</div>
    </button>
  `;
}

function openDashboardSchedule(filter = "all") {
  uiStateService.clearSelections();
  uiStateService.setScheduleFilter(filter);

  renderPage("schedule");
  setScheduleView("all");
}

function handleDashboardTileClick(action) {
  switch (action) {
    case "upcoming-games":
      openDashboardSchedule("all");
      return;

    case "open-assignments":
      openDashboardSchedule("open");
      return;

    case "pending-claims":
      renderPage("claims-queue");
      return;

    case "pending-accounts":
      renderPage("accounts");
      return;

    default:
      openDashboardSchedule("all");
  }
}
