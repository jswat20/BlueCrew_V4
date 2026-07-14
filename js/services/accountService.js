// js/services/accountService.js

const accountService = (() => {
  const STORAGE_KEY = "bluecrew_accounts";
const ACCOUNT_ROLES = Object.freeze({
  ADMINISTRATOR: "administrator",
  ASSIGNER: "assigner",
  UMPIRE: "umpire"
});

const VALID_ACCOUNT_ROLES = Object.values(ACCOUNT_ROLES);

function requireManageAccounts() {
  if (
    typeof authorizationService !== "undefined" &&
    !authorizationService.canManageAccounts()
  ) {
    return mutationResult(false, "Unauthorized.");
  }

  return null;
}

function normalizeRole(role) {
  return VALID_ACCOUNT_ROLES.includes(role)
    ? role
    : ACCOUNT_ROLES.UMPIRE;
}

function isValidRole(role) {
  return VALID_ACCOUNT_ROLES.includes(role);
}
  function mutationResult(success, message, data = null) {
    return { success, message, data };
  }

  function getAll() {
    const accounts = localStorage.getItem(STORAGE_KEY);
    return accounts ? JSON.parse(accounts) : [];
  }

  function saveAll(accounts) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  }

  function generateId() {
  return `account-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

  function normalizeAccount(account) {
    return {
      id: account.id || generateId(),
      firstName: account.firstName || "",
      lastName: account.lastName || "",
      email: account.email || "",
      phone: account.phone || "",
      address: account.address || "",
      emergencyContact: account.emergencyContact || "",
      emergencyContactPhone:
        account.emergencyContactPhone || "",
      status: account.status || "pending",
      crewId: account.crewId || null,
      createdAt: account.createdAt || new Date().toISOString(),
      approvedAt: account.approvedAt || null,
      rejectedAt: account.rejectedAt || null,
role: normalizeRole(account.role),
      lastLogin: account.lastLogin || null,
    };
  }

  function createAccount(accountData = {}) {
    const accounts = getAll();

    const account = normalizeAccount(accountData);

    if (!account.firstName || !account.lastName || !account.email) {
      return mutationResult(false, "First name, last name, and email are required.");
    }

    const emailExists = accounts.some(
      account =>
        account.email.toLowerCase() === accountData.email.toLowerCase()
    );

    if (emailExists) {
      return mutationResult(false, "An account with this email already exists.");
    }

    accounts.push(account);
    saveAll(accounts);

    return mutationResult(true, "Account created and pending approval.", account);
  }

 function approveAccount(accountId, crewId = null) {
    const authorization = requireManageAccounts();

    if (authorization) {
      return authorization;
    }

  const accounts = getAll();
  const account = accounts.find(account => account.id === accountId);

  if (!account) {
    return mutationResult(false, "Account not found.");
  }

  account.status = "approved";
  account.crewId = crewId || account.crewId || null;
  account.approvedAt = new Date().toISOString();
  account.rejectedAt = null;

  saveAll(accounts);

  return mutationResult(true, "Account approved.", account);
}

function approveAccounts(accountIds = []) {
    const authorization = requireManageAccounts();

    if (authorization) {
      return authorization;
    }

  const summary = {
    processed: 0,
    approved: 0,
    failed: 0
  };

  for (const accountId of accountIds) {
    summary.processed++;

    const result = approveAccount(accountId);

    if (result.success) {
      summary.approved++;
    } else {
      summary.failed++;
    }
  }

  return mutationResult(
    true,
    `${summary.approved} account(s) approved.`,
    summary
  );
}

function rejectAccount(accountId) {
    const authorization = requireManageAccounts();

    if (authorization) {
      return authorization;
    }

  const accounts = getAll();
  const account = accounts.find(account => account.id === accountId);

  if (!account) {
    return mutationResult(false, "Account not found.");
  }

  account.status = "rejected";
  account.rejectedAt = new Date().toISOString();

  saveAll(accounts);

  return mutationResult(true, "Account rejected.", account);
}

function rejectAccounts(accountIds = []) {
    const authorization = requireManageAccounts();

    if (authorization) {
      return authorization;
    }

  const summary = {
    processed: 0,
    rejected: 0,
    failed: 0
  };

  for (const accountId of accountIds) {
    summary.processed++;

    const result = rejectAccount(accountId);

    if (result.success) {
      summary.rejected++;
    } else {
      summary.failed++;
    }
  }

  return mutationResult(
    true,
    `${summary.rejected} account(s) rejected.`,
    summary
  );
}

  function filterAccountsByRole(accounts, role = "all") {
  if (!role || role === "all") {
    return accounts;
  }

  if (!isValidRole(role)) {
    return [];
  }

  return accounts.filter(account => account.role === role);
}

function getPendingAccounts(options = {}) {
  const accounts = getAll().filter(
    account => account.status === "pending"
  );

  return filterAccountsByRole(accounts, options.role);
}

  function getApprovedAccounts(options = {}) {
  const accounts = getAll().filter(
    account => account.status === "approved"
  );

  return filterAccountsByRole(accounts, options.role);
}

  function getById(accountId) {
    return getAll().find(account => account.id === accountId) || null;
  }

  function updateAccount(accountId, updates = {}) {
    const authorization = requireManageAccounts();

    if (authorization) {
      return authorization;
    }

    const accounts = getAll();
    const account = accounts.find(account => account.id === accountId);

    if (!account) {
      return mutationResult(false, "Account not found.");
    }

    Object.assign(account, {
      ...updates,
      id: account.id
    });

    saveAll(accounts);

    return mutationResult(true, "Account updated.", account);
  }

  function linkCrew(accountId, crewId) {
    const authorization = requireManageAccounts();

    if (authorization) {
      return authorization;
    }

  const accounts = getAll();

  const account = accounts.find(a => a.id === accountId);

  if (!account) {
    return mutationResult(false, "Account not found.");
  }

  if (account.status !== "approved") {
    return mutationResult(false, "Only approved accounts may be linked.");
  }

  const crewMember = crewService.getById(crewId);

  if (!crewMember) {
    return mutationResult(false, "Crew member not found.");
  }

  const existingLink = accounts.find(
    a => a.id !== accountId && a.crewId === crewId
  );

  if (existingLink) {
    return mutationResult(
      false,
      "Crew member is already linked to another account."
    );
  }

  account.crewId = crewId;

  saveAll(accounts);

  return mutationResult(true, "Crew linked successfully.", account);
}

function unlinkCrew(accountId) {
    const authorization = requireManageAccounts();

    if (authorization) {
      return authorization;
    }

  const accounts = getAll();

  const account = accounts.find(a => a.id === accountId);

  if (!account) {
    return mutationResult(false, "Account not found.");
  }

  account.crewId = null;

  saveAll(accounts);

  return mutationResult(true, "Crew unlinked successfully.", account);
}

function getUnlinkedApprovedAccounts(options = {}) {
  const accounts = getAll().filter(
    account =>
      account.status === "approved" &&
      account.crewId === null
  );

  return filterAccountsByRole(accounts, options.role);
}
function getRoles() {
  return [...VALID_ACCOUNT_ROLES];
}

function updateRole(accountId, role) {
    const authorization = requireManageAccounts();

    if (authorization) {
      return authorization;
    }

  if (!isValidRole(role)) {
    return mutationResult(false, "Invalid account role.");
  }

  const accounts = getAll();
  const account = accounts.find(item => item.id === accountId);

  if (!account) {
    return mutationResult(false, "Account not found.");
  }

  account.role = role;

  saveAll(accounts);

  return mutationResult(
    true,
    "Account role updated.",
    account
  );
}

function getByRole(role) {
  if (!isValidRole(role)) {
    return [];
  }

  return getAll().filter(
    account => normalizeRole(account.role) === role
  );
}

function getRoleSummary() {
  return getAll().reduce(
    (summary, account) => {
      const role = normalizeRole(account.role);
      summary[role] += 1;
      return summary;
    },
    {
      administrator: 0,
      assigner: 0,
      umpire: 0
    }
  );
}
  function normalizeProfileValue(value) {
    return String(value || "").trim();
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function normalizePhone(value) {
    const phone = normalizeProfileValue(value);

    if (!phone) {
      return "";
    }

    const digits = phone.replace(/\D/g, "");

    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(
        3,
        6
      )}-${digits.slice(6)}`;
    }

    return phone;
  }

  function getProfile(accountId) {
    const account = getById(accountId);

    if (!account) {
      return null;
    }

    return {
      id: account.id,
      firstName: account.firstName || "",
      lastName: account.lastName || "",
      name:
        `${account.firstName || ""} ${
          account.lastName || ""
        }`.trim(),
      email: account.email || "",
      phone: account.phone || "",
      address: account.address || "",
      emergencyContact:
        account.emergencyContact || "",
      emergencyContactPhone:
        account.emergencyContactPhone || "",
      role: normalizeRole(account.role),
      crewId: account.crewId || null
    };
  }

  function updateProfile(accountId, updates = {}) {
    const accounts = getAll();

    const account = accounts.find(
      item => String(item.id) === String(accountId)
    );

    if (!account) {
      return mutationResult(
        false,
        "Account not found."
      );
    }

    const email =
      normalizeProfileValue(updates.email);

    if (!email) {
      return mutationResult(
        false,
        "Email is required."
      );
    }

    if (!isValidEmail(email)) {
      return mutationResult(
        false,
        "Enter a valid email address."
      );
    }

    const duplicateEmail = accounts.some(
      item =>
        String(item.id) !== String(accountId) &&
        String(item.email || "").toLowerCase() ===
          email.toLowerCase()
    );

    if (duplicateEmail) {
      return mutationResult(
        false,
        "An account with this email already exists."
      );
    }

    account.email = email;
    account.phone =
      normalizePhone(updates.phone);
    account.address =
      normalizeProfileValue(updates.address);
    account.emergencyContact =
      normalizeProfileValue(
        updates.emergencyContact
      );
    account.emergencyContactPhone =
      normalizePhone(
        updates.emergencyContactPhone
      );

    saveAll(accounts);

    return mutationResult(
      true,
      "Profile saved.",
      getProfile(account.id)
    );
  }

  function deleteAccount(accountId) {
    const authorization = requireManageAccounts();

    if (authorization) {
      return authorization;
    }

    const accounts = getAll();
    const nextAccounts = accounts.filter(account => account.id !== accountId);

    if (nextAccounts.length === accounts.length) {
      return mutationResult(false, "Account not found.");
    }

    saveAll(nextAccounts);

    return mutationResult(true, "Account deleted.", { id: accountId });
  }

  return {
    getAll,
    createAccount,
    approveAccount,
    approveAccounts,
    rejectAccount,
    rejectAccounts,
    getPendingAccounts,
    getApprovedAccounts,
    getUnlinkedApprovedAccounts,
    getById,
    getProfile,
    updateProfile,
    updateAccount,
    deleteAccount,
    linkCrew,
    unlinkCrew,
    getRoles,
    updateRole,
    getByRole,
    getRoleSummary
  };
})();