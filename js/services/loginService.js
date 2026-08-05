// js/services/loginService.js

const loginService = (() => {
  const SESSION_KEY = "bluecrew_session";

  function getRepository() {
    return repositoryProvider.get("session");
  }

  function mutationResult(success, message, data = null) {
    return {
      success,
      message,
      data
    };
  }

  function login(email) {
    if (!email) {
      return mutationResult(false, "Email is required.");
    }

    const account = accountService
      .getApprovedAccounts()
      .find(a => a.email.toLowerCase() === email.toLowerCase());

    if (!account) {
      return mutationResult(
        false,
        "Account not found or awaiting approval."
      );
    }

    const loginAt =
      new Date().toISOString();

    const previousLoginAt =
      account.lastLogin || null;

    account.lastLogin = loginAt;

    accountService.updateAccount(account.id, {
      lastLogin: account.lastLogin
    });

    getRepository().write({
        accountId: account.id,
        role: account.role || "umpire",
        loginAt,
        previousLoginAt
      });

    if (
      typeof authService !== "undefined" &&
      typeof authService.useAuthenticatedAccount === "function"
    ) {
      authService.useAuthenticatedAccount(account);
    }

    return mutationResult(true, "Login successful.", account);
  }

  function logout() {
    getRepository().remove();

    return mutationResult(true, "Logged out.");
  }

  function getCurrentSession() {
    return getRepository().read();
  }

  function isLoggedIn() {
    return getCurrentSession() !== null;
  }

  function getCurrentAccount() {
    const session = getCurrentSession();

    if (!session) {
      return null;
    }

    return accountService.getById(session.accountId);
  }

  return {
    login,
    logout,
    isLoggedIn,
    getCurrentSession,
    getCurrentAccount
  };
})();
