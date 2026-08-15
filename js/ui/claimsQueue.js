const selectedClaimIds = new Set();
const claimDecisionIdsInFlight = new Set();

function getClaimDecisionKey(gameId, assignmentId, claimId) {
  return [gameId, assignmentId, claimId].map(value => String(value || "")).join(":");
}

function getClaimQueueGameIdentifier(claim) {
  const game = claim.game || {};
  const metadata = {
    year: game.year,
    seasonCode: game.seasonCode,
    organizationCode: game.organizationCode,
    leagueCode: game.leagueCode,
    canonicalLevel: game.canonicalLevel,
    level: game.level,
    sequence: game.sequence,
    gameNumber: game.gameNumber
  };
  const complete = metadata.year && metadata.seasonCode &&
    (metadata.organizationCode || metadata.leagueCode) &&
    (metadata.canonicalLevel || metadata.level) &&
    (metadata.sequence || metadata.gameNumber);
  return complete
    ? presentationFormattingService.formatGameIdentifier(metadata)
    : game.gameIdentifier || game.gameCode || claim.gameId || game.id || "Game ID unavailable";
}

function getClaimQueueLocation(claim) {
  const complex = String(claim.locationComplex || "").trim();
  let field = String(claim.locationField || "").trim();
  if (complex && field.toLowerCase().startsWith(complex.toLowerCase())) {
    field = field.slice(complex.length).replace(/^\s*[-•·|]\s*/, "").trim();
  }
  return [complex, field].filter(Boolean).join(" • ") || claim.field || "Location unavailable";
}

function renderClaimsQueue(context = {}) {
  const highlightedId = context.highlightId;
  const claims = claimsQueueService.getPendingClaims();

  if (!claims.length) {
    selectedClaimIds.clear();
    return `
      <section class="page-section" data-testid="claims-queue">
        <div class="claims-queue-heading">
          <h2>Claims Queue</h2>
          <span class="status-badge status-badge-pending-approval" data-testid="claims-pending-count">0 Pending</span>
        </div>
        <div class="empty-state" data-testid="claims-queue-empty">There are no pending claims.</div>
      </section>`;
  }

  return `
    <section class="page-section" data-testid="claims-queue">
      <div class="claims-queue-heading">
        <h2>Claims Queue</h2>
        <span class="status-badge status-badge-pending-approval" data-testid="claims-pending-count">${claims.length} Pending</span>
      </div>
      <p class="claims-queue-showing" data-testid="claims-queue-showing">Showing ${claims.length} pending ${claims.length === 1 ? "claim" : "claims"}</p>

      <div class="claim-queue-bulk-actions" aria-label="Bulk claim actions">
        <button type="button" data-testid="select-all-claims" onclick="handleSelectAllClaims()">Select All</button>
        <button type="button" data-testid="clear-selected-claims" onclick="handleClearSelectedClaims()" ${selectedClaimIds.size === 0 ? "disabled" : ""}>Clear Selection</button>
        <button type="button" data-testid="bulk-approve-claims" onclick="handleBulkApproveClaims()" ${selectedClaimIds.size === 0 ? "disabled" : ""}>Approve Selected</button>
        <button type="button" data-testid="bulk-reject-claims" onclick="handleBulkRejectClaims()" ${selectedClaimIds.size === 0 ? "disabled" : ""}>Reject Selected</button>
      </div>

      <div class="claims-queue-table-wrapper" data-testid="claims-queue-scroll-region" tabindex="0" aria-label="Pending claims table">
        <table class="claims-queue-table" data-testid="claims-queue-list">
          <thead><tr>
            <th scope="col"><span class="sr-only">Select</span></th>
            <th scope="col">Date</th><th scope="col">Time</th><th scope="col">Game</th>
            <th scope="col">Division</th><th scope="col" class="claims-align-left">Location</th>
            <th scope="col" class="claims-align-left">Official</th><th scope="col">Position</th>
            <th scope="col">Status</th><th scope="col">Actions</th>
          </tr></thead>
          <tbody>${claims.map(claim => renderClaimQueueCard(claim, highlightedId)).join("")}</tbody>
        </table>
      </div>
    </section>`;
}

