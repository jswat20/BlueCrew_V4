// js/services/loginService.js

const loginService = (() => {
  const SESSION_KEY = "bluecrew_session";

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

    account.lastLogin = new Date().toISOString();

    accountService.updateAccount(account.id, {
      lastLogin: account.lastLogin
    });

    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        accountId: account.id,
        role: account.role || "umpire",
        loginAt: new Date().toISOString()
      })
    );

    return mutationResult(true, "Login successful.", account);
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);

    return mutationResult(true, "Logged out.");
  }

  function getCurrentSession() {
    const session = localStorage.getItem(SESSION_KEY);

    return session
      ? JSON.parse(session)
      : null;
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