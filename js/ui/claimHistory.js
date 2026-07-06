let claimHistoryStatusFilter = "all";

function renderClaimHistory() {
  const approvedClaims = claimsQueueService.getApprovedClaims();
  const rejectedClaims = claimsQueueService.getRejectedClaims();
  const summary = claimsQueueService.getClaimHistorySummary();

  const filteredApprovedClaims =
    claimHistoryStatusFilter === "rejected" ? [] : approvedClaims;

  const filteredRejectedClaims =
    claimHistoryStatusFilter === "approved" ? [] : rejectedClaims;

  if (!approvedClaims.length && !rejectedClaims.length) {
    return `
      <section class="page-section" data-testid="claim-history">
        <h2>Claim History</h2>
        <div class="empty-state" data-testid="claim-history-empty">
          There is no claim history.
        </div>
      </section>
    `;
  }

  return `
    <section class="page-section" data-testid="claim-history">
      <h2>Claim History</h2>

      ${renderClaimHistorySummary(summary)}
      ${renderClaimHistoryFilters()}

      <section data-testid="claim-history-approved">
        <h3>Approved Claims</h3>
        ${filteredApprovedClaims.map(claim => renderClaimHistoryCard(claim, "approved")).join("")}
      </section>

      <section data-testid="claim-history-rejected">
        <h3>Rejected Claims</h3>
        ${filteredRejectedClaims.map(claim => renderClaimHistoryCard(claim, "rejected")).join("")}
      </section>
    </section>
  `;
}

function renderClaimHistoryFilters() {
  return `
    <div class="claim-history-filters" data-testid="claim-history-filters">
      <button
        type="button"
        data-testid="claim-history-filter-all"
        class="${claimHistoryStatusFilter === "all" ? "active" : ""}"
        onclick="setClaimHistoryStatusFilter('all')">
        All
      </button>

      <button
        type="button"
        data-testid="claim-history-filter-approved"
        class="${claimHistoryStatusFilter === "approved" ? "active" : ""}"
        onclick="setClaimHistoryStatusFilter('approved')">
        Approved
      </button>

      <button
        type="button"
        data-testid="claim-history-filter-rejected"
        class="${claimHistoryStatusFilter === "rejected" ? "active" : ""}"
        onclick="setClaimHistoryStatusFilter('rejected')">
        Rejected
      </button>
    </div>
  `;
}

function setClaimHistoryStatusFilter(filter) {
  claimHistoryStatusFilter = filter;
  renderPage("claim-history");
}

function renderClaimHistorySummary(summary) {
  return `
    <section class="claim-history-summary" data-testid="claim-history-summary">
      <article class="claim-history-summary-card" data-testid="claim-history-approved-today">
        <h3>Approved Today</h3>
        <p>${summary.approvedToday}</p>
      </article>

      <article class="claim-history-summary-card" data-testid="claim-history-rejected-today">
        <h3>Rejected Today</h3>
        <p>${summary.rejectedToday}</p>
      </article>

      <article class="claim-history-summary-card" data-testid="claim-history-total-approved">
        <h3>Total Approved</h3>
        <p>${summary.totalApproved}</p>
      </article>

      <article class="claim-history-summary-card" data-testid="claim-history-total-rejected">
        <h3>Total Rejected</h3>
        <p>${summary.totalRejected}</p>
      </article>
    </section>
  `;
}

function renderClaimHistoryCard(claim, status) {
  return `
    <article class="claim-history-card" data-testid="${status}-claim-card">
      <h4>${claim.matchup}</h4>

      <p>Position: ${claim.position}</p>
      <p>Claimed by: ${claim.claimedByName}</p>
      <p>Date: ${claim.date}</p>
      <p>Time: ${claim.time}</p>
      <p>Field: ${claim.field}</p>
      <p>Level: ${claim.level}</p>
    </article>
  `;
}