// js/ui/accounts.js

function renderAccounts() {
  const pendingAccounts = accountService.getPendingAccounts();
  const unlinkedAccounts = accountService.getUnlinkedApprovedAccounts();
  const crewMembers = crewService.getAll();

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

      <hr>

      <h3>Approved - Needs Crew Link</h3>

      ${
        unlinkedAccounts.length === 0
          ? `
            <div
              class="empty-state"
              data-testid="unlinked-accounts-empty">
              Every approved account is linked.
            </div>
          `
          : `
            <div data-testid="unlinked-account-list">
              ${unlinkedAccounts
                .map(account => renderUnlinkedAccount(account, crewMembers))
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
function renderUnlinkedAccount(account, crewMembers) {
  return `
    <div
      class="card"
      data-testid="unlinked-account-${account.id}">

      <strong>
        ${account.firstName} ${account.lastName}
      </strong>

      <div>${account.email}</div>

      <select
        data-testid="crew-select-${account.id}"
        id="crew-select-${account.id}">

        <option value="">
          Select Crew Member
        </option>

        ${crewMembers.map(member => `
          <option value="${member.id}">
            ${member.firstName} ${member.lastName}
          </option>
        `).join("")}

      </select>

      <button
        data-testid="link-crew-${account.id}"
        onclick="linkCrewAccount('${account.id}')">
        Link Crew
      </button>

    </div>
  `;
}
function linkCrewAccount(accountId) {
  const select = document.getElementById(
    `crew-select-${accountId}`
  );

  const crewId = select.value;

  if (!crewId) {
    toastService?.show?.("Select a crew member first.");
    return;
  }

  const result = accountService.linkCrew(
    accountId,
    crewId
  );

  toastService?.show?.(result.message);

  renderPage("accounts");
}
// end of file - duplicate template and function removed