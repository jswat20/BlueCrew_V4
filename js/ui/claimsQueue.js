function renderClaimsQueue() {
  const claims = claimsQueueService.getPendingClaims();

  if (!claims.length) {
    return `
      <section class="page-section" data-testid="claims-queue">
        <h2>Claims Queue</h2>
        <div class="empty-state" data-testid="claims-queue-empty">
          There are no pending claims.
        </div>
      </section>
    `;
  }

  return `
    <section class="page-section" data-testid="claims-queue">
      <h2>Claims Queue</h2>

      <div class="claims-queue-list" data-testid="claims-queue-list">
        ${claims.map(renderClaimQueueCard).join("")}
      </div>
    </section>
  `;
}

function renderClaimQueueCard(claim) {
  return `
    <article class="claim-queue-card" data-testid="claim-queue-card">
      <h3>${claim.matchup}</h3>

      <p>Position: ${claim.position}</p>
      <p>Claimed by: ${claim.claimedByName}</p>

      <div class="claim-queue-actions">
        <button
          type="button"
          data-testid="approve-claim-${claim.assignmentId}"
          onclick="handleApproveClaim('${claim.gameId}', '${claim.assignmentId}')"
        >
          Approve
        </button>

        <button
          type="button"
          data-testid="reject-claim-${claim.assignmentId}"
          onclick="handleRejectClaim('${claim.gameId}', '${claim.assignmentId}')"
        >
          Reject
        </button>
      </div>
    </article>
  `;
}

function handleApproveClaim(gameId, assignmentId) {
  claimsQueueService.approveClaim(gameId, assignmentId);
  renderPage("claims-queue");
}

function handleRejectClaim(gameId, assignmentId) {
  claimsQueueService.rejectClaim(gameId, assignmentId);
  renderPage("claims-queue");
}