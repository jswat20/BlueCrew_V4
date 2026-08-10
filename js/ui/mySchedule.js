// js/ui/mySchedule.js

function renderMySchedule(context = {}) {
  const allGames = portalService.getMySchedule();

  const games =
    context.filter === "returned"
      ? allGames.filter(
          game =>
            game.completion?.review?.status ===
            "returned"
        )
      : allGames;

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
      <div class="card-header">
        <div>
          <h2>
            ${
              context.filter === "returned"
                ? "Returned Reviews"
                : "My Schedule"
            }
          </h2>

          ${
            context.filter === "returned"
              ? `
                  <span
                    class="card-subtitle"
                    data-testid="my-schedule-returned-filter"
                  >
                    Games waiting for corrections
                  </span>
                `
              : ""
          }
        </div>
      </div>

      <div class="table-wrapper my-schedule-table-wrapper presentation-table-wrapper" tabindex="0" role="region" aria-label="My Schedule table">
        <table
          class="table presentation-table presentation-table-centered my-schedule-compact-table"
          data-testid="my-schedule-table"
        >
          <thead>
            <tr>
              <th>Date</th>
              <th>Time</th>
              <th>Level</th>
              <th>Complex</th>
              <th>Field</th>
              <th>Forecast</th>
              <th>Status</th>
              <th>Game Hub</th>
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
  const badges = game.lifecycleStatus === "cancelled"
    ? [{ key: "cancelled", label: "Cancelled" }]
    : game.statusBadges;
  return badges
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

function renderMyScheduleCell(
  testId,
  content
) {
  return `
    <td data-testid="${testId}">
      ${content}
    </td>
  `;
}

function renderMyScheduleCell(
  testId,
  content
) {
  return `
    <td data-testid="${testId}">
      ${content}
    </td>
  `;
}

function renderMyScheduleArrival(game) {
  return `
    <strong>
      ${game.arrivalRecommendation.text}
    </strong>

    <div class="muted">
      ${game.arrivalRecommendation.minutesEarly}
      minutes before game time
    </div>
  `;
}

function renderMyScheduleGameDay(game) {
  return `
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
  `;
}

function renderMyScheduleChecklistItem(
  game,
  item
) {
  return `
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
  `;
}

function renderMyScheduleChecklist(game) {
  const items = game.gameDayChecklist
    .map(item =>
      renderMyScheduleChecklistItem(
        game,
        item
      )
    )
    .join("");

  return `
    <div class="my-schedule-checklist">
      ${items}
    </div>
  `;
}

function renderMyScheduleStatus(game) {
  const canDecline =
    ["assigned", "locked"].includes(
      game.assignmentStatus
    ) &&
    ![
      "completed",
      "submitted",
      "approved",
      "cancelled"
    ].includes(game.lifecycleStatus);

  return `
    <div
      class="status-badges"
      data-testid="my-schedule-badges-${game.id}"
    >
      ${renderMyScheduleBadges(game)}
    </div>

    ${
      canDecline
        ? `
            <button
              type="button"
              class="button button-danger button-compact"
              data-testid="decline-assignment-${game.id}"
              onclick="handleDeclineAssignment('${game.id}')"
            >
              Decline Assignment
            </button>
          `
        : ""
    }
  `;
}

function handleDeclineAssignment(gameId) {
  const reason = window.prompt(
    "Why are you declining this assignment? A reason is required."
  );

  if (reason === null) {
    return;
  }

  const result =
    portalService.declineAssignment(
      gameId,
      reason
    );

  if (!result.success) {
    if (
      typeof toastService !== "undefined" &&
      typeof toastService.error === "function"
    ) {
      toastService.error(result.message);
    } else {
      window.alert(result.message);
    }

    return;
  }

  if (
    typeof toastService !== "undefined" &&
    typeof toastService.success === "function"
  ) {
    toastService.success(
      "Assignment declined. The assigner has been notified."
    );
  }

  renderPage("my-schedule");
}

const gameDayRenderers = Object.freeze({
  renderGameInformation:
    renderMyScheduleGameInformation,

  renderPartners:
    renderMySchedulePartners,

  renderArrival:
    renderMyScheduleArrival,

  renderGameDay:
    renderMyScheduleGameDay,

  renderChecklist:
    renderMyScheduleChecklist,

  renderTimeline:
    renderMyScheduleTimeline,

  renderConditions:
    renderMyScheduleConditions,

  renderContacts:
    renderMyScheduleContacts,

  renderStatus:
    renderMyScheduleStatus
});

function renderMyScheduleRow(game) {
  const information = game.gameInformation || {};
  const conditions = game.gameConditions || {};
  const forecast = [conditions.summary, conditions.temperature].filter(Boolean).join(" · ") || "—";
  return `
    <tr data-testid="my-schedule-row-${game.id}">
      <td>${game.date}</td>
      <td>${dateTimeFormattingService.formatTime12Hour(game.time, "TBD")}</td>
      <td>${levelTerminologyService.format(game.level)}</td>
      <td>${game.locationComplex || game.complex || information.venue || "Complex TBD"}</td>
      <td>${game.locationField || game.field || "Field TBD"}</td>
      <td data-testid="my-schedule-forecast-${game.id}">${forecast}</td>
      <td data-testid="my-schedule-status-${game.id}">${renderMyScheduleBadges(game)}</td>
      <td><button class="button button-primary button-compact" type="button" onclick="renderPage('game-hub', { gameId: '${game.id}', origin: 'my-schedule', returnPage: 'my-schedule' })" data-testid="my-schedule-open-game-${game.id}">Open Game Hub</button></td>
    </tr>
  `;
}
