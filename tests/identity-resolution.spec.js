const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.removeItem("bluecrew_accounts");
    localStorage.removeItem("bluecrew_session");
    localStorage.removeItem("bluecrew_notifications");
    repositoryProvider.useLocalStorage();
    authService.loginAsAdmin();
  });
});

test("legacy admin accounts resolve as one administrator identity", async ({ page }) => {
  const identity = await page.evaluate(() => {
    const account = accountService.createAccount({
      firstName: "Legacy",
      lastName: "Administrator",
      email: "legacy-administrator@example.com",
      role: "admin"
    }).data;
    accountService.approveAccount(account.id);
    loginService.login(account.email);
    return {
      account: loginService.getCurrentAccount(),
      session: loginService.getCurrentSession(),
      user: authService.getCurrentUser(),
      role: authorizationService.currentRole()
    };
  });

  expect(identity.account.role).toBe("administrator");
  expect(identity.session.role).toBe("administrator");
  expect(identity.user.id).toBe(identity.account.id);
  expect(identity.user.role).toBe("administrator");
  expect(identity.role).toBe("administrator");
});

test("umpire identity resolves with the linked crewId", async ({ page }) => {
  const identity = await page.evaluate(() => {
    const crewMember = crewService.getAll()[0];
    const account = accountService.createAccount({
      firstName: "Linked",
      lastName: "Umpire",
      email: "linked-umpire@example.com"
    }).data;
    accountService.approveAccount(account.id);
    accountService.linkCrew(account.id, crewMember.id);
    loginService.login(account.email);
    return {
      account: loginService.getCurrentAccount(),
      user: authService.getCurrentUser()
    };
  });

  expect(identity.account.crewId).toBeTruthy();
  expect(identity.user.id).toBe(identity.account.id);
  expect(identity.user.role).toBe("umpire");
  expect(identity.user.crewId).toBe(identity.account.crewId);
});

test("communication preferences belong to the authenticated account", async ({ page }) => {
  const result = await page.evaluate(() => {
    const muted = accountService.createAccount({
      firstName: "Muted",
      lastName: "Umpire",
      email: "muted-identity@example.com"
    }).data;
    const enabled = accountService.createAccount({
      firstName: "Enabled",
      lastName: "Umpire",
      email: "enabled-identity@example.com"
    }).data;
    accountService.approveAccount(muted.id);
    accountService.approveAccount(enabled.id);
    loginService.login(muted.email);
    const profile = accountService.getProfile(muted.id);
    accountService.updateProfile(muted.id, {
      ...profile,
      communicationPreferences: {
        ...profile.communicationPreferences,
        assignments: false
      }
    });
    const creation = notificationService.create({
      type: "assignment-created",
      audience: "admin",
      title: "Muted assignment",
      message: "Uses the signed-in account preferences."
    });
    return {
      creation,
      muted: accountService.getById(muted.id).communicationPreferences,
      enabled: accountService.getById(enabled.id).communicationPreferences
    };
  });

  expect(result.creation.suppressed).toBe(true);
  expect(result.muted.assignments).toBe(false);
  expect(result.enabled.assignments).toBe(true);
});

test("normal login replaces a disagreeing simulated identity", async ({ page }) => {
  const result = await page.evaluate(() => {
    const account = accountService.createAccount({
      firstName: "Normal",
      lastName: "Login",
      email: "normal-login@example.com"
    }).data;
    accountService.approveAccount(account.id);
    authService.loginAsAdmin();
    loginService.login(account.email);
    return {
      account: loginService.getCurrentAccount(),
      user: authService.getCurrentUser(),
      role: authorizationService.currentRole(),
      canClaim: authorizationService.canClaimGames(),
      canManageAccounts: authorizationService.canManageAccounts()
    };
  });

  expect(result.user.id).toBe(result.account.id);
  expect(result.user.role).toBe(result.account.role);
  expect(result.role).toBe("umpire");
  expect(result.canClaim).toBe(true);
  expect(result.canManageAccounts).toBe(false);
});
