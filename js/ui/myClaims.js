function renderMyClaims() {
  const claims = portalService.getMyPendingClaims();

  if (!claims.length) {
    return `
      <section class="page-section" data-testid="my-claims">
        <h2>Pending Claims</h2>
        <div class="empty-state" data-testid="my-claims-empty">
          You do not have any claims awaiting approval.
        </div>
      </section>
    `;
  }

  return `
    <section class="page-section" data-testid="my-claims">
      <h2>Pending Claims</h2>
      <div class="presentation-table-wrapper" role="region" aria-label="Pending Claims table" tabindex="0"><table class="table presentation-table shared-game-list"><thead><tr><th>Day/Date</th><th>Time</th><th>Level</th><th>Location</th><th>Field</th><th>Status</th><th>Open</th></tr></thead><tbody>
        ${claims.map(({ game, assignment }) => `
          <tr data-testid="my-claim-card"><td>${dateTimeFormattingService.formatDayDate(game.date)}</td><td>${dateTimeFormattingService.formatTime12Hour(game.time, "TBD")}</td><td>${levelTerminologyService.format(game.level)}</td><td>${game.locationComplex || game.complex || game.venue || "Location TBD"}</td><td>${game.locationField || game.field || "Field TBD"}</td><td><span class="status-badge">Awaiting Approval</span></td><td><button type="button" class="button button-primary button-compact" onclick="renderPage('game-hub', { gameId: '${game.id}', origin: 'my-claims', returnPage: 'my-claims' })">Open</button></td></tr>
        `).join("")}
      </tbody></table></div>
    </section>
  `;
}
