const claimGamesState = { sort: "date", direction: "asc", weekdays: [], levels: [], location: "" };

function getClaimGameLocation(game) {
  return game.locationComplex || game.complex || game.gameInformation?.venue || "Location TBD";
}

function getClaimGameField(game) {
  return locationService.getFieldDisplayName(game);
}

function applyClaimGameView(games) {
  const filtered = games.filter(game => {
    const weekday = new Date(`${game.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long" });
    return (!claimGamesState.weekdays.length || claimGamesState.weekdays.includes(weekday)) &&
      (!claimGamesState.levels.length || claimGamesState.levels.includes(String(game.level))) &&
      (!claimGamesState.location || getClaimGameLocation(game) === claimGamesState.location);
  });
  const direction = claimGamesState.direction === "desc" ? -1 : 1;
  return filtered.sort((a, b) => {
    const key = claimGamesState.sort;
    const result = key === "date" || key === "time"
      ? dateTimeFormattingService.toSortableDateTime(a.date, a.time) - dateTimeFormattingService.toSortableDateTime(b.date, b.time)
      : String(key === "level" ? a.level : key === "location" ? getClaimGameLocation(a) : getClaimGameField(a)).localeCompare(String(key === "level" ? b.level : key === "location" ? getClaimGameLocation(b) : getClaimGameField(b)));
    return direction * (result || String(a.id).localeCompare(String(b.id)));
  });
}

function claimGamesOption(values, selected) {
  return [...new Set(values)].sort().map(value => `<option value="${value}" ${value === selected ? "selected" : ""}>${value}</option>`).join("");
}

function renderClaimGames() {
  const allGames = portalService.getClaimableGames();
  const games = applyClaimGameView([...allGames]);
  const activeFilterCount = claimGamesState.weekdays.length + claimGamesState.levels.length + (claimGamesState.location ? 1 : 0);

  if (!games.length) {
    return `
      <div class="card" data-testid="claim-games-empty">
        <h3>No Games Available</h3>
        <p>${allGames.length ? "No claimable games match your current filters." : "There are currently no games available to claim. Newly available games will appear here."}</p>
        ${allGames.length ? `<button type="button" class="button button-secondary" onclick="clearClaimGameFilters()">Clear Filters</button>` : ""}
      </div>
    `;
  }

  return `
    <section class="card presentation-card claim-games-compact shared-game-list" data-testid="claim-games">
      <div class="presentation-card-header-blue"><h2>Available Games</h2><span aria-live="polite">${games.length} ${games.length === 1 ? "game" : "games"}</span></div>
      <details class="game-list-filters" open><summary>Filter Games${activeFilterCount ? ` (${activeFilterCount} active)` : ""}</summary><div class="game-list-filter-grid">
        <div class="game-list-filter-options">
          <fieldset><legend>Weekday</legend><div>${["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map(day => `<label><input type="checkbox" value="${day}" ${claimGamesState.weekdays.includes(day) ? "checked" : ""} onchange="updateClaimGameWeekday('${day}', this.checked)">${day}</label>`).join("")}</div></fieldset>
          <fieldset><legend>Level</legend><div>${[...new Set(allGames.map(game => String(game.level || "")).filter(Boolean))].sort().map(level => `<label><input type="checkbox" value="${level}" ${claimGamesState.levels.includes(level) ? "checked" : ""} onchange="updateClaimGameLevel('${level}', this.checked)">${levelTerminologyService.format(level)}</label>`).join("")}</div></fieldset>
        </div>
        <div class="game-list-filter-actions"><label>Location<select onchange="updateClaimGameFilter('location', this.value)"><option value="">All locations</option>${claimGamesOption(allGames.map(getClaimGameLocation), claimGamesState.location)}</select></label><button type="button" class="button button-secondary" onclick="clearClaimGameFilters()">Clear Filters</button></div>
      </div></details>
      <div class="presentation-table-wrapper" tabindex="0" role="region" aria-label="Available games table">
      <table class="table presentation-table presentation-table-centered claim-games-table">
        <thead>
          <tr>
            ${[['date','Day/Date'],['time','Time'],['level','Level'],['location','Location'],['field','Field']].map(([key,label]) => `<th aria-sort="${claimGamesState.sort === key ? (claimGamesState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}"><button type="button" class="table-sort-button" onclick="sortClaimGames('${key}')">${label}</button></th>`).join('')}
            <th>Status</th>
            <th>Claim</th>
          </tr>
        </thead>

        <tbody>
          ${games.map(game => `
            <tr data-testid="claim-game-row-${game.id}">
              <td class="claim-game-date">${dateTimeFormattingService.formatDayDate(game.date)}</td>
              <td class="claim-game-time">${dateTimeFormattingService.formatTime12Hour(game.time, "TBD")}</td>
              <td class="claim-game-level">${levelTerminologyService.format(game.level)}</td>
              <td class="claim-game-location">${getClaimGameLocation(game)}</td>
              <td class="claim-game-field">${getClaimGameField(game)}</td>
              <td class="claim-game-status"><span class="status-badge ${presentationFormattingService.getStatusBadgeClass("Needs Assignment")}">${game.filledPositions || 0} / ${game.crewSize || 1} filled</span></td>
              <td class="claim-game-action">
                <button
                  class="button button-primary"
                  data-testid="claim-game-${game.id}"
                  data-game-id="${game.id}"
                  onclick="renderPage('game-hub', { gameId: this.dataset.gameId, origin: 'claim-games', returnPage: 'claim-games' })">
                  Claim
                </button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table></div>
    </section>
  `;
}

function claimPortalGameFromButton(button) {
  return claimPortalGame(button?.dataset?.gameId || "");
}

function updateClaimGameWeekday(day, checked) { claimGamesState.weekdays = checked ? [...claimGamesState.weekdays, day] : claimGamesState.weekdays.filter(value => value !== day); renderPage("claim-games"); }
function updateClaimGameLevel(level, checked) { claimGamesState.levels = checked ? [...claimGamesState.levels, level] : claimGamesState.levels.filter(value => value !== level); renderPage("claim-games"); }
function updateClaimGameFilter(key, value) { claimGamesState[key] = value; renderPage("claim-games"); }
function clearClaimGameFilters() { Object.assign(claimGamesState, { weekdays: [], levels: [], location: "" }); renderPage("claim-games"); }
function sortClaimGames(key) { claimGamesState.direction = claimGamesState.sort === key && claimGamesState.direction === "asc" ? "desc" : "asc"; claimGamesState.sort = key; renderPage("claim-games"); }

async function claimPortalGame(gameId) {
  const result = await portalService.claimGame(gameId);

  if (result.success) {
    toastService.success(result.message);
    renderPage("claim-games");
  } else {
    toastService.error(result.message);
  }
}
