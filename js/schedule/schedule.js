// js/schedule/schedule.js

let currentScheduleView = "daily";
let currentScheduleDate = null;
let currentScheduleContext = {};
const scheduleAdvancedFilters = {
  date: "", time: "", field: "", level: "", matchup: "", crew: "", status: "", sort: "date", direction: "asc"
};

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
      <label>Field<select onchange="setScheduleAdvancedFilter('field', this.value)" data-testid="schedule-advanced-field"><option value="">All Fields</option>${optionList(games.map(game => game.field || game.venue), scheduleAdvancedFilters.field)}</select></label>
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
    (!scheduleAdvancedFilters.field || (game.field || game.venue) === scheduleAdvancedFilters.field) &&
    (!scheduleAdvancedFilters.level || game.level === scheduleAdvancedFilters.level) &&
    (!query || `${game.awayTeam || ""} @ ${game.homeTeam || ""}`.toLowerCase().includes(query)) &&
    (!scheduleAdvancedFilters.crew || getScheduleGameCrewIds(game).includes(String(scheduleAdvancedFilters.crew))) &&
    (!scheduleAdvancedFilters.status || assignmentService.getStatus(game) === scheduleAdvancedFilters.status)
  );
  const direction = scheduleAdvancedFilters.direction === "desc" ? -1 : 1;
  const crewName = game => getScheduleGameCrewIds(game).map(id => crewService.getDisplayName(id)).sort()[0] || "";
  const timeValue = value => {
    const match = String(value || "").match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return -1;
    let hour = Number(match[1]) % 12;
    if (match[3].toUpperCase() === "PM") hour += 12;
    return hour * 60 + Number(match[2]);
  };
  const value = game => scheduleAdvancedFilters.sort === "crew" ? crewName(game) : scheduleAdvancedFilters.sort === "status" ? assignmentService.getStatus(game) : scheduleAdvancedFilters.sort === "time" ? timeValue(game.time) : game[scheduleAdvancedFilters.sort] || "";
  return filtered.sort((a, b) => String(value(a)).localeCompare(String(value(b)), undefined, { numeric: true }) * direction);
}

function setScheduleAdvancedFilter(key, value) {
  scheduleAdvancedFilters[key] = String(value || "");
  if (key === "date" && value) currentScheduleDate = value;
  renderScheduleContent();
}

function clearScheduleAdvancedFilters() {
  Object.assign(scheduleAdvancedFilters, { date: "", time: "", field: "", level: "", matchup: "", crew: "", status: "", sort: "date", direction: "asc" });
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
    new Date().toISOString().split("T")[0];

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
