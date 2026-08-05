import { test, expect } from "./fixtures/supabase-auth.fixture.js";

test("email/password login resolves the authoritative approved profile and crew", async ({ supabaseAuthApp }) => {
  const { page } = supabaseAuthApp;

  await expect(page.getByTestId("login-page")).toBeVisible();
  await expect(page.locator(".role-switcher")).toBeHidden();
  await expect(page.getByTestId("create-account-button")).toBeVisible();
  await expect(page.getByTestId("nav-claim-games")).toBeHidden();
  expect(await page.evaluate(() => authorizationService.canView("claim-games"))).toBe(false);
  const identity = await page.evaluate(async () => {
    const login = await loginService.loginWithPassword(
      "linked@example.com",
      "correct horse battery staple"
    );
    return {
    login,
    account: loginService.getCurrentAccount(),
    session: loginService.getCurrentSession(),
    user: authService.getCurrentUser(),
    role: authorizationService.currentRole()
  };
  });

  expect(identity.login.success).toBe(true);
  expect(identity.account.id).toBe("profile-umpire-1");
  expect(identity.account.crewId).toBe("crew-umpire-1");
  expect(identity.session.authUserId).toBe("auth-umpire-1");
  expect(identity.user.id).toBe(identity.account.id);
  expect(identity.role).toBe("umpire");
});

test.describe("pending identity", () => {
  test.use({
    supabaseScenario: {
      profile: {
        ...defaultPendingProfile(),
        status: "pending"
      }
    }
  });

  test("pending profile cannot establish an application login", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    const result = await page.evaluate(() =>
      loginService.loginWithPassword("pending@example.com", "password1234")
    );
    expect(result).toMatchObject({ success: false, message: "Account not found or awaiting approval." });
    expect(await page.evaluate(() => loginService.getCurrentAccount())).toBeNull();
    expect((await supabaseAuthApp.calls()).some(call => call.operation === "signOut")).toBe(true);
  });
});

test("authenticated registration provisions only through the controlled RPC", async ({ supabaseAuthApp }) => {
  const result = await supabaseAuthApp.page.evaluate(() =>
    accountService.registerAuthenticatedAccount({
      firstName: "New",
      lastName: "Umpire",
      email: "new@example.com",
      phone: "5550102222",
      password: "password1234",
      invitationCode: "M2B-INVITATION-CODE"
    })
  );

  expect(result.success).toBe(true);
  expect(result.data.status).toBe("pending");
  const calls = await supabaseAuthApp.calls();
  expect(calls.find(call => call.operation === "signUp")).toBeTruthy();
  expect(calls.find(call => call.name === "provision_pending_umpire")?.args).toEqual({
    p_invitation_code: "M2B-INVITATION-CODE",
    p_first_name: "New",
    p_last_name: "Umpire",
    p_phone: "5550102222"
  });
});

test.describe("administrator backend mutations", () => {
  test.use({
    supabaseScenario: {
      initialSession: true,
      crewId: null,
      profile: {
        id: "profile-admin-1",
        auth_user_id: "auth-admin-1",
        organization_id: "organization-1",
        first_name: "Test",
        last_name: "Administrator",
        email: "admin@example.com",
        role: "administrator",
        status: "approved",
        communication_preferences: {}
      }
    }
  });

test("accountService owns invitation creation and transactional approval calls", async ({ supabaseAuthApp }) => {
  const results = await supabaseAuthApp.page.evaluate(async () => ({
    invitation: await accountService.createRegistrationInvitation(
      "M2B-INVITATION-CODE",
      "2026-09-01T00:00:00.000Z",
      1
    ),
    approval: await accountService.approveAuthenticatedAccount("profile-umpire-1", "crew-umpire-1")
  }));

  expect(results.invitation.success).toBe(true);
  expect(results.approval.success).toBe(true);
  const calls = await supabaseAuthApp.calls();
  expect(calls.some(call => call.name === "create_umpire_invitation")).toBe(true);
  expect(calls.some(call => call.name === "approve_umpire_profile")).toBe(true);
});
});

function defaultPendingProfile() {
  return {
    id: "profile-pending-1",
    auth_user_id: "auth-pending-1",
    organization_id: "organization-1",
    first_name: "Pending",
    last_name: "Umpire",
    email: "pending@example.com",
    phone: "",
    role: "umpire",
    communication_preferences: {}
  };
}
