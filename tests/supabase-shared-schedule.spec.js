import { test, expect } from "./fixtures/supabase-auth.fixture.js";

const location = { id: "location-1", organization_id: "organization-1", name: "Central Complex", address: "1 Main St", active: true };
const field = { id: "field-1", organization_id: "organization-1", location_id: "location-1", name: "Field 2", active: true };
const assignedGame = { id: "game-assigned", organization_id: "organization-1", season_id: "season-1", location_id: "location-1", field_id: "field-1", game_date: "2026-08-20", game_time: "18:30:00", home_team: "Hawks", away_team: "Bears", level: "12U", game_type: "single", lifecycle_status: "scheduled", review: {}, report: {}, source_metadata: {} };
const openGame = { ...assignedGame, id: "game-open", game_date: "2026-08-21", home_team: "Lions", away_team: "Tigers" };
const assignments = [
  { id: "assignment-own", organization_id: "organization-1", game_id: "game-assigned", position: "Plate", status: "assigned", assigned_crew_member_id: "crew-umpire-1", locked: false },
  { id: "assignment-open", organization_id: "organization-1", game_id: "game-open", position: "Plate", status: "open_for_claim", assigned_crew_member_id: null, locked: false }
];

test.use({ supabaseScenario: { locations: [location], fields: [field], games: [assignedGame, openGame], assignments } });

test("hydrates service-owned location, game, open-game, dashboard, and My Schedule reads", async ({ supabaseAuthApp }) => {
  const result = await supabaseAuthApp.page.evaluate(async () => {
    localStorage.setItem("bluecrew-games-v2", JSON.stringify([{ id: "poison-game" }]));
    localStorage.setItem("bluecrew_location_catalog", JSON.stringify([{ name: "Poison Complex", fields: ["Poison Field"] }]));
    const login = await loginService.loginWithPassword("linked@example.com", "password1234");
    return {
      login,
      locations: locationService.getLocations(),
      games: gameService.getAll(),
      open: assignmentService.getOpenGames().map(game => game.id),
      mySchedule: portalService.getMySchedule().map(game => game.id),
      dashboard: dashboardService.getUpcomingGames().map(game => game.id),
      storedGames: JSON.parse(localStorage.getItem("bluecrew-games-v2")),
      storedLocations: JSON.parse(localStorage.getItem("bluecrew_location_catalog"))
    };
  });
  expect(result.login.success).toBe(true);
  expect(result.locations).toEqual([{ name: "Central Complex", fields: ["Field 2"] }]);
  expect(result.games).toHaveLength(2);
  expect(result.games[0]).toMatchObject({ id: "game-assigned", date: "2026-08-20", time: "18:30", locationComplex: "Central Complex", locationField: "Field 2", field: "Field 2", venue: "Central Complex" });
  expect(result.open).toEqual(["game-open"]);
  expect(result.mySchedule).toEqual(["game-assigned"]);
  expect(result.dashboard).toEqual(["game-assigned", "game-open"]);
  expect(result.storedGames).toEqual([{ id: "poison-game" }]);
  expect(result.storedLocations).toEqual([{ name: "Poison Complex", fields: ["Poison Field"] }]);
});

test("game lookup preserves hydrated assignment identity without fabricating positions", async ({ supabaseAuthApp }) => {
  const result = await supabaseAuthApp.page.evaluate(async () => {
    await loginService.loginWithPassword("linked@example.com", "password1234");
    const game = gameService.getById("game-assigned");
    return { game, assignments: assignmentService.getAssignments(game) };
  });
  expect(result.game.crewId).toBe("crew-umpire-1");
  expect(result.assignments).toEqual([expect.objectContaining({ id: "assignment-own", crewId: "crew-umpire-1", status: "assigned" })]);
});

test.describe("location hydration denial", () => {
  test.use({ supabaseScenario: { deniedTable: "locations" } });
  test("fails closed and clears scheduling snapshots", async ({ supabaseAuthApp }) => {
    const result = await supabaseAuthApp.page.evaluate(async () => {
      const login = await loginService.loginWithPassword("linked@example.com", "password1234");
      return { login, account: loginService.getCurrentAccount(), locations: locationService.getLocations(), games: gameService.getAll() };
    });
    expect(result.login.success).toBe(false);
    expect(result.account).toMatchObject({ id: "profile-umpire-1", crewId: "crew-umpire-1" });
    expect(result.locations).toEqual([]);
    expect(result.games).toEqual([]);
  });
});

test.describe("game hydration denial", () => {
  test.use({ supabaseScenario: { deniedTable: "games" } });
  test("fails closed without local scheduling fallback", async ({ supabaseAuthApp }) => {
    const result = await supabaseAuthApp.page.evaluate(async () => {
      localStorage.setItem("bluecrew-games-v2", JSON.stringify([{ id: "poison-game" }]));
      const login = await loginService.loginWithPassword("linked@example.com", "password1234");
      return { login, account: loginService.getCurrentAccount(), games: gameService.getAll(), stored: JSON.parse(localStorage.getItem("bluecrew-games-v2")) };
    });
    expect(result.login.success).toBe(false);
    expect(result.account).toMatchObject({ id: "profile-umpire-1", crewId: "crew-umpire-1" });
    expect(result.games).toEqual([]);
    expect(result.stored).toEqual([{ id: "poison-game" }]);
  });
});