function renderClaimQueueCard(claim, highlightedId) {
  const isSelected = selectedClaimIds.has(claim.assignmentId);
  const claimId = claim.relatedId || claim.gameId || claim.id;
  const isHighlighted = highlightedId && String(claimId) === String(highlightedId);
  const decisionKey = getClaimDecisionKey(claim.gameId, claim.assignmentId, claim.claimId);
  const isDeciding = claimDecisionIdsInFlight.has(decisionKey);
  const division = levelTerminologyService.aliasFor(claim.level) ||
    levelTerminologyService.canonicalize(claim.level) || claim.level || "—";

  return `
    <tr class="claim-queue-row ${isHighlighted ? "is-highlighted" : ""}" data-testid="claim-queue-card" ${isHighlighted ? 'data-highlighted="true"' : ""}>
      <td class="claim-select-cell"><label><span class="sr-only">Select claim for ${claim.claimedByName}</span><input type="checkbox" data-testid="claim-select-checkbox" ${isSelected ? "checked" : ""} onchange="toggleClaimSelection('${claim.assignmentId}')" /></label></td>
      <td data-testid="claim-date">${dateTimeFormattingService.formatDateShort(claim.date)}</td>
      <td data-testid="claim-time">${dateTimeFormattingService.formatTime12Hour(claim.time)}</td>
      <td data-testid="claim-game-identifier">${getClaimQueueGameIdentifier(claim)}</td>
      <td data-testid="claim-level">${division}</td>
      <td class="claims-align-left" data-testid="claim-location">${getClaimQueueLocation(claim)}</td>
      <td class="claims-align-left" data-testid="claim-claimed-by">${claim.claimedByName}</td>
      <td data-testid="claim-position">${presentationFormattingService.formatAssignmentPosition(claim.position)}</td>
      <td><span class="status-badge ${presentationFormattingService.getStatusBadgeClass("pending approval")}" data-testid="claim-status">Pending</span></td>
      <td><div class="claim-queue-actions">
        <button type="button" class="button button-compact" data-testid="approve-claim-${claim.assignmentId}" ${isDeciding ? 'disabled aria-busy="true"' : ""} onclick="handleApproveClaim('${claim.gameId}', '${claim.assignmentId}', '${claim.claimId}')">Approve</button>
        <button type="button" class="button button-compact button-danger" data-testid="reject-claim-${claim.assignmentId}" ${isDeciding ? 'disabled aria-busy="true"' : ""} onclick="handleRejectClaim('${claim.gameId}', '${claim.assignmentId}', '${claim.claimId}')">Reject</button>
      </div></td>
    </tr>`;
}

function toggleClaimSelection(assignmentId) {
  if (selectedClaimIds.has(assignmentId)) selectedClaimIds.delete(assignmentId);
  else selectedClaimIds.add(assignmentId);
  renderPage("claims-queue");
}

function handleSelectAllClaims() {
  claimsQueueService.getPendingClaims().forEach(claim => selectedClaimIds.add(claim.assignmentId));
  renderPage("claims-queue");
}

function handleClearSelectedClaims() {
  selectedClaimIds.clear();
  renderPage("claims-queue");
}

async function runClaimDecision(action, gameId, assignmentId, claimId) {
  const decisionKey = getClaimDecisionKey(gameId, assignmentId, claimId);
  if (claimDecisionIdsInFlight.has(decisionKey)) {
    return { success: false, message: "Claim decision already in progress." };
  }
  claimDecisionIdsInFlight.add(decisionKey);
  renderPage("claims-queue");
  let result;
  try {
    result = await action(gameId, assignmentId, claimId);
  } catch (error) {
    claimDecisionIdsInFlight.delete(decisionKey);
    renderPage("claims-queue");
    throw error;
  } finally {
    claimDecisionIdsInFlight.delete(decisionKey);
  }
  if (result?.success === false) {
    renderPage("claims-queue");
    return result;
  }
  selectedClaimIds.delete(assignmentId);
  if (typeof refreshWorkbenchIfActive === "function") refreshWorkbenchIfActive();
  renderPage("claims-queue");
  return result;
}

function handleApproveClaim(gameId, assignmentId, claimId) {
  return runClaimDecision(claimsQueueService.approveClaim, gameId, assignmentId, claimId);
}

function handleRejectClaim(gameId, assignmentId, claimId) {
  return runClaimDecision(claimsQueueService.rejectClaim, gameId, assignmentId, claimId);
}

async function handleBulkApproveClaims() {
  const claims = claimsQueueService.getPendingClaims();
  let changed = false;
  for (const claim of claims.filter(item => selectedClaimIds.has(item.assignmentId))) {
    const result = await claimsQueueService.approveClaim(claim.gameId, claim.assignmentId, claim.claimId);
    if (result?.success !== false) changed = true;
  }
  selectedClaimIds.clear();
  if (changed && typeof refreshWorkbenchIfActive === "function") refreshWorkbenchIfActive();
  renderPage("claims-queue");
}

async function handleBulkRejectClaims() {
  const claims = claimsQueueService.getPendingClaims();
  let changed = false;
  for (const claim of claims.filter(item => selectedClaimIds.has(item.assignmentId))) {
    const result = await claimsQueueService.rejectClaim(claim.gameId, claim.assignmentId, claim.claimId);
    if (result?.success !== false) changed = true;
  }
  selectedClaimIds.clear();
  if (changed && typeof refreshWorkbenchIfActive === "function") refreshWorkbenchIfActive();
  renderPage("claims-queue");
}
