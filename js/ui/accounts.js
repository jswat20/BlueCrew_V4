// js/ui/accounts.js

function renderAccounts() {
  const pendingAccounts = accountService.getPendingAccounts();

  return `
    <section
      class="panel"
      data-testid="accounts-page">

      <h2>Accounts</h2>
      <p class="muted">
        Review and manage umpire registrations.
      </p>

      <h3>Pending Approval</h3>

      ${
        pendingAccounts.length === 0
          ? `
            <div
              class="empty-state"
              data-testid="pending-accounts-empty">
              No pending accounts.
            </div>
          `
          : `
            <div data-testid="pending-accounts-list">
              ${pendingAccounts
                .map(renderPendingAccountRow)
                .join("")}
            </div>
          `
      }
    </section>
  `;
}

function renderPendingAccountRow(account) {
  return `
    <div
      class="card pending-account"
      data-testid="pending-account-${account.id}">

      <div class="pending-account-details">
        <strong>
          ${account.firstName} ${account.lastName}
        </strong>

        <div>${account.email}</div>

        <small>
          Registered ${formatAccountDate(account.createdAt)}
        </small>
      </div>

      <div class="pending-account-actions">
        <button
          data-testid="approve-account-${account.id}"
          onclick="approvePendingAccount('${account.id}')">
          Approve
        </button>

        <button
          data-testid="reject-account-${account.id}"
          onclick="rejectPendingAccount('${account.id}')">
          Reject
        </button>
      </div>
    </div>
  `;
}

function approvePendingAccount(accountId) {
  const result = accountService.approveAccount(accountId);

  alert(result.message);

  renderPage("accounts");
}

function rejectPendingAccount(accountId) {
  const result = accountService.rejectAccount(accountId);

  alert(result.message);

  renderPage("accounts");
}

function formatAccountDate(dateString) {
  return new Date(dateString).toLocaleDateString();
}