test.describe("assignment hydration denial", () => {
  test.use({ supabaseScenario: { deniedTable: "game_assignments" } });
  test("fails the entire schedule hydration boundary", async ({ supabaseAuthApp }) => {
    const result = await supabaseAuthApp.page.evaluate(async () => {
      const login = await loginService.loginWithPassword("linked@example.com", "password1234");
      return { login, games: gameService.getAll(), locations: locationService.getLocations(), account: loginService.getCurrentAccount() };
    });
    expect(result.login.success).toBe(false);
    expect(result.games).toEqual([]);
    expect(result.locations).toEqual([]);
    expect(result.account).toMatchObject({ id: "profile-umpire-1", crewId: "crew-umpire-1" });
  });
});

test.describe("field hydration denial", () => {
  test.use({ supabaseScenario: { deniedTable: "fields" } });
  test("publishes no partial scheduling state and retains identity", async ({ supabaseAuthApp }) => {
    const result = await supabaseAuthApp.page.evaluate(async () => {
      const login = await loginService.loginWithPassword("linked@example.com", "password1234");
      return { login, games: gameService.getAll(), locations: locationService.getLocations(), crew: crewService.getAll(), account: loginService.getCurrentAccount(), hydration: supabaseAuthService.getHydrationState() };
    });
    expect(result.login.success).toBe(false);
    expect(result.games).toEqual([]);
    expect(result.locations).toEqual([]);
    expect(result.crew).toEqual([expect.objectContaining({ id: "crew-umpire-1" })]);
    expect(result.account).toMatchObject({ id: "profile-umpire-1" });
    expect(result.hydration).toMatchObject({ status: "error", authenticated: true });
    expect((await supabaseAuthApp.calls()).some(call => call.operation === "signOut")).toBe(false);
  });
});

test.describe("referenced crew hydration denial", () => {
  test.use({ supabaseScenario: { deniedReferencedCrew: true, locations: [location], fields: [field], games: [assignedGame], assignments: [{ id: "assignment-other", organization_id: "organization-1", game_id: "game-assigned", position: "Plate", status: "assigned", assigned_crew_member_id: "crew-other", locked: false }], crewMembers: [{ id: "crew-other", organization_id: "organization-1", profile_id: "profile-other", first_name: "Other", last_name: "Umpire", active: true, eligible_levels: ["12U"], preferences: {} }] } });
  test("publishes neither referenced crew nor schedule", async ({ supabaseAuthApp }) => {
    const result = await supabaseAuthApp.page.evaluate(async () => {
      const login = await loginService.loginWithPassword("linked@example.com", "password1234");
      return { login, games: gameService.getAll(), locations: locationService.getLocations(), crew: crewService.getAll(), account: loginService.getCurrentAccount() };
    });
    expect(result.login.success).toBe(false);
    expect(result.games).toEqual([]);
    expect(result.locations).toEqual([]);
    expect(result.crew.map(member => member.id)).toEqual(["crew-umpire-1"]);
    expect(result.account).toMatchObject({ id: "profile-umpire-1" });
  });
});

test("shared reads cannot mutate canonical game, crew, or location snapshots", async ({ supabaseAuthApp }) => {
  const result = await supabaseAuthApp.page.evaluate(async () => {
    await loginService.loginWithPassword("linked@example.com", "password1234");
    const games = gameService.getAll();
    const crew = crewService.getAll();
    const locations = locationService.getLocations();
    games[0].homeTeam = "Mutated";
    games[0].assignments[0].status = "locked";
    crew[0].firstName = "Mutated";
    locations[0].name = "Mutated";
    return { game: gameService.getAll()[0], crew: crewService.getAll()[0], location: locationService.getLocations()[0] };
  });
  expect(result.game).toMatchObject({ homeTeam: "Hawks", assignments: [expect.objectContaining({ status: "assigned" })] });
  expect(result.crew.firstName).toBe("Linked");
  expect(result.location.name).toBe("Central Complex");
});

test("a failed schedule refresh retains the established identity and clears the prior schedule atomically", async ({ supabaseAuthApp }) => {
  const result = await supabaseAuthApp.page.evaluate(async () => {
    await loginService.loginWithPassword("linked@example.com", "password1234");
    const beforeAccountId = loginService.getCurrentAccount().id;
    window.__supabaseFixture.settings.deniedTable = "games";
    try {
      await supabaseAuthService.loadAccountForUser({ id: "auth-umpire-1", email: "linked@example.com" });
    } catch (_) {}
    return {
      beforeAccountId,
      account: loginService.getCurrentAccount(),
      locations: locationService.getLocations(),
      games: gameService.getAll(),
      crewIds: crewService.getAll().map(member => member.id),
      hydration: supabaseAuthService.getHydrationState()
    };
  });
  expect(result.account.id).toBe(result.beforeAccountId);
  expect(result.locations).toEqual([]);
  expect(result.games).toEqual([]);
  expect(result.crewIds).toEqual(["crew-umpire-1"]);
  expect(result.hydration).toMatchObject({ status: "error", authenticated: true });
});

