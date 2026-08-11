// js/ui/accounts.js

const selectedPendingAccountIds = new Set();

let selectedRoleFilter = "all";

function renderAccounts(context = {}) {
  if (
    context.filter === "pending" ||
    context.status === "pending"
  ) {
    accountFilter = "pending";
  }

  const selectedFilter =
    typeof uiStateService?.getAccountFilter === "function"
      ? uiStateService.getAccountFilter()
      : "all";

  const roleOptions = {
    role: selectedRoleFilter
  };

  const pendingAccounts =
    accountService.getPendingAccounts(roleOptions);

  const approvedAccounts =
    accountService.getApprovedAccounts(roleOptions);

  const unlinkedAccounts =
    accountService.getUnlinkedApprovedAccounts(roleOptions).filter(account => account.role === "umpire");

  const linkedAccounts =
    approvedAccounts.filter(account => account.crewId !== null);

  const crewMembers = crewService.getAll();

  return `
    <section
      class="panel"
      data-testid="accounts-page"
      data-account-filter="${selectedFilter}">

      <h2>Accounts</h2>

      <p class="muted">
        Review and manage umpire registrations.
      </p>

      ${crewService.isSharedMode() ? `<section class="card account-invitation-card" data-testid="account-invitation-admin"><h3>Umpire Registration Invitation</h3><p class="muted">Create a one-use registration code. The umpire chooses their own Login Email and password; Contact Email is not changed.</p><button type="button" class="button button-secondary" data-testid="create-registration-invitation" onclick="createRegistrationInvitation()">Create One-Use Code</button><div id="registration-invitation-result" role="status" aria-live="polite"></div></section>` : ""}

${renderAccountFilters(selectedFilter)}
${renderRoleFilters()}
      ${
        selectedFilter === "all" ||
        selectedFilter === "pending"
          ? renderPendingAccountsSection(pendingAccounts)
          : ""
      }

      ${
        selectedFilter === "all"
          ? "<hr>"
          : ""
      }

      ${
        selectedFilter === "all" ||
        selectedFilter === "unlinked"
          ? renderUnlinkedAccountsSection(
    unlinkedAccounts,
              crewMembers
            )
          : ""
      }

      ${
        selectedFilter === "approved"
          ? renderApprovedAccountsSection(
    approvedAccounts,
              crewMembers
            )
          : ""
      }

      ${
        selectedFilter === "linked"
          ? renderLinkedAccountsSection(
    linkedAccounts,
              crewMembers
            )
          : ""
      }
    </section>
  `;
}

function renderAccountFilters(selectedFilter) {
  const filters = [
    { id: "all", label: "All" },
    { id: "pending", label: "Pending" },
    { id: "approved", label: "Approved" },
    { id: "linked", label: "Linked" },
    { id: "unlinked", label: "Unlinked" }
  ];

  return `
    <div
      class="filter-group"
      data-testid="account-filters">

      ${filters.map(filter => `
        <button
          type="button"
          class="filter-button ${
            selectedFilter === filter.id ? "active" : ""
          }"
          data-testid="account-filter-${filter.id}"
          aria-pressed="${
            selectedFilter === filter.id
              ? "true"
              : "false"
          }"
          onclick="setAccountFilter('${filter.id}')">
          ${filter.label}
        </button>
      `).join("")}
    </div>
  `;
}
function renderRoleFilters() {
  const filters = [
    ["all", "All Roles"],
    ["administrator", "Administrator"],
    ["assigner", "Assigner"],
    ["umpire", "Umpire"]
  ];

  return `
    <div
      class="filter-group"
      data-testid="account-role-filters">

      ${filters.map(([id, label]) => `
        <button
          type="button"
          class="filter-button ${
            selectedRoleFilter === id ? "active" : ""
          }"
          data-testid="account-role-filter-${id}"
          aria-pressed="${
            selectedRoleFilter === id
              ? "true"
              : "false"
          }"
          onclick="setAccountRoleFilter('${id}')">

          ${label}

        </button>
      `).join("")}

    </div>
  `;
}

function setAccountRoleFilter(role) {
  selectedRoleFilter = role;
  renderPage("accounts");
}
function setAccountFilter(filter) {
  uiStateService.setAccountFilter(filter);
  renderPage("accounts");
}

