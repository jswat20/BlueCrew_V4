// js/services/accountService.js

const accountService = (() => {
  const STORAGE_KEY = "bluecrew_accounts";

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
      status: account.status || "pending",
      crewId: account.crewId || null,
      createdAt: account.createdAt || new Date().toISOString(),
      approvedAt: account.approvedAt || null,
      rejectedAt: account.rejectedAt || null
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

  function rejectAccount(accountId) {
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

  function getPendingAccounts() {
    return getAll().filter(account => account.status === "pending");
  }

  function getApprovedAccounts() {
    return getAll().filter(account => account.status === "approved");
  }

  function getById(accountId) {
    return getAll().find(account => account.id === accountId) || null;
  }

  function updateAccount(accountId, updates = {}) {
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

  function deleteAccount(accountId) {
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
    rejectAccount,
    getPendingAccounts,
    getApprovedAccounts,
    getById,
    updateAccount,
    deleteAccount
  };
})();