// js/schedule/dailyView.js

function renderDailySchedule(container) {
  currentScheduleDate =
    currentScheduleDate || gameService.getFirstDateOrToday();

  const allDayGames =
    gameService.getByDate(currentScheduleDate);

  const selectedCrewId =
    getSelectedWorkloadCrewId();

  const dayGames = selectedCrewId
    ? allDayGames.filter(game =>
        String(game.crewId) === String(selectedCrewId)
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
      <div>
        <div class="daily-kicker">Daily Schedule</div>
        <h2>${formatLongDate(currentScheduleDate)}</h2>
      </div>

      <div class="daily-summary-inline">
        <span><strong>${allDayGames.length}</strong> Games</span>
        <span><strong>${assignedCount}</strong> Assigned</span>
       <span><strong>${workflowCount}</strong> In Workflow</span>
        <span class="${conflictCount > 0 ? "danger" : ""}">
          <strong>${conflictCount}</strong> Issues
        </span>
      </div>
    </section>

    <div id="conflict-center"></div>

    ${renderOpenGamesQueue(currentScheduleDate)}

    ${renderCrewWorkloadPanel(currentScheduleDate)}

    ${renderDailyFilterNotice(selectedCrewId, selectedCrewName)}

    <section class="daily-games">
      ${renderDailyGameCards(dayGames)}
    </section>
  `;

  renderConflictCenter({
    containerId: "conflict-center",
    date: currentScheduleDate,
    conflictService,
    handlers: {
      assign: ({ gameId }) => openConflictGame(gameId),
      resolve: ({ gameId }) => openConflictGame(gameId),
      review: ({ gameId }) => openConflictGame(gameId),
      redistribute: ({ crewId }) => filterWorkloadByCrew(crewId)
    }
  });
}

function renderDailyFilterNotice(selectedCrewId, selectedCrewName) {
  if (!selectedCrewId) return "";

  return `
    <div class="schedule-filter-notice">
      Showing games assigned to
      <strong>${selectedCrewName}</strong>.

      <button
        class="button button-link"
        onclick="clearWorkloadCrewFilter()"
      >
        Show all games
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
