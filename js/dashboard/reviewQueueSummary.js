// js/dashboard/reviewQueueSummary.js

function renderReviewQueueSummary() {
  const counts =
    reviewService.getReviewCounts();

  return `
    <section
      class="dashboard-card"
      data-testid="dashboard-review-card"
    >
      <div class="card-header">
        <div>
          <h2>Needs Review</h2>
          <span class="card-subtitle">
            Submitted game reports
          </span>
        </div>
      </div>

      <div
        class="summary-value"
        data-testid="dashboard-review-count"
      >
        ${counts.needsReview}
      </div>

      <div
        class="summary-label"
        data-testid="dashboard-review-label"
      >
        Submitted
      </div>

      <div class="card-actions">
        <button
          type="button"
          class="button button-primary"
          data-testid="dashboard-open-review-queue"
          onclick="renderPage('review-queue')"
        >
          Open Queue
        </button>
      </div>
    </section>
  `;
}
