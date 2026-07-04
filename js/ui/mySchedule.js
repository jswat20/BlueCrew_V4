// js/ui/mySchedule.js

function renderMySchedule() {
  const games = portalService.getMySchedule();

  if (!games.length) {
    return `
      <section class="page-section" data-testid="my-schedule">
        <div class="empty-state" data-testid="my-schedule-empty">
          <h2>My Schedule</h2>
          <p>You have no assigned games.</p>
        </div>
      </section>
    `;
  }

  return `
    <section class="page-section" data-testid="my-schedule">
      <h2>My Schedule</h2>

      <div class="table-wrapper">
        <table class="table" data-testid="my-schedule-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Time</th>
              <th>Game</th>
              <th>Field</th>
              <th>Level</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            ${games.map(renderMyScheduleRow).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderMyScheduleRow(game) {
  return `
    <tr data-testid="my-schedule-row-${game.id}">
      <td>${game.date}</td>
      <td>${game.time}</td>
      <td>${game.matchup}</td>
      <td>${game.field}</td>
      <td>${game.level}</td>
      <td>${game.assignmentStatusLabel}</td>
    </tr>
  `;
}