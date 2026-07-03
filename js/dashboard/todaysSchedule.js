// todaysSchedule.js

function renderTodaysSchedule() {
  const games = dashboardService.getTodaysSchedule();

  return `
    <section class="dashboard-card todays-schedule">
      <div class="card-header">
        <h2>Today's Schedule</h2>
        <span class="card-subtitle">${games.length} games</span>
      </div>

      ${
        games.length
          ? `<div class="today-game-list">
              ${games.map(renderTodayGame).join("")}
            </div>`
          : `<p class="placeholder">No games scheduled for today.</p>`
      }
    </section>
  `;
}

function renderTodayGame(game) {
  return `
    <div class="today-game ${game.assigned ? "today-assigned" : "today-open"}">
      <div class="today-time">${game.time}</div>

      <div class="today-details">
        <strong>${game.matchup}</strong>
        <span>${game.level} • ${game.field}</span>
      </div>

      <div class="today-crew ${game.assigned ? "" : "needs-crew-text"}">
        ${game.crewName}
      </div>

      <button class="small-action-btn" onclick="renderPage('schedule')">
        View
      </button>
    </div>
  `;
}