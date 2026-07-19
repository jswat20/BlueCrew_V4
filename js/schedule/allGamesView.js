// js/schedule/allGamesView.js

function renderAllGamesTable(container, context = {}) {
    let games = [...gameService.getAll()];

const filter =
  typeof getCurrentScheduleFilter === "function"
    ? getCurrentScheduleFilter()
    : (
        typeof uiStateService !== "undefined" &&
        typeof uiStateService.getScheduleFilter === "function"
          ? uiStateService.getScheduleFilter()
          : "all"
      );
      
  switch (filter) {
    case "today":
      games = games.filter(
        game => game.date === new Date().toISOString().split("T")[0]
      );
      break;

    case "assigned":
      games = games.filter(game =>
        assignmentService.isAssigned(game)
      );
      break;

    case "open":
      games = games.filter(game =>
        !assignmentService.isAssigned(game)
      );
      break;

    default:
      break;
  }

  const sortedGames = typeof applyScheduleAdvancedFilters === "function"
    ? applyScheduleAdvancedFilters(games)
    : games.sort(sortGames);

  container.innerHTML = `
    <section class="all-games-header presentation-page-header presentation-panel">
      <div>
        <h2>All Games</h2>
        <p>Full schedule table.</p>
      </div>
      <div class="all-games-filters" aria-label="Filter scheduled games">
        ${[
          ["all", "All Games"],
          ["today", "Games Today"],
          ["assigned", "Assigned"],
          ["open", "Open Positions"]
        ].map(([id, label]) => `
          <button
            type="button"
            class="button button-secondary ${filter === id ? "active" : ""}"
            data-testid="schedule-filter-${id}"
            aria-pressed="${filter === id}"
            onclick="setAllGamesScheduleFilter('${id}')"
          >${label}</button>
        `).join("")}
      </div>
    </section>

    <div class="schedule-table-wrap presentation-table-wrapper">
      <table class="schedule-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Time</th>
            <th>Field</th>
            <th>Level</th>
            <th>Matchup</th>
            <th>Crew</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          ${
            sortedGames.length
? sortedGames.map(game => renderAllGamesRow(game, context)).join("")
              : `
                <tr>
                  <td colspan="8">
                    No games loaded.
                  </td>
                </tr>
              `
          }
        </tbody>
      </table>
    </div>
  `;
}

function setAllGamesScheduleFilter(filter) {
  uiStateService.setScheduleFilter(filter || "all");
  currentScheduleView = "all";
  renderScheduleContent();
}

function renderAllGamesRow(game, context = {}) {
    const assigned = assignmentService.isAssigned(game);

  const crewName = assigned
    ? crewService.getDisplayName(game.crewId)
    : "Needs Crew";
const isHighlighted =
  context.highlightId &&
  String(game.id) === String(context.highlightId);

  return `
<tr
  class="${isHighlighted ? "is-highlighted" : ""}"
  data-testid="game-row-${game.id}"
  ${isHighlighted ? 'data-highlighted="true"' : ""}
>
      <td>${formatShortDate(game.date)}</td>

      <td>${game.time || ""}</td>

      <td>${game.field || ""}</td>

      <td>${game.level || ""}</td>

      <td>
        <strong>
          ${game.awayTeam || "Away"} @ ${game.homeTeam || "Home"}
        </strong>
      </td>

      <td>
        <span class="${assigned ? "crew-assigned" : "crew-open"}">
          ${crewName}
        </span>
      </td>

      <td>
        ${
          typeof renderAssignmentStatusBadge === "function"
            ? renderAssignmentStatusBadge(game)
            : `
              <span class="table-status status-badge ${assigned ? "assigned status-badge-approved" : "open status-badge-open"}">
                ${assigned ? "Assigned" : "Open"}
              </span>
            `
        }
      </td>

      <td>
        <button
  class="button button-primary"
  data-testid="view-game-${game.id}"
  onclick="openScheduleGameHub('${game.id}')"
>
  View Game Hub
</button>
      </td>
    </tr>
  `;
}
