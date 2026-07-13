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
              <th>Game Information</th>
              <th>Level</th>
              <th>Position</th>
              <th>Crew</th>
              <th>Arrival</th>
              <th>Game Day</th>
              <th>Checklist</th>
              <th>Timeline</th>
              <th>Conditions</th>
              <th>Contacts</th>
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

function renderMyScheduleGameInformation(game) {
  const information =
    game.gameInformation || {};

  const details = [
    information.field
      ? `
          <div
            data-testid="my-schedule-field-${game.id}"
          >
            <strong>${information.field}</strong>
          </div>
        `
      : "",
    information.venue
      ? `
          <div
            data-testid="my-schedule-venue-${game.id}"
          >
            ${information.venue}
          </div>
        `
      : "",
    information.address
      ? `
          <div
            class="muted"
            data-testid="my-schedule-address-${game.id}"
          >
            ${information.address}
          </div>
        `
      : "",
    information.notes
      ? `
          <div
            class="my-schedule-game-note"
            data-testid="my-schedule-notes-${game.id}"
          >
            <strong>Notes:</strong>
            ${information.notes}
          </div>
        `
      : "",
    information.specialInstructions
      ? `
          <div
            class="my-schedule-special-instructions"
            data-testid="my-schedule-special-instructions-${game.id}"
          >
            <strong>Instructions:</strong>
            ${information.specialInstructions}
          </div>
        `
      : ""
  ]
    .filter(Boolean)
    .join("");

  return `
    <div
      class="my-schedule-game-information"
      data-testid="my-schedule-game-information-${game.id}"
    >
      ${details}
    </div>
  `;
}

function renderMyScheduleTimeline(game) {
  const timeline =
    Array.isArray(game.gameDayTimeline)
      ? game.gameDayTimeline
      : [];

  return `
    <div
      class="my-schedule-timeline"
      data-testid="my-schedule-timeline-${game.id}"
    >
      ${timeline
        .map(
          item => `
            <div
              class="my-schedule-timeline-item"
              data-testid="my-schedule-timeline-item-${game.id}-${item.key}"
              data-timeline-status="${item.status}"
            >
              <div class="muted">
                ${item.phase}
              </div>

              <strong>
                ${item.title}
              </strong>

              <div>
                ${item.detail}
              </div>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderMyScheduleConditions(game) {
  const conditions =
    game.gameConditions || {};

  const details = [
    conditions.summary
      ? `
          <div
            data-testid="my-schedule-weather-summary-${game.id}"
          >
            <strong>${conditions.summary}</strong>
          </div>
        `
      : "",
    conditions.temperature
      ? `
          <div
            class="muted"
            data-testid="my-schedule-temperature-${game.id}"
          >
            ${conditions.temperature}
          </div>
        `
      : "",
    conditions.weatherAdvisory
      ? `
          <div
            data-testid="my-schedule-weather-advisory-${game.id}"
          >
            <strong>Weather:</strong>
            ${conditions.weatherAdvisory}
          </div>
        `
      : "",
    conditions.fieldStatus
      ? `
          <div
            data-testid="my-schedule-field-status-${game.id}"
          >
            <strong>Field:</strong>
            ${conditions.fieldStatus}
          </div>
        `
      : "",
    conditions.cancellationNotice
      ? `
          <div
            data-testid="my-schedule-cancellation-notice-${game.id}"
          >
            <strong>Notice:</strong>
            ${conditions.cancellationNotice}
          </div>
        `
      : "",
    conditions.advisory
      ? `
          <div
            data-testid="my-schedule-game-day-advisory-${game.id}"
          >
            ${conditions.advisory}
          </div>
        `
      : ""
  ]
    .filter(Boolean)
    .join("");

  return `
    <div
      class="my-schedule-conditions"
      data-testid="my-schedule-conditions-${game.id}"
    >
      ${details}
    </div>
  `;
}

function renderMyScheduleContact(
  game,
  contact,
  key
) {
  const phone = contact.phone
    ? `
        <div>
          <a
            href="tel:${contact.phone}"
            data-testid="my-schedule-contact-phone-${game.id}-${key}"
          >
            ${contact.phone}
          </a>
        </div>
      `
    : "";

  const email = contact.email
    ? `
        <div>
          <a
            href="mailto:${contact.email}"
            data-testid="my-schedule-contact-email-${game.id}-${key}"
          >
            ${contact.email}
          </a>
        </div>
      `
    : "";

  return `
    <div
      class="my-schedule-contact"
      data-testid="my-schedule-contact-${game.id}-${key}"
    >
      <strong>${contact.name}</strong>

      ${
        contact.role
          ? `
              <div class="muted">
                ${contact.role}
              </div>
            `
          : ""
      }

      ${phone}
      ${email}
    </div>
  `;
}

function renderMyScheduleContacts(game) {
  const contacts =
    game.gameDayContacts || {
      primaryContact: null,
      partners: []
    };

  const items = [];

  if (contacts.primaryContact) {
    items.push(
      renderMyScheduleContact(
        game,
        contacts.primaryContact,
        "primary"
      )
    );
  }

  contacts.partners.forEach(
    partner => {
      items.push(
        renderMyScheduleContact(
          game,
          partner,
          `partner-${partner.id}`
        )
      );
    }
  );

  return `
    <div
      class="my-schedule-contacts"
      data-testid="my-schedule-contacts-${game.id}"
    >
      ${items.join("")}
    </div>
  `;
}

function renderMyScheduleRow(game) {
  return `
    <tr data-testid="my-schedule-row-${game.id}">
      <td>${game.date}</td>
      <td>${game.time}</td>
      <td>${game.matchup}</td>

      <td>
        ${renderMyScheduleGameInformation(game)}
      </td>

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
        data-testid="my-schedule-timeline-cell-${game.id}"
      >
        ${renderMyScheduleTimeline(game)}
      </td>

      <td
        data-testid="my-schedule-conditions-cell-${game.id}"
      >
        ${renderMyScheduleConditions(game)}
      </td>

      <td
        data-testid="my-schedule-contacts-cell-${game.id}"
      >
        ${renderMyScheduleContacts(game)}
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
