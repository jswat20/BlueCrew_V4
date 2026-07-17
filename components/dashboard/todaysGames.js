
// components/dashboard/todaysGames.js

function getDashboardGameStaffingStatus(game) {
  if (game.pendingClaimCount > 0) {
    return {
      label: "Claim Pending",
      tone: "pending"
    };
  }

  if (game.openAssignmentCount > 0) {
    return {
      label: "Not Filled",
      tone: "open"
    };
  }

  return {
    label: "Filled",
    tone: "filled"
  };
}

function renderDashboardTodayGames() {
  const games = getDashboardTodayGames();

  return `
    <section
      class="
        dashboard-card
        dashboard-today-games
      "
      data-testid="dashboard-today-games"
    >
      <div class="dashboard-card-header">
        <div>
          <h2>Today&#39;s Games</h2>

          <span class="card-subtitle">
            ${games.length} scheduled
          </span>
        </div>

        <button
          type="button"
          class="dashboard-text-action"
          data-testid="dashboard-view-schedule"
          onclick='openDashboardSchedule(
            "all"
          )'
        >
          View Schedule
        </button>
      </div>

      ${
        games.length
          ? `
              <div
                class="dashboard-today-list"
                data-testid="dashboard-today-list"
              >
                <div
                  class="
                    dashboard-today-game
                    dashboard-today-header
                  "
                  aria-hidden="true"
                >
                  <span>Time</span>
                  <span>Game</span>
                  <span>Location</span>
                  <span>Status</span>
                </div>

                ${games
                  .slice(0, 8)
                  .map(
                    renderDashboardTodayGame
                  )
                  .join("")}
              </div>
            `
          : `
              <div
                class="empty-state"
                data-testid="dashboard-today-empty"
              >
                No games are scheduled today.
              </div>
            `
      }
    </section>
  `;
}

function renderDashboardTodayGame(game) {
  const status =
    getDashboardGameStaffingStatus(game);

  return `
    <button
      type="button"
      class="
        dashboard-today-game
        dashboard-today-row
      "
      data-testid="dashboard-today-game-${game.id}"
      onclick="openDashboardGame(
        '${game.id}'
      )"
    >
      <span class="dashboard-today-time">
        ${game.time || "TBD"}
      </span>

      <strong class="dashboard-today-matchup">
        ${game.matchup}
      </strong>

      <span class="dashboard-today-location">
        ${game.field || "Location TBD"}
      </span>

      <span
        class="
          dashboard-game-status
          dashboard-game-status-${status.tone}
        "
        data-testid="dashboard-game-status-${game.id}"
      >
        ${status.label}
      </span>
    </button>
  `;
}
