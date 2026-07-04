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
    <div class="card" data-testid="claim-games">
      <h3>Available Games</h3>

      <table class="table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Time</th>
            <th>Matchup</th>
            <th>Field</th>
            <th>Level</th>
            <th></th>
          </tr>
        </thead>

        <tbody>
          ${games.map(game => `
            <tr data-testid="claim-game-row-${game.id}">
              <td>${game.date}</td>
              <td>${game.time}</td>
              <td>${game.matchup}</td>
              <td>${game.field}</td>
              <td>${game.level}</td>
              <td>
                <button
                  class="btn btn-primary"
                  data-testid="claim-game-${game.id}"
                  onclick="claimPortalGame(${game.id})">
                  Claim
                </button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function claimPortalGame(gameId) {
  const result = portalService.claimGame(gameId);

  if (result.success) {
    renderPage("claim-games");
  } else {
    alert(result.message);
  }
}