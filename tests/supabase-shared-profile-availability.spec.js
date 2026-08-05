import { test, expect } from "./fixtures/supabase-auth.fixture.js";

test("shared hydration maps profile, crew, and availability without local business data", async ({ supabaseAuthApp }) => {
  const { page } = supabaseAuthApp;
  await page.evaluate(() => {
    localStorage.setItem("bluecrew_accounts", JSON.stringify([{ id: "stale-account", email: "stale@example.com" }]));
    localStorage.setItem("bluecrew-crew-v2", JSON.stringify([{ id: "stale-crew", firstName: "Stale" }]));
  });

  const result = await page.evaluate(async () => {
    const login = await loginService.loginWithPassword("linked@example.com", "password1234");
    return {
      login,
      profile: accountService.getProfile(login.data.id),
      crew: crewService.getAll(),
      localAccounts: JSON.parse(localStorage.getItem("bluecrew_accounts")),
      localCrew: JSON.parse(localStorage.getItem("bluecrew-crew-v2"))
    };
  });

  expect(result.login.success).toBe(true);
  expect(result.profile).toMatchObject({ id: "profile-umpire-1", firstName: "Linked", crewId: "crew-umpire-1" });
  expect(result.crew).toHaveLength(1);
  expect(result.crew[0]).toMatchObject({ id: "crew-umpire-1", profileId: "profile-umpire-1", levels: ["12U"] });
  expect(result.localAccounts[0].id).toBe("stale-account");
  expect(result.localCrew[0].id).toBe("stale-crew");
});

test("profile and availability mutations remain service-owned in Supabase mode", async ({ supabaseAuthApp }) => {
  const result = await supabaseAuthApp.page.evaluate(async () => {
    await loginService.loginWithPassword("linked@example.com", "password1234");
    const profile = await accountService.updateAuthenticatedProfile("profile-umpire-1", {
      email: "linked@example.com",
      phone: "5550102222",
      homePhone: "",
      address: "12 Shared Lane",
      contactPreference: "text",
      emergencyContact: "Parent",
      emergencyContactPhone: "5550103333"
    });
    const availability = await availabilityService.setAvailabilityShared({
      crewId: "crew-umpire-1",
      date: "2026-08-15",
      status: "available",
      startTime: "09:00",
      endTime: "12:00"
    });
    return { profile, availability, current: loginService.getCurrentAccount() };
  });

  expect(result.profile).toMatchObject({ success: true, data: { email: "linked@example.com", address: "12 Shared Lane" } });
  expect(result.current.email).toBe("linked@example.com");
  expect(result.availability).toMatchObject({ date: "2026-08-15", status: "available", startTime: "09:00", endTime: "12:00" });
});

test("Supabase self-service rejects changes to the verified login email", async ({ supabaseAuthApp }) => {
  const result = await supabaseAuthApp.page.evaluate(async () => {
    await loginService.loginWithPassword("linked@example.com", "password1234");
    return accountService.updateAuthenticatedProfile("profile-umpire-1", { email: "different@example.com" });
  });
  expect(result).toMatchObject({ success: false, errors: { email: "Use your current verified login email." } });
  expect((await supabaseAuthApp.calls()).filter(call => call.table === "profiles" && call.operation === "update")).toHaveLength(0);
});

test.describe("transactional range failure", () => {
  test.use({ supabaseScenario: { failedRpc: "set_own_availability_range", availability: [{ id: "existing", organization_id: "organization-1", crew_member_id: "crew-umpire-1", availability_date: "2026-08-15", status: "maybe", starts_at: null, ends_at: null }] } });

  test("returns the RPC error without partial snapshot or local writes", async ({ supabaseAuthApp }) => {
    const result = await supabaseAuthApp.page.evaluate(async () => {
      await loginService.loginWithPassword("linked@example.com", "password1234");
      const before = availabilityService.getCrewAvailability("crew-umpire-1");
      const mutation = await availabilityService.setAvailabilityRangeShared({ crewId: "crew-umpire-1", startDate: "2026-08-15", endDate: "2026-08-17", status: "available" });
      return { before, mutation, after: availabilityService.getCrewAvailability("crew-umpire-1"), local: localStorage.getItem("bluecrew-crew-v2") };
    });
    expect(result.mutation).toMatchObject({ success: false, message: "Transactional write failed" });
    expect(result.after).toEqual(result.before);
    expect(result.local).toBeNull();
  });
});

