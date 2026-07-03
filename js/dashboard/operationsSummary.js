// operationsSummary.js

function renderOperationsSummary() {
  const tiles = dashboardService.getOperationsSummary();

  return `
    <section class="dashboard-card operations-summary">
      <div class="card-header">
        <h2>Operations Summary</h2>
        <span class="card-subtitle">Today's Snapshot</span>
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
      class="summary-tile summary-${tile.color}" 
      onclick="handleDashboardTileClick('${tile.action}')"
    >
      <div class="summary-value">${tile.value}</div>
      <div class="summary-label">${tile.label}</div>
    </button>
  `;
}

function handleDashboardTileClick(action) {

  uiStateService.clearSelections();

  switch (action) {

    case "today":
      uiStateService.setScheduleFilter("today");
      break;

    case "assigned":
      uiStateService.setScheduleFilter("assigned");
      break;

    case "open":
      uiStateService.setScheduleFilter("open");
      break;

    case "conflicts":
      uiStateService.setScheduleFilter("conflicts");
      break;

    case "crew":
      renderPage("crew");
      return;

    default:
      uiStateService.setScheduleFilter("all");
  }

 renderPage("schedule");

setScheduleView("all");
}