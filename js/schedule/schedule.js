// js/schedule/schedule.js

let currentScheduleView = "daily";
let currentScheduleDate = null;
let currentScheduleContext = {};
const scheduleAdvancedFilters = {
  date: "", time: "", locationComplex: "", field: "", level: "", matchup: "", crew: "", status: "", sort: "date", direction: "asc"
};
let scheduleIncludePastGames = false;
let scheduleQuickSort = { field: "", direction: "asc" };

function getLocalScheduleDate() {
  const value = new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function getScheduleTimeMinutes(value) {
  const text = String(value || "").trim();
  const twelve = text.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (twelve) { let hour = Number(twelve[1]) % 12; if (twelve[3].toUpperCase() === "PM") hour += 12; return hour * 60 + Number(twelve[2]); }
  const canonical = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  return canonical ? Number(canonical[1]) * 60 + Number(canonical[2]) : -1;
}

function setScheduleQuickSort(field) {
  scheduleQuickSort = scheduleQuickSort.field === field
    ? { field, direction: scheduleQuickSort.direction === "asc" ? "desc" : "asc" }
    : { field, direction: "asc" };
  renderScheduleContent();
}

function toggleSchedulePastGames() {
  scheduleIncludePastGames = !scheduleIncludePastGames;
  renderScheduleContent();
}

function applyScheduleQuickSort(games = []) {
  if (!scheduleQuickSort.field) return games;
  const field = scheduleQuickSort.field;
  const direction = scheduleQuickSort.direction === "desc" ? -1 : 1;
  const levelOrder = Array.isArray(settings?.levels) ? settings.levels : [];
  const value = game => {
    if (field === "time") return getScheduleTimeMinutes(game.time);
    if (field === "field") return game.locationField || game.field || "";
    if (field === "complex") return game.locationComplex || "";
    if (field === "level") { const canonical = levelTerminologyService.canonicalize(game.level); const index = levelOrder.indexOf(canonical); return index >= 0 ? index : `z-${levelTerminologyService.format(canonical)}`; }
    if (field === "status") return getScheduleDisplayStatus(game).key;
    return game[field] || "";
  };
  return games.map((game, index) => ({ game, index })).sort((left, right) => {
    const primary = String(value(left.game)).localeCompare(String(value(right.game)), undefined, { numeric: true, sensitivity: "base" });
    if (primary) return primary * direction;
    const tie = `${left.game.date || ""}\0${String(getScheduleTimeMinutes(left.game.time)).padStart(4, "0")}\0${left.game.id || left.index}`.localeCompare(`${right.game.date || ""}\0${String(getScheduleTimeMinutes(right.game.time)).padStart(4, "0")}\0${right.game.id || right.index}`);
    return tie;
  }).map(item => item.game);
}

function getScheduleDisplayStatus(game) {
  const lifecycle = gameService.getStatus(game);
  if (lifecycle === "completed" || lifecycle === "approved" || lifecycle === "submitted") return { key: "completed", label: "Completed", className: "status-badge-approved" };
  if (lifecycle === "cancelled") return { key: "cancelled", label: "Cancelled", className: "status-badge-danger" };
  const assignment = assignmentService.getStatus(game);
  if (["needs_assignment", "open_for_claim", "pending_approval"].includes(assignment)) return { key: "needs_assignment", label: "Needs Assignment", className: "status-badge-needs-assignment" };
  return { key: assignment === "assigned" || assignment === "locked" ? "assigned" : "scheduled", label: assignment === "assigned" || assignment === "locked" ? "Assigned" : "Scheduled", className: "status-badge-assigned" };
}

function escapeScheduleFilterHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function renderScheduleAdvancedFilters() {
  const games = gameService.getAll();
  const optionList = (values, selected) => [...new Set(values.filter(Boolean))].sort().map(value => `<option value="${escapeScheduleFilterHtml(value)}" ${String(value) === String(selected) ? "selected" : ""}>${escapeScheduleFilterHtml(value)}</option>`).join("");
  return `<section class="schedule-advanced-filters presentation-panel" data-testid="schedule-advanced-filters">
    <header><h3>Filter & Sort</h3><button type="button" class="button button-link" data-testid="schedule-clear-filters" onclick="clearScheduleAdvancedFilters()">Clear All</button></header>
    <div class="schedule-filter-grid">
      <label>Date<input type="date" value="${scheduleAdvancedFilters.date}" onchange="setScheduleAdvancedFilter('date', this.value)" data-testid="schedule-advanced-date"></label>
      <label>Time<select onchange="setScheduleAdvancedFilter('time', this.value)" data-testid="schedule-advanced-time"><option value="">All Times</option>${optionList(games.map(game => game.time), scheduleAdvancedFilters.time)}</select></label>
      <label>Location Complex<select onchange="setScheduleAdvancedFilter('locationComplex', this.value)" data-testid="schedule-advanced-complex"><option value="">All Complexes</option>${optionList(games.map(game => game.locationComplex), scheduleAdvancedFilters.locationComplex)}</select></label>
      <label>Location Field<select onchange="setScheduleAdvancedFilter('field', this.value)" data-testid="schedule-advanced-field"><option value="">All Fields</option>${optionList(games.map(game => game.locationField || game.field), scheduleAdvancedFilters.field)}</select></label>
      <label>Level<select onchange="setScheduleAdvancedFilter('level', this.value)" data-testid="schedule-advanced-level"><option value="">All Levels</option>${optionList(games.map(game => game.level), scheduleAdvancedFilters.level)}</select></label>
      <label>Matchup<input type="search" value="${escapeScheduleFilterHtml(scheduleAdvancedFilters.matchup)}" placeholder="Teams or matchup" oninput="setScheduleAdvancedFilter('matchup', this.value)" data-testid="schedule-advanced-matchup"></label>
      <label>Crew<select onchange="setScheduleAdvancedFilter('crew', this.value)" data-testid="schedule-advanced-crew"><option value="">All Crew</option>${crewService.getAll().sort((a,b) => crewService.getName(a).localeCompare(crewService.getName(b))).map(member => `<option value="${escapeScheduleFilterHtml(member.id)}" ${String(member.id) === String(scheduleAdvancedFilters.crew) ? "selected" : ""}>${escapeScheduleFilterHtml(crewService.getName(member))}</option>`).join("")}</select></label>
      <label>Status<select onchange="setScheduleAdvancedFilter('status', this.value)" data-testid="schedule-advanced-status"><option value="">All Statuses</option>${["assigned","locked","needs_assignment","open_for_claim","pending_approval"].map(status => `<option value="${status}" ${status === scheduleAdvancedFilters.status ? "selected" : ""}>${status.replaceAll("_", " ")}</option>`).join("")}</select></label>
      <label>Sort By<select onchange="setScheduleAdvancedFilter('sort', this.value)" data-testid="schedule-sort-field">${["date","time","field","level","crew","status"].map(field => `<option value="${field}" ${field === scheduleAdvancedFilters.sort ? "selected" : ""}>${field[0].toUpperCase() + field.slice(1)}</option>`).join("")}</select></label>
      <label>Order<select onchange="setScheduleAdvancedFilter('direction', this.value)" data-testid="schedule-sort-direction"><option value="asc" ${scheduleAdvancedFilters.direction === "asc" ? "selected" : ""}>Ascending</option><option value="desc" ${scheduleAdvancedFilters.direction === "desc" ? "selected" : ""}>Descending</option></select></label>
    </div>
  </section>`;
}

function getScheduleGameCrewIds(game) {
  return assignmentService.getAssignments(game).map(item => String(item.crewId || "")).filter(Boolean);
}

function applyScheduleAdvancedFilters(games = []) {
  const query = scheduleAdvancedFilters.matchup.trim().toLowerCase();
  const filtered = games.filter(game =>
    (!scheduleAdvancedFilters.date || game.date === scheduleAdvancedFilters.date) &&
    (!scheduleAdvancedFilters.time || game.time === scheduleAdvancedFilters.time) &&
    (!scheduleAdvancedFilters.locationComplex || game.locationComplex === scheduleAdvancedFilters.locationComplex) &&
    (!scheduleAdvancedFilters.field || (game.locationField || game.field) === scheduleAdvancedFilters.field) &&
    (!scheduleAdvancedFilters.level || game.level === scheduleAdvancedFilters.level) &&
    (!query || `${game.awayTeam || ""} @ ${game.homeTeam || ""}`.toLowerCase().includes(query)) &&
    (!scheduleAdvancedFilters.crew || getScheduleGameCrewIds(game).includes(String(scheduleAdvancedFilters.crew))) &&
    (!scheduleAdvancedFilters.status || assignmentService.getStatus(game) === scheduleAdvancedFilters.status)
  );
  const direction = scheduleAdvancedFilters.direction === "desc" ? -1 : 1;
  const crewName = game => getScheduleGameCrewIds(game).map(id => crewService.getDisplayName(id)).sort()[0] || "";
  const value = game => scheduleAdvancedFilters.sort === "crew" ? crewName(game) : scheduleAdvancedFilters.sort === "status" ? assignmentService.getStatus(game) : scheduleAdvancedFilters.sort === "time" ? getScheduleTimeMinutes(game.time) : game[scheduleAdvancedFilters.sort] || "";
  return filtered.sort((a, b) => String(value(a)).localeCompare(String(value(b)), undefined, { numeric: true }) * direction);
}

function setScheduleAdvancedFilter(key, value) {
  scheduleAdvancedFilters[key] = String(value || "");
  if (["sort", "direction"].includes(key)) scheduleQuickSort = { field: "", direction: "asc" };
  if (key === "date" && value) currentScheduleDate = value;
  renderScheduleContent();
}

function clearScheduleAdvancedFilters() {
  Object.assign(scheduleAdvancedFilters, { date: "", time: "", locationComplex: "", field: "", level: "", matchup: "", crew: "", status: "", sort: "date", direction: "asc" });
  scheduleQuickSort = { field: "", direction: "asc" };
  renderPage("schedule", currentScheduleContext);
}

function renderSchedule() {
  return `
    <div
      class="schedule-page"
      data-testid="schedule-page">

      <div
        class="schedule-topbar"
        data-testid="schedule-toolbar">

        <div
          class="schedule-tabs"
          data-testid="schedule-view-tabs">

          <button
            id="daily-view-btn"
            class="button button-secondary"
            data-testid="view-daily"
            onclick="setScheduleView('daily')">
            Daily View
          </button>

          <button
            id="all-games-view-btn"
            class="button button-secondary"
            data-testid="view-all-games"
            onclick="setScheduleView('all')">
            All Games
          </button>

          <button
            class="button button-secondary"
            data-testid="today"
            onclick="goToToday()">
            Today
          </button>

        </div>

        <div
  class="schedule-date-nav"
  data-testid="schedule-date-nav">

  <button
    class="button button-secondary schedule-toolbar-date-step"
    data-testid="toolbar-previous-date"
    onclick="goToPreviousGameDate()">
    ◀ Previous
  </button>

  <button
    type="button"
    class="button button-primary"
    data-testid="add-game"
    onclick="openGameEditor()">
    Add Game
  </button>

  <button
    type="button"
    class="button button-secondary"
    data-testid="import-schedule"
    onclick="openScheduleImport()">
    Import CSV
  </button>

  <button
    type="button"
    class="button button-secondary"
    data-testid="export-schedule"
    onclick="exportSchedule()"
    ${
      gameService.getAll().length
        ? ""
        : "disabled"
    }>
    Export CSV
  </button>
  
  <button
    class="button button-secondary schedule-toolbar-date-step"
    data-testid="toolbar-today"
    onclick="goToToday()">
    Today
  </button>

  <button
    class="button button-secondary schedule-toolbar-date-step"
    data-testid="toolbar-next-date"
    onclick="goToNextGameDate()">
    Next ▶
  </button>

          </div>

      </div>

      <div id="schedule-advanced-filter-host"></div>

      <div
        id="schedule-content"
        data-testid="schedule-content">
      </div>

    </div>
  `;
}

function setScheduleView(view) {
  currentScheduleView = view;
  renderScheduleContent();
}

function renderScheduleContent(context = currentScheduleContext) {
  currentScheduleContext = context || {};

  const container =
    document.getElementById("schedule-content");

  if (!container) return;

  const filterHost = document.getElementById("schedule-advanced-filter-host");
  if (filterHost) {
    filterHost.innerHTML = currentScheduleView === "all"
      ? renderScheduleAdvancedFilters()
      : "";
  }

  if (
    typeof updateScheduleExportButton === "function"
  ) {
    updateScheduleExportButton();
  }

  updateScheduleTabState();
  if (currentScheduleView === "daily") {
    renderDailySchedule(container);
    return;
  }

  renderAllGamesTable(container, currentScheduleContext);
}

function updateScheduleTabState() {
  document
    .getElementById("daily-view-btn")
    ?.classList.toggle(
      "active",
      currentScheduleView === "daily"
    );

  document
    .getElementById("all-games-view-btn")
    ?.classList.toggle(
      "active",
      currentScheduleView === "all"
    );
}

function goToToday() {
  currentScheduleView = "daily";
  currentScheduleDate =
    getLocalScheduleDate();

  renderScheduleContent();
}

function goToPreviousGameDate() {
  const dates = getUniqueGameDates();

  const currentIndex =
    dates.indexOf(currentScheduleDate);

  if (currentIndex > 0) {
    currentScheduleDate =
      dates[currentIndex - 1];
  } else {
    currentScheduleDate =
      shiftDate(currentScheduleDate, -1);
  }

  renderScheduleContent();
}

function goToNextGameDate() {
  const dates = getUniqueGameDates();

  const currentIndex =
    dates.indexOf(currentScheduleDate);

  if (
    currentIndex >= 0 &&
    currentIndex < dates.length - 1
  ) {
    currentScheduleDate =
      dates[currentIndex + 1];
  } else {
    currentScheduleDate =
      shiftDate(currentScheduleDate, 1);
  }

  renderScheduleContent();
}

function getUniqueGameDates() {
  return [
    ...new Set(
      gameService
        .getAll()
        .map(game => game.date)
        .filter(Boolean)
    )
  ].sort();
}

function shiftDate(dateString, offsetDays) {
  const baseDate =
    dateString || gameService.getFirstDateOrToday();

  const date =
    new Date(`${baseDate}T00:00:00`);

  date.setDate(date.getDate() + offsetDays);

  return date.toISOString().split("T")[0];
}

function sortGames(a, b) {
  if (a.date !== b.date) {
    return new Date(a.date) - new Date(b.date);
  }

  if ((a.time || "") !== (b.time || "")) {
    return String(a.time || "")
      .localeCompare(String(b.time || ""));
  }

  return String(a.field || "")
    .localeCompare(String(b.field || ""));
}

function formatShortDate(dateString) {
  if (!dateString) return "";

  const date =
    new Date(`${dateString}T00:00:00`);

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}

function formatLongDate(dateString) {
  if (!dateString) return "";

  const date =
    new Date(`${dateString}T00:00:00`);

  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric"
  });
}
