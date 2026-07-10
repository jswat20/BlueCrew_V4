// js/dashboard/todaysSchedule.js

function renderUpcomingSchedule() {
  const games = dashboardService.getUpcomingGames();

  return `
    <section
      class="dashboard-card todays-schedule"
      data-testid="dashboard-upcoming-games">

      <div class="card-header">
        <h2>Upcoming Games</h2>
        <span class="card-subtitle">
          ${games.length} shown
        </span>
      </div>

      ${
        games.length
          ? `
            <div class="today-game-list">
              ${games.map(renderUpcomingGame).join("")}
            </div>
          `
          : `
            <p
              class="placeholder"
              data-testid="dashboard-upcoming-empty">
              No upcoming games are scheduled.
            </p>
          `
      }
    </section>
  `;
}

function renderUpcomingGame(game) {
  const statusText = getUpcomingGameStatus(game);
  const statusClass = game.fullyStaffed
    ? "today-assigned"
    : "today-open";

  return `
    <div
      class="today-game ${statusClass}"
      data-testid="dashboard-upcoming-game-${game.id}">

      <div class="today-time">
        <strong>${formatDashboardDate(game.date)}</strong>
        <span>${game.time}</span>
      </div>

      <div class="today-details">
        <strong>${game.matchup}</strong>
        <span>
          ${[game.level, game.field].filter(Boolean).join(" • ")}
        </span>
      </div>

      <div
        class="today-crew ${game.fullyStaffed ? "" : "needs-crew-text"}">
        <strong>${statusText}</strong>
        <span>${game.crewName}</span>
      </div>

      <button
        type="button"
        class="small-action-btn"
        data-testid="dashboard-view-game-${game.id}"
        onclick="openDashboardGame('${game.id}')">
        View
      </button>
    </div>
  `;
}

function getUpcomingGameStatus(game) {
  if (game.pendingClaimCount > 0) {
    return `${game.pendingClaimCount} pending claim${
      game.pendingClaimCount === 1 ? "" : "s"
    }`;
  }

  if (game.openAssignmentCount > 0) {
    return `${game.openAssignmentCount} open assignment${
      game.openAssignmentCount === 1 ? "" : "s"
    }`;
  }

  return "Fully staffed";
}

function formatDashboardDate(dateString) {
  if (!dateString) return "";

  const date = new Date(`${dateString}T00:00:00`);

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}

function openDashboardGame(gameId) {
  uiStateService.clearSelections();
  uiStateService.setSelectedGame(gameId);
  uiStateService.setScheduleFilter("all");

  renderPage("schedule");
  setScheduleView("all");

  if (typeof openAssignmentDrawer === "function") {
    openAssignmentDrawer(gameId);
  }
}

// Backward compatibility for anything still calling the old renderer.
function renderTodaysSchedule() {
  return renderUpcomingSchedule();
}
