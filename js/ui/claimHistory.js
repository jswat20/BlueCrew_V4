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