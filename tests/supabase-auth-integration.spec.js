import { test, expect } from "./fixtures/supabase-auth.fixture.js";

test("email/password login resolves the authoritative approved profile and crew", async ({ supabaseAuthApp }) => {
  const { page } = supabaseAuthApp;

  await expect(page.getByTestId("login-page")).toBeVisible();
  await expect(page.locator(".role-switcher")).toBeHidden();
  await expect(page.getByTestId("create-account-button")).toBeHidden();
  await page.getByTestId("registration-toggle").click();
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
    expect(result).toMatchObject({ success: false, message: "Your account has been created and is awaiting administrator approval. You do not need to register again. You will receive an email when your account is approved." });
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
      birthdate: "2000-01-15",
      password: "password1234"
    })
  );

  expect(result.success).toBe(true);
  expect(result.data.status).toBe("pending");
  const calls = await supabaseAuthApp.calls();
  expect(calls.find(call => call.operation === "signUp")?.credentials.options.data).toEqual({
    slate_pending_registration: {
      firstName: "New",
      lastName: "Umpire",
      phone: "5550102222",
      birthdate: "2000-01-15"
    }
  });
  expect(calls.find(call => call.operation === "signUp")?.credentials.options.emailRedirectTo).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
  expect(calls.find(call => call.name === "provision_public_pending_umpire")?.args).toEqual({
    p_first_name: "New",
    p_last_name: "Umpire",
    p_phone: "5550102222",
    p_birthdate: "2000-01-15"
  });
});

test.describe("email-confirmed registration", () => {
  test.use({ supabaseScenario: { signUpRequiresConfirmation: true, profileMissingUntilProvision: true } });

  test("provisions the pending profile on first verified login", async ({ supabaseAuthApp }) => {
    const registration = await supabaseAuthApp.page.evaluate(() =>
      accountService.registerAuthenticatedAccount({
        firstName: "Verified",
        lastName: "Umpire",
        email: "verified@example.com",
        phone: "5550103333",
        birthdate: "2000-01-15",
        password: "password1234"
      })
    );
    expect(registration).toMatchObject({ success: true, data: { verificationRequired: true } });

    const login = await supabaseAuthApp.page.evaluate(() =>
      loginService.loginWithPassword("verified@example.com", "password1234")
    );
    expect(login).toMatchObject({ success: false, message: "Your account has been created and is awaiting administrator approval. You do not need to register again. You will receive an email when your account is approved." });
    const calls = await supabaseAuthApp.calls();
    expect(calls.find(call => call.name === "provision_public_pending_umpire")?.args).toEqual({
      p_first_name: "Verified",
      p_last_name: "Umpire",
      p_phone: "5550103333",
      p_birthdate: "2000-01-15"
    });
    expect(calls.some(call => call.operation === "updateUser" && call.attributes.data.slate_pending_registration === null)).toBe(true);
  });

  test("successful submission explains the login flow and clears every registration field", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    await page.getByTestId("registration-toggle").click();
    await page.getByTestId("account-first-name").fill("Verified");
    await page.getByTestId("account-last-name").fill("Umpire");
    await page.getByTestId("account-email").fill("verified@example.com");
    await page.getByTestId("account-phone").fill("5550103333");
    await page.getByTestId("account-birthdate").fill("2000-01-15");
    await page.getByTestId("account-password").fill("password1234");
    await page.getByTestId("create-account-button").click();

    await expect(page.getByTestId("account-registration-message")).toHaveText(
      "Check your email to verify your account, then return to the login page and sign in."
    );
    for (const id of ["account-first-name", "account-last-name", "account-email", "account-phone", "account-birthdate", "account-password"]) {
      await expect(page.getByTestId(id)).toHaveValue("");
    }

    await page.reload();
    await expect(page.getByTestId("account-password")).toHaveValue("");
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
      },
      pendingProfiles: [{
        id: "profile-umpire-1", auth_user_id: "auth-umpire-pending", organization_id: "organization-1",
        first_name: "Pending", last_name: "Umpire", email: "pending@example.com", phone: "",
        role: "umpire", status: "pending", communication_preferences: {}, created_at: "2026-08-01T00:00:00.000Z"
      }],
      crewMembers: [{
        id: "crew-umpire-1", organization_id: "organization-1", profile_id: null,
        first_name: "Pending", last_name: "Umpire", email: "pending@example.com", phone: "",
        active: true, eligible_levels: ["12U"], preferences: {}, notes: ""
      }]
    }
  });

