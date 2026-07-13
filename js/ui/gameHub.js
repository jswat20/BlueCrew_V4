// js/ui/gameHub.js

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
        <div class="page-actions">
          <button
            class="button button-secondary"
            type="button"
            onclick="renderPage('my-schedule')"
            data-testid="game-hub-back"
          >
            ← Back to My Schedule
          </button>
        </div>

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
      "checklist",
      "Checklist",
      gameDayRenderers.renderChecklist
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
      class="page-section"
      data-testid="game-hub"
      data-game-id="${game.id}"
    >
      <div class="page-actions">
        <button
          class="button button-secondary"
          type="button"
          onclick="renderPage('my-schedule')"
          data-testid="game-hub-back"
        >
          ← Back to My Schedule
        </button>
      </div>

      <h2>Game Hub</h2>

      <div
        class="card game-hub-summary"
        data-testid="game-hub-summary"
      >
        <h3 data-testid="game-hub-matchup">
          ${game.matchup}
        </h3>

        <div class="muted">
          ${game.date} • ${game.time}
        </div>

        <div class="muted">
          ${game.level}
        </div>
      </div>

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
