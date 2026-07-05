function renderMyClaims() {
  const claims = portalService.getMyPendingClaims();

  if (!claims.length) {
    return `
      <section class="page-section" data-testid="my-claims">
        <h2>My Claims</h2>
        <div class="empty-state" data-testid="my-claims-empty">
          You do not have any pending claims.
        </div>
      </section>
    `;
  }

  return `
    <section class="page-section" data-testid="my-claims">
      <h2>My Claims</h2>

      <div class="card-grid">
        ${claims.map(({ game, assignment }) => `
          <div class="card" data-testid="my-claim-card">
            <h3>${game.homeTeam} vs ${game.awayTeam}</h3>
            <p>${game.date} at ${game.time}</p>
            <p>${game.field} • ${game.level}</p>
            <p>Position: ${assignment.position}</p>
            <p>Status: Pending Approval</p>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}