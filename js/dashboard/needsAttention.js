// js/dashboard/needsAttention.js

function renderNeedsAttention() {
  const items = dashboardService.getNeedsAttention();
  const totalAttentionItems = items.reduce(
    (total, item) => total + item.count,
    0
  );

  return `
    <section
      class="dashboard-card needs-attention"
      data-testid="dashboard-needs-attention">

      <div class="card-header">
        <h2>Needs Attention</h2>
        <span class="card-subtitle">
          ${
            totalAttentionItems
              ? `${totalAttentionItems} items to review`
              : "Everything looks good"
          }
        </span>
      </div>

      <div class="attention-list">
        ${items.map(renderAttentionItem).join("")}
      </div>
    </section>
  `;
}

function renderAttentionItem(item) {
  return `
    <button
      type="button"
      class="attention-item attention-${item.severity}"
      data-testid="dashboard-attention-${item.id}"
      onclick="handleNeedsAttentionClick('${item.action}')">

      <div>
        <strong>${item.title}</strong>
        <span>${getAttentionMessage(item)}</span>
      </div>

      <div
        class="attention-count"
        data-testid="dashboard-attention-${item.id}-count">
        ${item.count}
      </div>
    </button>
  `;
}

function getAttentionMessage(item) {
  if (item.count === 0) return "No action needed";
  if (item.count === 1) return "1 item needs review";

  return `${item.count} items need review`;
}

function handleNeedsAttentionClick(action) {
  switch (action) {
    case "open-assignments":
      openDashboardSchedule("open");
      return;

    case "pending-claims":
      renderPage("claims-queue");
      return;

    case "pending-accounts":
      renderPage("accounts");
      return;

    default:
      renderPage("dashboard");
  }
}
