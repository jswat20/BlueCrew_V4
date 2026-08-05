import { test, expect } from "@playwright/test";

test("profile and availability are shared across independent authenticated contexts", async ({ browser }) => {
  const backend = {
    profile: { id: "11111111-1111-4111-8111-111111111111", auth_user_id: "22222222-2222-4222-8222-222222222222", organization_id: "33333333-3333-4333-8333-333333333333", first_name: "Shared", last_name: "Umpire", email: "shared@example.com", phone: "5550101000", role: "umpire", status: "approved", communication_preferences: {} },
    crew: { id: "44444444-4444-4444-8444-444444444444", organization_id: "33333333-3333-4333-8333-333333333333", profile_id: "11111111-1111-4111-8111-111111111111", first_name: "Shared", last_name: "Umpire", email: "shared@example.com", phone: "5550101000", active: true, eligible_levels: ["12U"], preferences: {} },
    availability: [
      { id: "cross-org-row", organization_id: "99999999-9999-4999-8999-999999999999", crew_member_id: "other-crew", availability_date: "2026-08-20", status: "unavailable", starts_at: null, ends_at: null }
    ]
  };

  async function openSession() {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.exposeFunction("__bluecrewSharedQuery", ({ table, operation, payload }) => {
      if (table === "profiles") {
        if (operation === "update") backend.profile = { ...backend.profile, ...payload };
        return { data: backend.profile, error: null };
      }
      if (table === "crew_members") return { data: backend.crew, error: null };
      if (table === "availability") {
        if (operation === "upsert") {
          const row = { id: `availability-${backend.availability.length}`, ...payload };
          backend.availability = backend.availability.filter(item => !(item.organization_id === row.organization_id && item.crew_member_id === row.crew_member_id && item.availability_date === row.availability_date && item.starts_at === row.starts_at && item.ends_at === row.ends_at));
          backend.availability.push(row);
          return { data: row, error: null };
        }
        return { data: backend.availability.filter(item => item.organization_id === backend.crew.organization_id && item.crew_member_id === backend.crew.id), error: null };
      }
      return { data: null, error: null };
    });
    await page.addInitScript(() => {
      window.BLUECREW_SUPABASE_CONFIG = { url: "https://fixture.supabase.co", publishableKey: "sb_publishable_fixture" };
      localStorage.setItem("bluecrew_accounts", JSON.stringify([{ id: "local-profile-must-not-leak" }]));
      localStorage.setItem("bluecrew-crew-v2", JSON.stringify([{ id: "local-crew-must-not-leak", dateAvailability: { "2026-08-20": "maybe" } }]));
      const user = { id: "22222222-2222-4222-8222-222222222222", email: "shared@example.com" };
      function query(table) {
        let operation = "select";
        let payload = null;
        const builder = {
          select() { return builder; }, eq() { return builder; },
          update(value) { operation = "update"; payload = value; return builder; },
          upsert(value) { operation = "upsert"; payload = value; return builder; },
          delete() { operation = "delete"; return builder; },
          maybeSingle() { return window.__bluecrewSharedQuery({ table, operation, payload }); },
          single() { return window.__bluecrewSharedQuery({ table, operation, payload }); },
          order() { return window.__bluecrewSharedQuery({ table, operation, payload }); },
          then(resolve, reject) { return window.__bluecrewSharedQuery({ table, operation, payload }).then(resolve, reject); }
        };
        return builder;
      }
      const client = {
        auth: {
          getSession: async () => ({ data: { session: { user } }, error: null }),
          signOut: async () => ({ error: null }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } })
        },
        from: query,
        rpc: async (name, args) => {
          if (name !== "upsert_own_availability") return { data: null, error: { message: `Unexpected RPC: ${name}` } };
          return window.__bluecrewSharedQuery({ table: "availability", operation: "upsert", payload: { organization_id: "33333333-3333-4333-8333-333333333333", crew_member_id: "44444444-4444-4444-8444-444444444444", availability_date: args.p_availability_date, status: args.p_status, starts_at: args.p_starts_at, ends_at: args.p_ends_at } });
        }
      };
      window.BLUECREW_SUPABASE_CLIENT_FACTORY = () => client;
    });
    await page.goto("/");
    await expect.poll(() => page.evaluate(() => supabaseAuthService.getHydrationState().status)).toBe("ready");
    return { context, page };
  }

  const first = await openSession();
  await first.page.evaluate(async () => {
    await accountService.updateAuthenticatedProfile(loginService.getCurrentAccount().id, { email: "shared@example.com", phone: "5550102222", homePhone: "", address: "Shared across devices", contactPreference: "text", emergencyContact: "", emergencyContactPhone: "" });
    await availabilityService.setAvailabilityShared({ crewId: authService.currentCrewId(), date: "2026-08-20", status: "available", startTime: "10:00", endTime: "13:00" });
  });

  const second = await openSession();
  const observed = await second.page.evaluate(() => ({
    profile: accountService.getProfile(loginService.getCurrentAccount().id),
    availability: availabilityService.getCrewAvailability(authService.currentCrewId()),
    crew: crewService.getAll(),
    localProfile: JSON.parse(localStorage.getItem("bluecrew_accounts"))[0].id
  }));
  expect(observed.profile).toMatchObject({ email: "shared@example.com", phone: "(555) 010-2222", address: "Shared across devices" });
  expect(observed.availability).toEqual([expect.objectContaining({ date: "2026-08-20", status: "available", startTime: "10:00", endTime: "13:00" })]);
  expect(observed.crew.map(item => item.id)).toEqual([backend.crew.id]);
  expect(observed.localProfile).toBe("local-profile-must-not-leak");

  await first.context.close();
  await second.context.close();
});
