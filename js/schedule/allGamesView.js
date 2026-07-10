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

  const sortedGames = games.sort(sortGames);

  container.innerHTML = `
    <section class="all-games-header">
      <h2>All Games</h2>
      <p>Full schedule table.</p>
    </section>

    <div class="schedule-table-wrap">
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
              <span class="table-status ${assigned ? "assigned" : "open"}">
                ${assigned ? "Assigned" : "Open"}
              </span>
            `
        }
      </td>

      <td>
        <button
  data-testid="assign-game-${game.id}"
  onclick="openAssignmentDrawer('${game.id}')"
>
  Assign
</button>

<button
  data-testid="edit-game-${game.id}"
  onclick="editGame('${game.id}')"
>
  Edit
</button>

<button
  data-testid="delete-game-${game.id}"
  onclick="deleteGame('${game.id}')"
>
  Delete
</button>
      </td>
    </tr>
  `;
}