// js/schedule/allGamesView.js

function renderAllGamesTable(container, context = {}) {
    let games = [...gameService.getAll()];
    const today = typeof getLocalScheduleDate === "function" ? getLocalScheduleDate() : new Date().toISOString().split("T")[0];

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
        game => game.date === today
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

  if (!scheduleIncludePastGames) games = games.filter(game => String(game.date || "") >= today);

  const filteredGames = typeof applyScheduleAdvancedFilters === "function"
    ? applyScheduleAdvancedFilters(games)
    : games.sort(sortGames);
  const sortedGames = typeof applyScheduleQuickSort === "function" ? applyScheduleQuickSort(filteredGames) : filteredGames;
  const sortableHeader = (field, label) => {
    const active = scheduleQuickSort.field === field;
    const direction = active ? scheduleQuickSort.direction : "none";
    const next = active && direction === "asc" ? "descending" : "ascending";
    return `<th aria-sort="${active ? direction === "asc" ? "ascending" : "descending" : "none"}" class="schedule-sortable-header schedule-column-${field}"><button type="button" class="schedule-header-sort" data-testid="schedule-quick-sort-${field}" aria-label="Sort ${label} ${next}" onclick="setScheduleQuickSort('${field}')"><span>${label}</span><span aria-hidden="true">${active ? direction === "asc" ? "↑" : "↓" : "↕"}</span></button></th>`;
  };

  container.innerHTML = `
    <section class="all-games-header presentation-page-header presentation-panel">
      <div>
        <h2>All Games</h2>
        <p>Full schedule table.</p>
      </div>
      <div class="all-games-filters" aria-label="Filter scheduled games">
        <button type="button" class="button button-secondary ${scheduleIncludePastGames ? "active" : ""}" data-testid="schedule-include-past" aria-pressed="${scheduleIncludePastGames}" onclick="toggleSchedulePastGames()">Include Past Games</button>
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
            ${sortableHeader("date", "Date")}
            ${sortableHeader("time", "Time")}
            ${sortableHeader("complex", "Complex")}
            ${sortableHeader("field", "Field")}
            ${sortableHeader("level", "Level")}
            <th>Matchup</th>
            <th>Crew</th>
            ${sortableHeader("status", "Status")}
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          ${
            sortedGames.length
? sortedGames.map(game => renderAllGamesRow(game, context)).join("")
              : `
                <tr>
                  <td colspan="9">
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
  const status = getScheduleDisplayStatus(game);

  return `
<tr
  class="${isHighlighted ? "is-highlighted" : ""}"
  data-testid="game-row-${game.id}"
  ${isHighlighted ? 'data-highlighted="true"' : ""}
>
      <td>${formatShortDate(game.date)}</td>

      <td class="schedule-column-time">${dateTimeFormattingService.formatTime12Hour(game.time, "Time unavailable")}</td>

      <td class="schedule-column-complex">${game.locationComplex || "Complex unavailable"}</td>

      <td>${game.locationField || game.field || "Field unavailable"}</td>

      <td>${levelTerminologyService.format(game.level) || "Level unavailable"}</td>

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
        <span class="table-status status-badge ${status.className}" data-testid="schedule-status-${game.id}">${status.label}</span>
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
