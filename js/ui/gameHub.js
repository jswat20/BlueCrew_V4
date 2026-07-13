// js/ui/gameHub.js

function escapeGameHubText(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderGameHubCrewNotes(game) {
  return `
    <section
      class="card game-hub-section game-hub-notes"
      data-testid="game-hub-crew-notes"
    >
      <h3>Crew Notes</h3>

      <label
        for="game-hub-crew-notes-input"
        class="muted"
      >
        Personal notes for this assignment
      </label>

      <textarea
        id="game-hub-crew-notes-input"
        class="game-hub-notes-input"
        data-testid="game-hub-crew-notes-input"
        rows="5"
        placeholder="Add reminders, questions, or pregame notes..."
      >${escapeGameHubText(game.crewNotes)}</textarea>

      <div class="game-hub-notes-footer">
        <button
          class="button"
          type="button"
          onclick="saveGameHubCrewNotes('${game.id}')"
          data-testid="game-hub-save-crew-notes"
        >
          Save Notes
        </button>

        <span
          class="muted"
          data-testid="game-hub-crew-notes-status"
          aria-live="polite"
        ></span>
      </div>
    </section>
  `;
}

function saveGameHubCrewNotes(gameId) {
  const input = document.getElementById(
    "game-hub-crew-notes-input"
  );

  const status = document.querySelector(
    '[data-testid="game-hub-crew-notes-status"]'
  );

  const result = portalService.saveCrewNotes(
    gameId,
    input ? input.value : ""
  );

  if (status) {
    status.textContent = result.message;
  }

  return result;
}

function renderGameHubChecklist(game) {
  const items =
    Array.isArray(game.gameDayChecklist)
      ? game.gameDayChecklist
      : [];

  const completedCount =
    items.filter(
      item => item.completed === true
    ).length;

  return `
    <section
      class="card game-hub-section game-hub-checklist"
      data-testid="game-hub-checklist"
    >
      <div class="game-hub-checklist-header">
        <h3>Pregame Checklist</h3>

        <span
          class="muted"
          data-testid="game-hub-checklist-progress"
        >
          ${completedCount} of ${items.length} complete
        </span>
      </div>

      <div class="game-hub-checklist-items">
        ${items
          .map(
            item => `
              <label
                class="game-hub-checklist-item"
                data-testid="game-hub-checklist-item-${item.key}"
              >
                <input
                  type="checkbox"
                  data-testid="game-hub-checklist-toggle-${item.key}"
                  ${item.completed ? "checked" : ""}
                  onchange="toggleGameHubChecklistItem('${game.id}', '${item.key}')"
                />

                <span>
                  <strong>${item.label}</strong>

                  <span class="muted">
                    ${item.detail}
                  </span>
                </span>
              </label>
            `
          )
          .join("")}
      </div>

      <div
        class="muted"
        data-testid="game-hub-checklist-status"
        aria-live="polite"
      ></div>
    </section>
  `;
}

function toggleGameHubChecklistItem(
  gameId,
  itemKey
) {
  const result =
    portalService.toggleChecklistItem(
      gameId,
      itemKey
    );

  if (result.success) {
    renderPage("game-hub", {
      gameId
    });

    return result;
  }

  const status = document.querySelector(
    '[data-testid="game-hub-checklist-status"]'
  );

  if (status) {
    status.textContent = result.message;
  }

  return result;
}

function renderGameHubSection(
  game,
  key,
  title,
  renderer
) {
  return `
    <section
      class="card game-hub-section"
      data-testid="game-hub-section-${key}"
    >
      <h3>${title}</h3>

      <div class="game-hub-section-content">
        ${renderer(game)}
      </div>
    </section>
  `;
}

function renderGameHubQuickActions() {
  return `
    <div
      class="game-hub-actions"
      data-testid="game-hub-actions"
    >
      <button
        class="button button-secondary"
        type="button"
        onclick="renderPage('my-schedule')"
        data-testid="game-hub-back"
      >
        ← Back to My Schedule
      </button>

      <button
        class="button button-secondary"
        type="button"
        onclick="renderPage('availability')"
        data-testid="game-hub-availability"
      >
        View Availability
      </button>

      <button
        class="button button-secondary"
        type="button"
        onclick="renderPage('claim-games')"
        data-testid="game-hub-claim-games"
      >
        Claim Games
      </button>
    </div>
  `;
}

function renderGameHub(context = {}) {
  const game = portalService.getGameHub(
    context.gameId
  );

  if (!game) {
    return `
      <section
        class="page-section"
        data-testid="game-hub"
      >
        ${renderGameHubQuickActions()}

        <h2>Game Hub</h2>

        <div
          class="empty-state"
          data-testid="game-hub-empty"
        >
          <p>This game is not available.</p>
        </div>
      </section>
    `;
  }

  const sections = [
    [
      "game-information",
      "Game Information",
      gameDayRenderers.renderGameInformation
    ],
    [
      "crew",
      "Crew",
      gameDayRenderers.renderPartners
    ],
    [
      "arrival",
      "Arrival",
      gameDayRenderers.renderArrival
    ],
    [
      "game-day",
      "Game Day",
      gameDayRenderers.renderGameDay
    ],
    [
      "timeline",
      "Timeline",
      gameDayRenderers.renderTimeline
    ],
    [
      "conditions",
      "Conditions",
      gameDayRenderers.renderConditions
    ],
    [
      "contacts",
      "Contacts",
      gameDayRenderers.renderContacts
    ],
    [
      "status",
      "Status",
      gameDayRenderers.renderStatus
    ]
  ];

  return `
    <section
      class="page-section game-hub"
      data-testid="game-hub"
      data-game-id="${game.id}"
    >
      ${renderGameHubQuickActions()}

      <h2>Game Hub</h2>

      <div
        class="card game-hub-summary"
        data-testid="game-hub-summary"
      >
        <div class="game-hub-summary-header">
          <div>
            <h3 data-testid="game-hub-matchup">
              ${game.matchup}
            </h3>

            <div
              class="game-hub-summary-date"
              data-testid="game-hub-date-time"
            >
              ${game.date} • ${game.time}
            </div>
          </div>

          <div
            class="game-hub-summary-status"
            data-testid="game-hub-summary-status"
          >
            ${gameDayRenderers.renderStatus(game)}
          </div>
        </div>

        <div class="game-hub-summary-details">
          <div data-testid="game-hub-summary-field">
            <span class="muted">Field</span>
            <strong>
              ${game.gameInformation?.field || ""}
            </strong>
          </div>

          <div data-testid="game-hub-summary-level">
            <span class="muted">Level</span>
            <strong>${game.level}</strong>
          </div>

          <div data-testid="game-hub-summary-position">
            <span class="muted">Position</span>
            <strong>${game.position}</strong>
          </div>
        </div>
      </div>

      ${renderGameHubCrewNotes(game)}

      ${renderGameHubChecklist(game)}

      <div
        class="game-hub-sections"
        data-testid="game-hub-sections"
      >
        ${sections
          .map(([key, title, renderer]) =>
            renderGameHubSection(
              game,
              key,
              title,
              renderer
            )
          )
          .join("")}
      </div>
    </section>
  `;
}
