const selectedClaimIds = new Set();

function renderClaimsQueue() {
  const claims = claimsQueueService.getPendingClaims();

  if (!claims.length) {
    selectedClaimIds.clear();

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

      <div class="claim-queue-bulk-actions">
        <button
          type="button"
          data-testid="select-all-claims"
          onclick="handleSelectAllClaims()"
        >
          Select All
        </button>

        <button
          type="button"
          data-testid="clear-selected-claims"
          onclick="handleClearSelectedClaims()"
          ${selectedClaimIds.size === 0 ? "disabled" : ""}
        >
          Clear Selection
        </button>

        <button
          type="button"
          data-testid="bulk-approve-claims"
          onclick="handleBulkApproveClaims()"
          ${selectedClaimIds.size === 0 ? "disabled" : ""}
        >
          Approve Selected
        </button>

        <button
          type="button"
          data-testid="bulk-reject-claims"
          onclick="handleBulkRejectClaims()"
          ${selectedClaimIds.size === 0 ? "disabled" : ""}
        >
          Reject Selected
        </button>
      </div>

      <div class="claims-queue-list" data-testid="claims-queue-list">
        ${claims.map(renderClaimQueueCard).join("")}
      </div>
    </section>
  `;
}

function renderClaimQueueCard(claim) {
  const isSelected = selectedClaimIds.has(claim.assignmentId);

  return `
    <article class="claim-queue-card" data-testid="claim-queue-card">
      <label>
        <input
          type="checkbox"
          data-testid="claim-select-checkbox"
          ${isSelected ? "checked" : ""}
          onchange="toggleClaimSelection('${claim.assignmentId}')"
        />
        Select
      </label>

      <h3 data-testid="claim-matchup">${claim.matchup}</h3>

      <div class="claim-queue-details">
        <p data-testid="claim-date">Date: ${claim.date}</p>
        <p data-testid="claim-time">Time: ${claim.time}</p>
        <p data-testid="claim-field">Field: ${claim.field}</p>
        <p data-testid="claim-level">Level: ${claim.level}</p>
        <p data-testid="claim-position">Position: ${claim.position}</p>
        <p data-testid="claim-claimed-by">Claimed by: ${claim.claimedByName}</p>
      </div>

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

function toggleClaimSelection(assignmentId) {
  if (selectedClaimIds.has(assignmentId)) {
    selectedClaimIds.delete(assignmentId);
  } else {
    selectedClaimIds.add(assignmentId);
  }

  renderPage("claims-queue");
}

function handleSelectAllClaims() {
  claimsQueueService
    .getPendingClaims()
    .forEach(claim => selectedClaimIds.add(claim.assignmentId));

  renderPage("claims-queue");
}

function handleClearSelectedClaims() {
  selectedClaimIds.clear();
  renderPage("claims-queue");
}

function handleApproveClaim(gameId, assignmentId) {
  claimsQueueService.approveClaim(gameId, assignmentId);
  selectedClaimIds.delete(assignmentId);
  renderPage("claims-queue");
}

function handleRejectClaim(gameId, assignmentId) {
  claimsQueueService.rejectClaim(gameId, assignmentId);
  selectedClaimIds.delete(assignmentId);
  renderPage("claims-queue");
}

function handleBulkApproveClaims() {
  const claims = claimsQueueService.getPendingClaims();

  claims
    .filter(claim => selectedClaimIds.has(claim.assignmentId))
    .forEach(claim => {
      claimsQueueService.approveClaim(claim.gameId, claim.assignmentId);
    });

  selectedClaimIds.clear();
  renderPage("claims-queue");
}

function handleBulkRejectClaims() {
  const claims = claimsQueueService.getPendingClaims();

  claims
    .filter(claim => selectedClaimIds.has(claim.assignmentId))
    .forEach(claim => {
      claimsQueueService.rejectClaim(claim.gameId, claim.assignmentId);
    });

  selectedClaimIds.clear();
  renderPage("claims-queue");
}