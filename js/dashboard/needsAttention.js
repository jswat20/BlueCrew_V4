// needsAttention.js

function renderNeedsAttention() {
  const items = dashboardService.getNeedsAttention();

  return `
    <section class="dashboard-card needs-attention">
      <div class="card-header">
        <h2>Needs Attention</h2>
        <span class="card-subtitle">Issues to review</span>
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
      class="attention-item attention-${item.severity}"
      onclick="handleNeedsAttentionClick('${item.action}')"
    >
      <div>
        <strong>${item.title}</strong>
        <span>${getAttentionMessage(item)}</span>
      </div>

      <div class="attention-count">${item.count}</div>
    </button>
  `;
}

function getAttentionMessage(item) {
  if (item.count === 0) return "No issues found";
  if (item.count === 1) return "1 item needs review";
  return `${item.count} items need review`;
}

function handleNeedsAttentionClick(action) {
  renderPage("schedule");
}