function renderPendingAccountsSection(pendingAccounts) {
  const hasSelection =
    selectedPendingAccountIds.size > 0;

  return `
    <section data-testid="pending-accounts-section">
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
            <div
              class="pending-account-bulk-actions"
              data-testid="pending-account-bulk-actions">

              <button
                type="button"
                data-testid="approve-selected-accounts"
                onclick="approveSelectedAccounts()"
                ${hasSelection ? "" : "disabled"}>
                Approve Selected
              </button>

              <button
                type="button"
                data-testid="reject-selected-accounts"
                onclick="rejectSelectedAccounts()"
                ${hasSelection ? "" : "disabled"}>
                Reject Selected
              </button>

              <button
                type="button"
                data-testid="clear-account-selection"
                onclick="clearPendingAccountSelection()"
                ${hasSelection ? "" : "disabled"}>
                Clear Selection
              </button>

              <span data-testid="selected-account-count">
                ${selectedPendingAccountIds.size} selected
              </span>
            </div>

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

function renderUnlinkedAccountsSection(
  unlinkedAccounts,
  crewMembers
) {
  return `
    <section data-testid="unlinked-accounts-section">
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
                .map(account =>
                  renderUnlinkedAccount(
                    account,
                    crewMembers
                  )
                )
                .join("")}
            </div>
          `
      }
    </section>
  `;
}

function renderApprovedAccountsSection(
  approvedAccounts,
  crewMembers
) {
  return `
    <section data-testid="approved-accounts-section">
      <h3>Approved Accounts</h3>

      ${
        approvedAccounts.length === 0
          ? `
            <div
              class="empty-state"
              data-testid="approved-accounts-empty">
              No approved accounts.
            </div>
          `
          : `
            <div data-testid="approved-account-list">
              ${approvedAccounts
                .map(account =>
                  renderApprovedAccount(
                    account,
                    crewMembers
                  )
                )
                .join("")}
            </div>
          `
      }
    </section>
  `;
}

function renderLinkedAccountsSection(
  linkedAccounts,
  crewMembers
) {
  return `
    <section data-testid="linked-accounts-section">
      <h3>Linked Accounts</h3>

      ${
        linkedAccounts.length === 0
          ? `
            <div
              class="empty-state"
              data-testid="linked-accounts-empty">
              No approved accounts are linked.
            </div>
          `
          : `
            <div data-testid="linked-account-list">
              ${linkedAccounts
                .map(account =>
                  renderApprovedAccount(
                    account,
                    crewMembers
                  )
                )
                .join("")}
            </div>
          `
      }
    </section>
  `;
}

