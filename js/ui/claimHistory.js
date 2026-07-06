function renderClaimHistory() {
  const approvedClaims = claimsQueueService.getApprovedClaims();
  const rejectedClaims = claimsQueueService.getRejectedClaims();

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

      ${renderClaimHistorySummary(approvedClaims, rejectedClaims)}

      <section data-testid="claim-history-approved">
        <h3>Approved Claims</h3>
        ${approvedClaims.map(claim => renderClaimHistoryCard(claim, "approved")).join("")}
      </section>

      <section data-testid="claim-history-rejected">
        <h3>Rejected Claims</h3>
        ${rejectedClaims.map(claim => renderClaimHistoryCard(claim, "rejected")).join("")}
      </section>
    </section>
  `;
}

function renderClaimHistorySummary(approvedClaims, rejectedClaims) {
  const today = new Date().toISOString().split("T")[0];

  const approvedToday = approvedClaims.filter(claim =>
    claim.assignment.claimProcessedAt?.startsWith(today)
  ).length;

  const rejectedToday = rejectedClaims.filter(claim =>
    claim.assignment.claimProcessedAt?.startsWith(today)
  ).length;

  return `
    <section class="claim-history-summary" data-testid="claim-history-summary">
      <article class="claim-history-summary-card" data-testid="claim-history-approved-today">
        <h3>Approved Today</h3>
        <p>${approvedToday}</p>
      </article>

      <article class="claim-history-summary-card" data-testid="claim-history-rejected-today">
        <h3>Rejected Today</h3>
        <p>${rejectedToday}</p>
      </article>

      <article class="claim-history-summary-card" data-testid="claim-history-total-approved">
        <h3>Total Approved</h3>
        <p>${approvedClaims.length}</p>
      </article>

      <article class="claim-history-summary-card" data-testid="claim-history-total-rejected">
        <h3>Total Rejected</h3>
        <p>${rejectedClaims.length}</p>
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