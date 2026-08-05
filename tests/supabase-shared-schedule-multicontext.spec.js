import { test, expect } from "@playwright/test";

test("administrator and umpire hydrate the same RLS-scoped shared schedule", async ({ browser }) => {
  const orgA = "10000000-0000-4000-8000-000000000001";
  const orgB = "10000000-0000-4000-8000-000000000002";
  const profiles = [
    { id: "profile-admin-a", auth_user_id: "auth-admin-a", organization_id: orgA, first_name: "Shared", last_name: "Admin", email: "admin-a@example.com", role: "administrator", status: "approved", communication_preferences: {} },
    { id: "profile-umpire-a", auth_user_id: "auth-umpire-a", organization_id: orgA, first_name: "Shared", last_name: "Umpire", email: "umpire-a@example.com", role: "umpire", status: "approved", communication_preferences: {} }
  ];
  const crews = [
    { id: "crew-a", organization_id: orgA, profile_id: "profile-umpire-a", first_name: "Shared", last_name: "Umpire", email: "umpire-a@example.com", active: true, eligible_levels: ["12U"], preferences: {} },
    { id: "crew-b", organization_id: orgB, profile_id: "profile-b", first_name: "Other", last_name: "Organization", active: true, eligible_levels: ["12U"], preferences: {} }
  ];
  const locations = [
    { id: "location-a", organization_id: orgA, name: "Shared Complex", active: true },
    { id: "location-b", organization_id: orgB, name: "Hidden Complex", active: true }
  ];
  const fields = [
    { id: "field-a", organization_id: orgA, location_id: "location-a", name: "Field A", active: true },
    { id: "field-b", organization_id: orgB, location_id: "location-b", name: "Hidden Field", active: true }
  ];
  const games = [
    { id: "assigned-a", organization_id: orgA, season_id: "season-a", location_id: "location-a", field_id: "field-a", game_date: "2026-08-20", game_time: "18:00:00", home_team: "Home A", away_team: "Away A", level: "12U", game_type: "single", lifecycle_status: "scheduled", review: {}, report: {}, source_metadata: {} },
    { id: "open-a", organization_id: orgA, season_id: "season-a", location_id: "location-a", field_id: "field-a", game_date: "2026-08-21", game_time: "19:00:00", home_team: "Home Open", away_team: "Away Open", level: "12U", game_type: "single", lifecycle_status: "scheduled", review: {}, report: {}, source_metadata: {} },
    { id: "hidden-b", organization_id: orgB, season_id: "season-b", location_id: "location-b", field_id: "field-b", game_date: "2026-08-22", game_time: "20:00:00", home_team: "Hidden Home", away_team: "Hidden Away", level: "12U", game_type: "single", lifecycle_status: "scheduled", review: {}, report: {}, source_metadata: {} }
  ];
  const assignments = [
    { id: "own-a", organization_id: orgA, game_id: "assigned-a", position: "Plate", status: "assigned", assigned_crew_member_id: "crew-a", locked: false },
    { id: "open-position-a", organization_id: orgA, game_id: "open-a", position: "Plate", status: "open_for_claim", assigned_crew_member_id: null, locked: false },
    { id: "hidden-position-b", organization_id: orgB, game_id: "hidden-b", position: "Plate", status: "open_for_claim", assigned_crew_member_id: null, locked: false }
  ];
  const operations = [];

  async function openSession(authUserId) {
    const profile = profiles.find(item => item.auth_user_id === authUserId);
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.exposeFunction("__scheduleRead", ({ table, mode, ids }) => {
      operations.push({ table, mode, authUserId });
      if (table === "profiles") return { data: profile, error: null };
      if (table === "crew_members" && mode === "single") return { data: crews.find(item => item.profile_id === profile.id) || null, error: null };
      if (table === "crew_members") return { data: crews.filter(item => item.organization_id === profile.organization_id && ids.includes(item.id)), error: null };
      const source = { locations, fields, games, game_assignments: assignments, availability: [] }[table] || [];
      let visible = source.filter(item => item.organization_id === profile.organization_id);
      if (table === "game_assignments" && profile.role === "umpire") visible = visible.filter(item => item.status === "open_for_claim" || item.assigned_crew_member_id === "crew-a");
      return { data: visible, error: null };
    });
    await page.addInitScript(({ authUserId, email }) => {
      window.BLUECREW_SUPABASE_CONFIG = { url: "https://fixture.supabase.co", publishableKey: "sb_publishable_fixture" };
      localStorage.setItem("bluecrew-games-v2", JSON.stringify([{ id: "poison-game" }]));
      localStorage.setItem("bluecrew_location_catalog", JSON.stringify([{ name: "Poison Location", fields: ["Poison Field"] }]));
      const user = { id: authUserId, email };
      function query(table) {
        let selectedIds = [];
        const builder = {
          select() { return builder; }, eq() { return builder; },
          maybeSingle() { return window.__scheduleRead({ table, mode: "single", ids: [] }); },
          order() { return builder; },
          in(column, ids) { selectedIds = ids || []; return builder; },
          then(resolve, reject) { return window.__scheduleRead({ table, mode: "list", ids: selectedIds }).then(resolve, reject); }
        };
        return builder;
      }
      window.BLUECREW_SUPABASE_CLIENT_FACTORY = () => ({
        auth: {
          getSession: async () => ({ data: { session: { user } }, error: null }),
          signOut: async () => ({ error: null }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } })
        },
        from: query
      });
    }, { authUserId, email: profile.email });
    await page.goto("/");
    await expect.poll(() => page.evaluate(() => supabaseAuthService.getHydrationState().status)).toBe("ready");
    return { context, page };
  }

  const admin = await openSession("auth-admin-a");
  const umpire = await openSession("auth-umpire-a");
  const read = page => page.evaluate(() => ({
    locations: locationService.getLocations(),
    games: gameService.getAll().map(game => game.id),
    open: assignmentService.getOpenGames().map(game => game.id),
    mine: portalService.getMySchedule().map(game => game.id),
    storedGames: JSON.parse(localStorage.getItem("bluecrew-games-v2")),
    storedLocations: JSON.parse(localStorage.getItem("bluecrew_location_catalog"))
  }));
  const adminState = await read(admin.page);
  const umpireState = await read(umpire.page);
  expect(adminState.locations).toEqual([{ name: "Shared Complex", fields: ["Field A"] }]);
  expect(umpireState.locations).toEqual(adminState.locations);
  expect(adminState.games).toEqual(["assigned-a", "open-a"]);
  expect(umpireState.games).toEqual(adminState.games);
  expect(adminState.open).toEqual(["open-a"]);
  expect(umpireState.open).toEqual(["open-a"]);
  expect(adminState.mine).toEqual([]);
  expect(umpireState.mine).toEqual(["assigned-a"]);
  expect(umpireState.storedGames).toEqual([{ id: "poison-game" }]);
  expect(umpireState.storedLocations).toEqual([{ name: "Poison Location", fields: ["Poison Field"] }]);

  await umpire.page.reload();
  await expect.poll(() => umpire.page.evaluate(() => supabaseAuthService.getHydrationState().status)).toBe("ready");
  expect(await read(umpire.page)).toMatchObject({ games: ["assigned-a", "open-a"], mine: ["assigned-a"] });
  expect(operations.every(operation => operation.mode === "single" || operation.mode === "list")).toBe(true);

  await admin.context.close();
  await umpire.context.close();
});