function renderPendingAccountRow(account) {
  const accountId = String(account.id);
  const isSelected =
    selectedPendingAccountIds.has(accountId);

  return `
    <div
      class="card pending-account"
      data-testid="pending-account-${account.id}">

      <label>
        <input
          type="checkbox"
          data-testid="select-account-${account.id}"
          value="${account.id}"
          ${isSelected ? "checked" : ""}
          onchange="togglePendingAccountSelection(
            '${account.id}',
            this.checked
          )">
        Select
      </label>

      <div class="pending-account-details">
        <strong>
          ${account.firstName} ${account.lastName}
        </strong>

        <div>${account.email}</div>
<div>

  <label>

    Role

    <select
      data-testid="account-role-${account.id}"
      onchange="changePendingAccountRole(
        '${account.id}',
        this.value
      )">

      ${accountService.getRoles().map(role => `
        <option
          value="${role}"
          ${
            account.role === role
              ? "selected"
              : ""
          }>
          ${
            role.charAt(0).toUpperCase() +
            role.slice(1)
          }
        </option>
      `).join("")}

    </select>

  </label>

</div>
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

function togglePendingAccountSelection(accountId, selected) {
  const normalizedId = String(accountId);

  if (selected) {
    selectedPendingAccountIds.add(normalizedId);
  } else {
    selectedPendingAccountIds.delete(normalizedId);
  }

  updatePendingBulkControls();
}

function updatePendingBulkControls() {
  const hasSelection =
    selectedPendingAccountIds.size > 0;

  const approveButton = document.querySelector(
    '[data-testid="approve-selected-accounts"]'
  );

  const rejectButton = document.querySelector(
    '[data-testid="reject-selected-accounts"]'
  );

  const clearButton = document.querySelector(
    '[data-testid="clear-account-selection"]'
  );

  const count = document.querySelector(
    '[data-testid="selected-account-count"]'
  );

  if (approveButton) {
    approveButton.disabled = !hasSelection;
  }

  if (rejectButton) {
    rejectButton.disabled = !hasSelection;
  }

  if (clearButton) {
    clearButton.disabled = !hasSelection;
  }

  if (count) {
    count.textContent =
      `${selectedPendingAccountIds.size} selected`;
  }
}

function clearPendingAccountSelection() {
  selectedPendingAccountIds.clear();
  renderPage("accounts");
}

function approveSelectedAccounts() {
  const accountIds =
    Array.from(selectedPendingAccountIds);

  if (!accountIds.length) return;

  const result =
    accountService.approveAccounts(accountIds);

  selectedPendingAccountIds.clear();

  toastService?.show?.(result.message);
  renderPage("accounts");
}

function rejectSelectedAccounts() {
  const accountIds =
    Array.from(selectedPendingAccountIds);

  if (!accountIds.length) return;

  const result =
    accountService.rejectAccounts(accountIds);

  selectedPendingAccountIds.clear();

  toastService?.show?.(result.message);
  renderPage("accounts");
}

function renderApprovedAccount(account, crewMembers) {
  const crewMember = crewMembers.find(member =>
    String(member.id) === String(account.crewId)
  );

  const resetAction = authService.isAdmin?.() ? `<button type="button" class="button button-secondary" data-testid="send-password-reset-${account.id}" onclick="sendAdministrativePasswordReset('${account.id}')">Send Password Reset</button>` : "";
  if (account.role === "umpire" && typeof renderCrewCardFront === "function") return `<div class="account-security-admin-row">${renderCrewCardFront(account, { testId: `approved-account-${account.id}`, className: "account-crew-card", roleTestId: `account-role-display-${account.id}` })}${resetAction}</div>`;
  return `<div class="card" data-testid="approved-account-${account.id}"><strong>${account.firstName} ${account.lastName}</strong><div>Login Email: ${account.email}</div><div data-testid="account-role-display-${account.id}">Role: ${formatAccountRole(account.role)}</div><small>${crewMember ? `Linked to ${crewMember.firstName} ${crewMember.lastName}` : "Not linked to a crew member"}</small>${resetAction}</div>`;
}

async function createRegistrationInvitation() {
  const output = document.getElementById("registration-invitation-result");
  const code = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll("-", "");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const result = await accountService.createRegistrationInvitation(code, expiresAt, 1);
  if (!result.success) {
    if (output) output.textContent = result.message;
    return;
  }
  if (output) output.innerHTML = `<label>One-use Registration Code<input type="text" readonly value="${code}" data-testid="registration-invitation-code" aria-describedby="registration-code-expiry"></label><small id="registration-code-expiry">Expires in 24 hours. Share only with the intended adult.</small>`;
}

function changePendingAccountRole(accountId, role) {
  const account =
    accountService.getById(accountId);

  if (!account) {
    toastService?.error?.("Account not found.");
    return;
  }

  const result =
    accountService.updateRole(account.id, role);

  if (!result.success) {
    toastService?.error?.(result.message);
  }
}

function approvePendingAccount(accountId) {
  const result =
    accountService.approveAccount(accountId);

  alert(result.message);

  renderPage("accounts");
}

function rejectPendingAccount(accountId) {
  const result =
    accountService.rejectAccount(accountId);

  alert(result.message);

  renderPage("accounts");
}

function formatAccountDate(dateString) {
  if (!dateString) return "Unknown";

  return new Date(dateString).toLocaleDateString();
}

function formatAccountRole(role) {
  const normalizedRole =
    role || "umpire";

  return (
    normalizedRole.charAt(0).toUpperCase() +
    normalizedRole.slice(1)
  );
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

      <div
        data-testid="account-role-display-${account.id}">
        Role: ${formatAccountRole(account.role)}
      </div>

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

async function linkCrewAccount(accountId) {
  const select = document.getElementById(
    `crew-select-${accountId}`
  );

  const crewId = select?.value;

  if (!crewId) {
    toastService?.show?.(
      "Select a crew member first."
    );
    return;
  }

  const account = accountService.getById(accountId);
  if (!account || account.role !== "umpire" || account.status !== "approved") {
    toastService?.show?.("Only an approved umpire Login Account may be linked to crew.");
    return;
  }
  const result = crewService.isSharedMode()
    ? await crewService.manageLoginIdentity(crewId, "link", account.id)
    : accountService.linkCrew(accountId, crewId);

  toastService?.show?.(result.message);

  renderPage("accounts");
}