test("accountService owns transactional one-click approval while invitation compatibility remains", async ({ supabaseAuthApp }) => {
  const results = await supabaseAuthApp.page.evaluate(async () => ({
    invitation: await accountService.createRegistrationInvitation(
      "M2B-INVITATION-CODE",
      "2026-09-01T00:00:00.000Z",
      1
    ),
    approval: await accountService.approveAuthenticatedAccount("profile-umpire-1")
  }));

  expect(results.invitation.success).toBe(true);
  expect(results.approval.success).toBe(true);
  expect(results.approval.data).toMatchObject({ id: "profile-umpire-1", status: "approved" });
  expect(await supabaseAuthApp.page.evaluate(() => window.__supabaseFixture.settings.crewMembers.find(member => member.id === "crew-umpire-1")?.profile_id)).toBe("profile-umpire-1");
  const calls = await supabaseAuthApp.calls();
  expect(calls.some(call => call.name === "create_umpire_invitation")).toBe(true);
  expect(calls.some(call => call.name === "approve_pending_umpire")).toBe(true);
});

test("hosted crew creation uses the trusted organization-scoped RPC", async ({ supabaseAuthApp }) => {
  const result = await supabaseAuthApp.page.evaluate(() => crewService.create({
    firstName: "Production",
    lastName: "Umpire",
    email: "production@example.com",
    phone: "5550104444",
    levels: ["8U"],
    active: true
  }));
  expect(result.success).toBe(true);
  const creation = (await supabaseAuthApp.calls()).find(call => call.name === "create_crew_member");
  expect(creation?.args).toMatchObject({
    p_first_name: "Production",
    p_last_name: "Umpire",
    p_email: "production@example.com"
  });
  expect(creation?.args).not.toHaveProperty("organization_id");
});

test("hosted pending approval is one click and automatically matches Crew by verified email", async ({ supabaseAuthApp }) => {
  const { page } = supabaseAuthApp;
  await page.evaluate(() => renderPage("accounts"));
  await expect(page.getByTestId("pending-crew-select-profile-umpire-1")).toHaveCount(0);
  await page.getByTestId("approve-account-profile-umpire-1").click();
  await expect(page.getByTestId("pending-accounts-empty")).toBeVisible();
  const approval = (await supabaseAuthApp.calls()).find(call => call.name === "approve_pending_umpire");
  expect(approval?.args).toEqual({ p_target_profile_id: "profile-umpire-1" });
});

test("hosted settings create an organization-scoped complex and field", async ({ supabaseAuthApp }) => {
  const { page } = supabaseAuthApp;
  await page.evaluate(async () => {
    await locationService.loadSharedLocations();
    renderPage("settings");
  });
  await page.getByTestId("add-location-complex").click();
  await page.getByTestId("location-entry-name").fill("Internal Smoke Complex");
  await page.getByTestId("location-entry-form").getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("settings-locations")).toContainText("Internal Smoke Complex");
  await page.getByTestId("settings-locations").getByRole("button", { name: "Add Field" }).click();
  await page.getByTestId("location-entry-name").fill("Field 1");
  await page.getByTestId("location-entry-form").getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("settings-locations")).toContainText("Field 1");
  const calls = await supabaseAuthApp.calls();
  expect(calls.some(call => call.name === "create_location_complex")).toBe(true);
  expect(calls.some(call => call.name === "create_location_field")).toBe(true);
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
