// js/schedule/schedule.js

let currentScheduleView = "daily";
let currentScheduleDate = null;
let currentScheduleContext = {};

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

        </div>

        <div
  class="schedule-date-nav"
  data-testid="schedule-date-nav">

  <button
    class="button button-secondary"
    data-testid="previous-date"
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
    class="button button-secondary"
    data-testid="today"
    onclick="goToToday()">
    Today
  </button>

  <button
    class="button button-secondary"
    data-testid="next-date"
    onclick="goToNextGameDate()">
    Next ▶
  </button>

          </div>

      </div>

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
