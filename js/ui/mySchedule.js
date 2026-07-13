// js/ui/mySchedule.js

function renderMySchedule() {
  const games = portalService.getMySchedule();

  if (!games.length) {
    return `
      <section
        class="page-section"
        data-testid="my-schedule"
      >
        <div
          class="empty-state"
          data-testid="my-schedule-empty"
        >
          <h2>My Schedule</h2>
          <p>You have no assigned games.</p>
        </div>
      </section>
    `;
  }

  return `
    <section
      class="page-section"
      data-testid="my-schedule"
    >
      <h2>My Schedule</h2>

      <div class="table-wrapper">
        <table
          class="table"
          data-testid="my-schedule-table"
        >
          <thead>
            <tr>
              <th>Date</th>
              <th>Time</th>
              <th>Game</th>
              <th>Field</th>
              <th>Level</th>
              <th>Position</th>
              <th>Crew</th>
              <th>Arrival</th>
              <th>Game Day</th>
              <th>Checklist</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            ${games
              .map(renderMyScheduleRow)
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderMySchedulePartners(game) {
  if (!game.partners.length) {
    return `
      <span class="muted">
        Working solo
      </span>
    `;
  }

  return game.partners
    .map(
      partner => `
        <div
          class="my-schedule-partner"
          data-crew-id="${partner.id}"
        >
          <strong>${partner.name}</strong>
          <span class="muted">
            ${partner.position}
          </span>
        </div>
      `
    )
    .join("");
}

function renderMyScheduleBadges(game) {
  return game.statusBadges
    .map(
      badge => `
        <span
          class="status-badge status-badge-${badge.key}"
          data-testid="my-schedule-badge-${game.id}-${badge.key}"
          data-status="${badge.key}"
        >
          ${badge.label}
        </span>
      `
    )
    .join("");
}

function renderMyScheduleRow(game) {
  return `
    <tr data-testid="my-schedule-row-${game.id}">
      <td>${game.date}</td>
      <td>${game.time}</td>
      <td>${game.matchup}</td>
      <td>${game.field}</td>
      <td>${game.level}</td>

      <td
        data-testid="my-schedule-position-${game.id}"
      >
        ${game.position}
      </td>

      <td
        data-testid="my-schedule-partners-${game.id}"
      >
        ${renderMySchedulePartners(game)}
      </td>

      <td
        data-testid="my-schedule-arrival-${game.id}"
      >
        <strong>
          ${game.arrivalRecommendation.text}
        </strong>

        <div class="muted">
          ${game.arrivalRecommendation.minutesEarly}
          minutes before game time
        </div>
      </td>

      <td
        data-testid="my-schedule-game-day-${game.id}"
      >
        <div
          class="my-schedule-game-day-status"
          data-game-day-status="${game.gameDayStatus.key}"
          data-requires-attention="${game.gameDayStatus.requiresAttention}"
        >
          <strong
            data-testid="my-schedule-game-day-title-${game.id}"
          >
            ${game.gameDayStatus.title}
          </strong>

          <div
            class="muted"
            data-testid="my-schedule-game-day-detail-${game.id}"
          >
            ${game.gameDayStatus.detail}
          </div>
        </div>
      </td>

      <td
        data-testid="my-schedule-checklist-${game.id}"
      >
        <div class="my-schedule-checklist">
          ${game.gameDayChecklist
            .map(
              item => `
                <div
                  class="my-schedule-checklist-item"
                  data-testid="my-schedule-checklist-item-${game.id}-${item.key}"
                  data-checklist-status="${item.status}"
                >
                  <strong>
                    ${item.label}
                  </strong>

                  <div class="muted">
                    ${item.detail}
                  </div>
                </div>
              `
            )
            .join("")}
        </div>
      </td>

      <td
        data-testid="my-schedule-status-${game.id}"
      >
        <div
          class="status-badges"
          data-testid="my-schedule-badges-${game.id}"
        >
          ${renderMyScheduleBadges(game)}
        </div>
      </td>
    </tr>
  `;
}