test.describe("transactional copy failure", () => {
  test.use({ supabaseScenario: { failedRpc: "copy_own_availability_week", availability: [{ id: "target-existing", organization_id: "organization-1", crew_member_id: "crew-umpire-1", availability_date: "2026-08-22", status: "unavailable", starts_at: null, ends_at: null }] } });

  test("returns the RPC error without replacing the hydrated target week", async ({ supabaseAuthApp }) => {
    const result = await supabaseAuthApp.page.evaluate(async () => {
      await loginService.loginWithPassword("linked@example.com", "password1234");
      const before = availabilityService.getCrewAvailability("crew-umpire-1");
      const mutation = await availabilityService.copyAvailabilityWeekShared({ crewId: "crew-umpire-1", sourceStartDate: "2026-08-15", targetStartDate: "2026-08-22" });
      return { before, mutation, after: availabilityService.getCrewAvailability("crew-umpire-1"), local: localStorage.getItem("bluecrew-crew-v2") };
    });
    expect(result.mutation).toMatchObject({ success: false, message: "Transactional write failed" });
    expect(result.after).toEqual(result.before);
    expect(result.local).toBeNull();
  });
});

test.describe("missing crew linkage", () => {
  test.use({ supabaseScenario: { crewId: null, profile: { id: "profile-admin-2", auth_user_id: "auth-admin-2", organization_id: "organization-1", first_name: "Admin", last_name: "Only", email: "admin2@example.com", role: "administrator", status: "approved", communication_preferences: {} } } });

  test("prevents availability mutation", async ({ supabaseAuthApp }) => {
    const result = await supabaseAuthApp.page.evaluate(async () => {
      await loginService.loginWithPassword("admin2@example.com", "password1234");
      return availabilityService.setAvailabilityShared({ crewId: "another-crew", date: "2026-08-15", status: "available" });
    });
    expect(result).toBeNull();
  });
});

test("session expiry clears all authenticated shared snapshots", async ({ supabaseAuthApp }) => {
  const result = await supabaseAuthApp.page.evaluate(async () => {
    await loginService.loginWithPassword("linked@example.com", "password1234");
    window.__bluecrewAuthCallback("SIGNED_OUT", null);
    await new Promise(resolve => setTimeout(resolve, 20));
    return {
      account: loginService.getCurrentAccount(),
      profile: accountService.getAuthenticatedProfile(),
      crew: crewService.getAuthenticatedCrewMember(),
      availability: availabilityService.getCrewAvailability("crew-umpire-1")
    };
  });
  expect(result).toEqual({ account: null, profile: null, crew: null, availability: [] });
});

test.describe("remote hydration denial", () => {
  test.use({ supabaseScenario: { deniedTable: "availability" } });

  test("fails closed without exposing local profile or crew state", async ({ supabaseAuthApp }) => {
    const result = await supabaseAuthApp.page.evaluate(async () => {
      localStorage.setItem("bluecrew_accounts", JSON.stringify([{ id: "stale-account" }]));
      localStorage.setItem("bluecrew-crew-v2", JSON.stringify([{ id: "stale-crew" }]));
      const login = await loginService.loginWithPassword("linked@example.com", "password1234");
      return {
        login,
        account: loginService.getCurrentAccount(),
        profile: accountService.getAuthenticatedProfile(),
        crew: crewService.getAll(),
        hydration: supabaseAuthService.getHydrationState()
      };
    });
    expect(result.login.success).toBe(false);
    expect(result.account).toBeNull();
    expect(result.profile).toBeNull();
    expect(result.crew).toEqual([]);
    expect(result.hydration).toMatchObject({ status: "error", message: "RLS denied" });
  });
});