test.describe("deterministic mapping", () => {
  test.use({ supabaseScenario: {
    locations: [location, { id: "location-2", organization_id: "organization-1", name: "Other Complex", active: true }],
    fields: [field, { id: "foreign-field", organization_id: "organization-1", location_id: "location-2", name: "Wrong Field", active: true }],
    games: [{ ...assignedGame, id: "game-z", field_id: "foreign-field" }, { ...assignedGame, id: "game-a" }],
    assignments: [
      { id: "assignment-z", organization_id: "organization-1", game_id: "game-a", position: "Plate", status: "assigned", assigned_crew_member_id: "crew-z", locked: false },
      { id: "assignment-a", organization_id: "organization-1", game_id: "game-a", position: "Plate", status: "assigned", assigned_crew_member_id: "crew-a", locked: false }
    ],
    crewMembers: [
      { id: "crew-z", organization_id: "organization-1", first_name: "Zed", last_name: "Same", active: true, eligible_levels: [], preferences: {} },
      { id: "crew-a", organization_id: "organization-1", first_name: "Alpha", last_name: "Same", active: true, eligible_levels: [], preferences: {} }
    ]
  } });
  test("stably orders games and assignments and rejects a mismatched field relationship", async ({ supabaseAuthApp }) => {
    const result = await supabaseAuthApp.page.evaluate(async () => {
      await loginService.loginWithPassword("linked@example.com", "password1234");
      return { games: gameService.getAll(), crew: crewService.getAll().map(member => member.id) };
    });
    expect(result.games.map(game => game.id)).toEqual(["game-a", "game-z"]);
    expect(result.games[0].assignments.map(item => item.id)).toEqual(["assignment-a", "assignment-z"]);
    expect(result.games[0].crewId).toBe("crew-a");
    expect(result.games[1]).toMatchObject({ locationComplex: "Central Complex", locationField: "", field: "" });
    expect(result.crew).toEqual(["crew-umpire-1", "crew-a", "crew-z"]);
  });
});

test("new repository reads use explicit projections and deterministic ordering without organization input", async ({ supabaseAuthApp }) => {
  await supabaseAuthApp.page.evaluate(() => loginService.loginWithPassword("linked@example.com", "password1234"));
  const calls = await supabaseAuthApp.calls();
  const newTables = ["locations", "fields", "games", "game_assignments", "assignment_claims"];
  for (const table of newTables) {
    const projection = calls.find(call => call.operation === "selectColumns" && call.table === table)?.columns;
    expect(projection).toBeTruthy();
    expect(projection).not.toBe("*");
    expect(projection).not.toContain("organization_id=");
  }
  expect(calls.filter(call => call.operation === "order" && call.table === "games").map(call => call.column)).toEqual(["game_date", "game_time", "id"]);
  expect(calls.filter(call => call.operation === "order" && call.table === "game_assignments").map(call => call.column)).toEqual(["game_id", "position", "id"]);
  expect(calls.filter(call => call.operation === "order" && call.table === "assignment_claims").map(call => call.column)).toEqual(["assignment_id", "claimed_at", "id"]);
  const source = await supabaseAuthApp.page.evaluate(() => [
    supabaseSharedRepository.getLocations,
    supabaseSharedRepository.getFields,
    supabaseSharedRepository.getGames,
    supabaseSharedRepository.getGameAssignments,
    supabaseSharedRepository.getAssignmentClaims,
    supabaseSharedRepository.getCrewMembersByIds
  ].map(method => method.toString()).join("\n"));
  expect(source).not.toContain('.eq("organization_id"');
  expect(source).not.toContain("p_organization");
});

test("session expiry clears hydrated schedule and locations", async ({ supabaseAuthApp }) => {
  const result = await supabaseAuthApp.page.evaluate(async () => {
    await loginService.loginWithPassword("linked@example.com", "password1234");
    window.__bluecrewAuthCallback("SIGNED_OUT", null);
    await new Promise(resolve => setTimeout(resolve, 20));
    return { locations: locationService.getLocations(), games: gameService.getAll(), account: loginService.getCurrentAccount() };
  });
  expect(result).toEqual({ locations: [], games: [], account: null });
});

test.describe("manager without linked crew", () => {
  test.use({ supabaseScenario: { crewId: null, locations: [location], fields: [field], games: [assignedGame, openGame], assignments, profile: { id: "profile-admin", auth_user_id: "auth-admin", organization_id: "organization-1", first_name: "Schedule", last_name: "Admin", email: "schedule-admin@example.com", role: "administrator", status: "approved", communication_preferences: {} } } });
  test("hydrates schedule while My Schedule remains empty", async ({ supabaseAuthApp }) => {
    const result = await supabaseAuthApp.page.evaluate(async () => {
      await loginService.loginWithPassword("schedule-admin@example.com", "password1234");
      return { games: gameService.getAll().length, mySchedule: portalService.getMySchedule() };
    });
    expect(result.games).toBe(2);
    expect(result.mySchedule).toEqual([]);
  });
});
