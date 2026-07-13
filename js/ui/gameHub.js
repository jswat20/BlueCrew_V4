// js/ui/gameHub.js

function renderGameHub(context = {}) {
  const gameId = context.gameId || "";

  return `
    <section
      class="page-section"
      data-testid="game-hub"
    >
      <div class="page-actions">
        <button
          class="button button-secondary"
          onclick="renderPage('my-schedule')"
          data-testid="game-hub-back"
        >
          ← Back to My Schedule
        </button>
      </div>

      <h2>Game Hub</h2>

      <div
        class="card"
        data-testid="game-hub-card"
      >
        <strong>Selected Game</strong>

        <div
          data-testid="game-hub-game-id"
        >
          ${gameId}
        </div>
      </div>
    </section>
  `;
}