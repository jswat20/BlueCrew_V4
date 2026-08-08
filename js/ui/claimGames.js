function renderClaimGames() {
  const games = portalService.getClaimableGames();

  if (!games.length) {
    return `
      <div class="card" data-testid="claim-games-empty">
        <h3>No Games Available</h3>
        <p>There are currently no games available to claim.</p>
      </div>
    `;
  }

  return `
    <section class="card presentation-card claim-games-compact" data-testid="claim-games">
      <div class="presentation-card-header-blue"><h2>Available Games</h2></div>
      <div class="presentation-table-wrapper" tabindex="0" role="region" aria-label="Available games table">
      <table class="table presentation-table presentation-table-centered claim-games-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Time</th>
            <th>Level</th>
            <th>Complex</th>
            <th>Field</th>
            <th>Status / Availability</th>
            <th>Claim</th>
          </tr>
        </thead>

        <tbody>
          ${games.map(game => `
            <tr data-testid="claim-game-row-${game.id}">
              <td>${game.date}</td>
              <td>${dateTimeFormattingService.formatTime12Hour(game.time, "TBD")}</td>
              <td>${levelTerminologyService.format(game.level)}</td>
              <td>${game.locationComplex || game.complex || "Complex TBD"}</td>
              <td>${game.locationField || game.field || "Field TBD"}</td>
              <td><span class="status-badge ${presentationFormattingService.getStatusBadgeClass("Needs Assignment")}">Open</span></td>
              <td>
                <button
                  class="button button-primary"
                  data-testid="claim-game-${game.id}"
                  data-game-id="${game.id}"
                  onclick="claimPortalGameFromButton(this)">
                  Claim
                </button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table></div>
    </section>
  `;
}

function claimPortalGameFromButton(button) {
  return claimPortalGame(button?.dataset?.gameId || "");
}

async function claimPortalGame(gameId) {
  const result = await portalService.claimGame(gameId);

  if (result.success) {
    toastService.success(result.message);
    renderPage("claim-games");
  } else {
    toastService.error(result.message);
  }
}
