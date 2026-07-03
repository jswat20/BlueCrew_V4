// js/schedule/schedule.js

let currentScheduleView = "daily";
let currentScheduleDate = null;

function renderSchedule() {
  return `
    <div class="schedule-page">
      <div class="schedule-topbar">
        <div class="schedule-tabs">
          ...
        </div>

        <div class="schedule-date-nav">
          <button onclick="goToPreviousGameDate()">◀ Previous</button>
          <button onclick="goToToday()">Today</button>
          <button onclick="goToNextGameDate()">Next ▶</button>
          <button class="primary" onclick="openGameEditor()"> + Add Game </button>
        </div>
      </div>

      <div id="schedule-content"></div>
    </div>
  `;
}

function setScheduleView(view) {
  currentScheduleView = view;
  renderScheduleContent();
}

function renderScheduleContent() {
  const container = document.getElementById("schedule-content");
  if (!container) return;

  updateScheduleTabState();

  if (currentScheduleView === "daily") {
    renderDailySchedule(container);
    return;
  }

  renderAllGamesTable(container);
}

function updateScheduleTabState() {
  document
    .getElementById("daily-view-btn")
    ?.classList.toggle("active", currentScheduleView === "daily");

  document
    .getElementById("all-games-view-btn")
    ?.classList.toggle("active", currentScheduleView === "all");
}

function goToToday() {
  currentScheduleDate = new Date().toISOString().split("T")[0];
  renderScheduleContent();
}

function goToPreviousGameDate() {
  const dates = getUniqueGameDates();
  const currentIndex = dates.indexOf(currentScheduleDate);

  if (currentIndex > 0) {
    currentScheduleDate = dates[currentIndex - 1];
  } else {
    currentScheduleDate = shiftDate(currentScheduleDate, -1);
  }

  renderScheduleContent();
}

function goToNextGameDate() {
  const dates = getUniqueGameDates();
  const currentIndex = dates.indexOf(currentScheduleDate);

  if (currentIndex >= 0 && currentIndex < dates.length - 1) {
    currentScheduleDate = dates[currentIndex + 1];
  } else {
    currentScheduleDate = shiftDate(currentScheduleDate, 1);
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
  const baseDate = dateString || gameService.getFirstDateOrToday();
  const date = new Date(`${baseDate}T00:00:00`);

  date.setDate(date.getDate() + offsetDays);

  return date.toISOString().split("T")[0];
}

function sortGames(a, b) {
  if (a.date !== b.date) {
    return new Date(a.date) - new Date(b.date);
  }

  if ((a.time || "") !== (b.time || "")) {
    return String(a.time || "").localeCompare(String(b.time || ""));
  }

  return String(a.field || "").localeCompare(String(b.field || ""));
}

function formatShortDate(dateString) {
  if (!dateString) return "";

  const date = new Date(`${dateString}T00:00:00`);

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}

function formatLongDate(dateString) {
  if (!dateString) return "";

  const date = new Date(`${dateString}T00:00:00`);

  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric"
  });
}
function getCurrentScheduleFilter() {
  if (
    typeof uiStateService !== "undefined" &&
    typeof uiStateService.getScheduleFilter === "function"
  ) {
    return uiStateService.getScheduleFilter();
  }

  return "all";
}