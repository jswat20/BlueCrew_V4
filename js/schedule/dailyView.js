// js/schedule/dailyView.js

function renderDailySchedule(container) {
  currentScheduleDate =
    currentScheduleDate || gameService.getFirstDateOrToday();

  const allDayGames = typeof applyScheduleAdvancedFilters === "function"
    ? applyScheduleAdvancedFilters(gameService.getByDate(currentScheduleDate))
    : gameService.getByDate(currentScheduleDate);

  const selectedCrewId =
    getSelectedWorkloadCrewId();

  const dayGames = selectedCrewId
    ? allDayGames.filter(game =>
        String(game.crewId) === String(selectedCrewId) ||
        assignmentService.getAssignments(game).some(assignment =>
          String(assignment.crewId) === String(selectedCrewId)
        )
      )
    : allDayGames;

  const assignedCount =
  allDayGames.filter(game => {
    const status = assignmentService.getStatus(game);

    return (
      status === AssignmentStatus.ASSIGNED ||
      status === AssignmentStatus.LOCKED
    );
  }).length;

const workflowCount =
  allDayGames.filter(game => {
    const status = assignmentService.getStatus(game);

    return (
      status === AssignmentStatus.NEEDS_ASSIGNMENT ||
      status === AssignmentStatus.OPEN_FOR_CLAIM ||
      status === AssignmentStatus.PENDING_APPROVAL
    );
  }).length;

  const openCount =
    allDayGames.length - assignedCount;

  const openAssignmentCount =
    allDayGames.reduce(
      (total, game) =>
        total + assignmentService
          .getAssignments(game)
          .filter(assignment => !assignment.crewId)
          .length,
      0
    );

  const conflictCount =
    conflictService.getDailyIssueCount(currentScheduleDate);

  const selectedCrew = selectedCrewId
    ? crewService.getById(selectedCrewId)
    : null;

  const selectedCrewName = selectedCrew
    ? crewService.getName(selectedCrew)
    : "";

  container.innerHTML = `
    <section class="daily-hero presentation-panel">
      <div class="daily-date-heading">
        <button type="button" class="button button-secondary daily-date-step" data-testid="previous-date" onclick="goToPreviousGameDate()" aria-label="Previous schedule date">◀ Previous</button>
        <div>
          <div class="daily-kicker">Daily Schedule</div>
          <h2>${formatLongDate(currentScheduleDate)}</h2>
          <p class="daily-assignment-status" data-testid="schedule-assignment-status">${openAssignmentCount ? `${openAssignmentCount} open assignment${openAssignmentCount === 1 ? "" : "s"} for this day.` : "No open assignments for this day."}</p>
        </div>
        <button type="button" class="button button-secondary daily-date-step" data-testid="next-date" onclick="goToNextGameDate()" aria-label="Next schedule date">Next ▶</button>
      </div>

      <div class="daily-summary-inline" aria-label="Daily schedule status">
        <span class="daily-summary-metric"><small>Games</small><strong>${allDayGames.length}</strong></span>
        <span class="daily-summary-metric status-good"><small>Assigned</small><strong>${assignedCount}</strong></span>
        <span class="daily-summary-metric ${openCount > 0 ? "status-watch" : "status-good"}"><small>Unassigned</small><strong>${openCount}</strong></span>
        <span class="daily-summary-metric ${conflictCount > 0 ? "status-danger" : "status-good"}"><small>Issues</small>
          <strong>${conflictCount}</strong>
        </span>
      </div>
    </section>

    ${renderScheduleMonthCalendar(currentScheduleDate)}

    <div class="daily-assignment-grid">
      ${renderCrewWorkloadPanel(currentScheduleDate)}

      <div>
        ${renderDailyFilterNotice(selectedCrewId, selectedCrewName)}
        <div class="daily-section-heading"><h3 class="daily-games-title">Games</h3></div>
        <section class="daily-games">
          ${renderDailyGameCards(dayGames)}
        </section>
      </div>
    </div>
  `;

}

function renderScheduleMonthCalendar(selectedDate) {
  const selected = new Date(`${selectedDate}T12:00:00`);
  const year = selected.getFullYear();
  const month = selected.getMonth();
  const first = new Date(year, month, 1, 12);
  const gridStart = new Date(first);
  gridStart.setDate(1 - first.getDay());
  const formatter = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
  const gamesByDate = new Map(
    gameService.getAll().reduce((entries, game) => {
      entries.set(game.date, (entries.get(game.date) || 0) + 1);
      return entries;
    }, new Map())
  );
  const today = new Date().toISOString().split("T")[0];

  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const value = date.toISOString().split("T")[0];
    const gameCount = gamesByDate.get(value) || 0;
    return `<button type="button" class="schedule-calendar-day ${date.getMonth() === month ? "" : "outside-month"} ${value < today ? "past-date" : ""} ${value === selectedDate ? "selected" : ""} ${gameCount ? "has-games" : "no-games"}" onclick="selectScheduleCalendarDate('${value}')" aria-pressed="${value === selectedDate}" aria-label="${formatLongDate(value)}${gameCount ? `, ${gameCount} games` : ", no games"}"><span>${date.getDate()}</span>${gameCount ? `<small>(${gameCount})</small>` : ""}</button>`;
  }).join("");

  return `<section class="schedule-calendar presentation-panel" data-testid="schedule-calendar"><header><button type="button" class="button button-link" onclick="shiftScheduleCalendarMonth(-1)" aria-label="Previous month">‹</button><h3>${formatter.format(first)}</h3><button type="button" class="button button-link" onclick="shiftScheduleCalendarMonth(1)" aria-label="Next month">›</button></header><div class="schedule-calendar-weekdays" aria-hidden="true">${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(day => `<span>${day}</span>`).join("")}</div><div class="schedule-calendar-grid">${days}</div></section>`;
}

function selectScheduleCalendarDate(date) {
  currentScheduleDate = date;
  renderScheduleContent();
}

function shiftScheduleCalendarMonth(offset) {
  const date = new Date(`${currentScheduleDate}T12:00:00`);
  date.setMonth(date.getMonth() + offset, 1);
  currentScheduleDate = date.toISOString().split("T")[0];
  renderScheduleContent();
}

function renderDailyFilterNotice(selectedCrewId, selectedCrewName) {
  if (!selectedCrewId) return "";

  return `
    <div class="schedule-filter-notice">
      Showing games assigned to
      <strong>${selectedCrewName}</strong>.

      <button
        class="button button-link"
        data-testid="schedule-games-show-all"
        onclick="clearWorkloadCrewFilter()"
      >
        Show All
      </button>
    </div>
  `;
}

function renderDailyGameCards(dayGames) {
  if (!dayGames.length) {
    return renderEmptyState({
      message:
        "No games to show for this view.",
      testId: "schedule-empty"
    });
  }

  return dayGames
    .map(renderGameCard)
    .join("");
}

function openConflictGame(gameId) {
  if (!gameId) return;

  openAssignmentDrawer(gameId);
}

function filterWorkloadByCrew(crewId) {
  if (!crewId) return;

  setWorkloadCrewFilter(crewId);
}

function openScheduleGameHub(gameId) {
  window.navigateTo("game-hub", {
    gameId,
    origin: "schedule",
    returnPage: "schedule"
  });
}
