// js/ui/reviewQueue.js

function escapeReviewQueueText(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatReviewSubmittedAt(value) {
  if (!value) {
    return "";
  }

  const submittedAt = new Date(value);

  if (Number.isNaN(submittedAt.getTime())) {
    return String(value);
  }

  return submittedAt.toLocaleString(
    undefined,
    {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }
  );
}

function openGameReview(gameId) {
  renderPage("game-hub", {
    gameId,
    reviewMode: true
  });
}

function renderReviewQueue(context = {}) {
  const summaries =
    reviewService
      .getSubmittedGames()
      .map(game =>
        reviewService.getReviewSummary(game.id)
      )
      .filter(Boolean);

  if (!summaries.length) {
    return `
      <section
        class="page-section"
        data-testid="review-queue"
      >
        <h2>Review Queue</h2>

        <div
          class="empty-state"
          data-testid="review-queue-empty"
        >
          <p>No submitted games need review.</p>
        </div>
      </section>
    `;
  }

  return `
    <section
      class="page-section"
      data-testid="review-queue"
    >
      <h2>Review Queue</h2>

      <div class="table-wrapper">
        <table
          class="table"
          data-testid="review-queue-table"
        >
          <thead>
            <tr>
              <th>Date</th>
              <th>Matchup</th>
              <th>Field</th>
              <th>Completed By</th>
              <th>Submitted</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            ${summaries
              .map(summary => `
                <tr
                  data-testid="review-queue-row-${summary.gameId}"
                >
                  <td>
                    ${escapeReviewQueueText(summary.date)}
                  </td>

                  <td>
                    ${escapeReviewQueueText(summary.matchup)}
                  </td>

                  <td>
                    ${escapeReviewQueueText(summary.field)}
                  </td>

                  <td
                    data-testid="review-queue-completed-by-${summary.gameId}"
                  >
                    ${escapeReviewQueueText(
                      summary.completedBy ||
                      summary.submittedBy
                    )}
                  </td>

                  <td>
                    ${escapeReviewQueueText(
                      formatReviewSubmittedAt(
                        summary.submittedAt
                      )
                    )}
                  </td>

                  <td>
                    <button
                      type="button"
                      class="button button-primary"
                      data-testid="review-queue-open-${summary.gameId}"
                      onclick="openGameReview('${summary.gameId}')"
                    >
                      Review
                    </button>
                  </td>
                </tr>
              `)
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}
