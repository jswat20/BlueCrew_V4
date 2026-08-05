import { test, expect } from "@playwright/test";
import { test as fixtureTest, expect as fixtureExpect } from "./fixtures/supabase-auth.fixture.js";

const organizationId = "10000000-0000-4000-8000-000000000001";
const gameId = "70000000-0000-4000-8000-000000000001";
const assignmentId = "80000000-0000-4000-8000-000000000001";

function sharedRows() {
  return {
    profiles: [
      { id: "40000000-0000-4000-8000-000000000001", auth_user_id: "30000000-0000-4000-8000-000000000001", organization_id: organizationId, first_name: "Ada", last_name: "Admin", email: "admin@example.com", role: "administrator", status: "approved", communication_preferences: {} },
      { id: "40000000-0000-4000-8000-000000000002", auth_user_id: "30000000-0000-4000-8000-000000000002", organization_id: organizationId, first_name: "Uma", last_name: "Umpire", email: "umpire@example.com", role: "umpire", status: "approved", communication_preferences: {} },
      { id: "40000000-0000-4000-8000-000000000003", auth_user_id: "30000000-0000-4000-8000-000000000003", organization_id: organizationId, first_name: "Ivy", last_name: "Umpire", email: "umpire2@example.com", role: "umpire", status: "approved", communication_preferences: {} }
    ],
    crews: [
      { id: "50000000-0000-4000-8000-000000000002", organization_id: organizationId, profile_id: "40000000-0000-4000-8000-000000000002", first_name: "Uma", last_name: "Umpire", email: "umpire@example.com", active: true, eligible_levels: ["12U"], preferences: {} },
      { id: "50000000-0000-4000-8000-000000000003", organization_id: organizationId, profile_id: "40000000-0000-4000-8000-000000000003", first_name: "Ivy", last_name: "Umpire", email: "umpire2@example.com", active: true, eligible_levels: ["12U"], preferences: {} }
    ],
    locations: [{ id: "60000000-0000-4000-8000-000000000001", organization_id: organizationId, name: "Fall Complex", active: true }],
    fields: [{ id: "61000000-0000-4000-8000-000000000001", organization_id: organizationId, location_id: "60000000-0000-4000-8000-000000000001", name: "Field 1", active: true }],
    games: [{ id: gameId, organization_id: organizationId, season_id: "20000000-0000-4000-8000-000000000001", location_id: "60000000-0000-4000-8000-000000000001", field_id: "61000000-0000-4000-8000-000000000001", game_date: "2099-08-20", game_time: "18:00:00", home_team: "Home", away_team: "Away", level: "12U", game_type: "single", lifecycle_status: "scheduled", review: {}, report: {}, source_metadata: {} }],
    assignments: [{ id: assignmentId, organization_id: organizationId, game_id: gameId, position: "Plate", status: "open_for_claim", assigned_crew_member_id: null, locked: false }],
    claims: []
  };
}

async function openSharedSession(browser, rows, authUserId) {
  const profile = rows.profiles.find(item => item.auth_user_id === authUserId);
  const crew = rows.crews.find(item => item.profile_id === profile.id) || null;
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.exposeFunction("__claimRead", ({ table, mode, ids }) => {
    if (table === "profiles") return { data: profile, error: null };
    if (table === "crew_members" && mode === "single") return { data: crew, error: null };
    if (table === "crew_members") return { data: rows.crews.filter(item => ids.includes(item.id)), error: null };
    if (table === "availability") return { data: [], error: null };
    let data = ({ locations: rows.locations, fields: rows.fields, games: rows.games, game_assignments: rows.assignments, assignment_claims: rows.claims }[table] || []);
    if (table === "game_assignments" && profile.role === "umpire") {
      const ownClaimAssignments = rows.claims.filter(item => item.claimant_crew_member_id === crew?.id).map(item => item.assignment_id);
      data = data.filter(item => item.status === "open_for_claim" || item.assigned_crew_member_id === crew?.id || ownClaimAssignments.includes(item.id));
    }
    if (table === "assignment_claims" && profile.role === "umpire") data = data.filter(item => item.claimant_crew_member_id === crew?.id);
    return { data: structuredClone(data), error: null };
  });

  await page.exposeFunction("__claimRpc", ({ name, args }) => {
    const assignment = rows.assignments.find(item => item.id === args.p_assignment_id);
    if (name === "submit_assignment_claim") {
      if (!crew || !assignment || assignment.status !== "open_for_claim" || assignment.locked) return { data: null, error: { message: "assignment_already_claimed" } };
      const claim = { id: `90000000-0000-4000-8000-${String(rows.claims.length + 1).padStart(12, "0")}`, organization_id: organizationId, assignment_id: assignment.id, claimant_crew_member_id: crew.id, status: "pending", claimed_at: new Date().toISOString(), decided_at: null };
      rows.claims.push(claim);
      assignment.status = "pending_approval";
      return { data: structuredClone(claim), error: null };
    }
    if (name === "decide_assignment_claim") {
      const claim = rows.claims.find(item => item.assignment_id === assignment?.id && item.status === "pending");
      if (profile.role !== "administrator" || !assignment || assignment.status !== "pending_approval" || !claim) return { data: null, error: { message: "claim_no_longer_pending" } };
      claim.status = args.p_decision;
      claim.decided_at = new Date().toISOString();
      if (args.p_decision === "approved") {
        assignment.status = "assigned";
        assignment.assigned_crew_member_id = claim.claimant_crew_member_id;
      } else {
        assignment.status = "open_for_claim";
        assignment.assigned_crew_member_id = null;
      }
      return { data: structuredClone(assignment), error: null };
    }
    return { data: null, error: { message: `Unexpected RPC: ${name}` } };
  });

  await page.addInitScript(({ user, sessionKey }) => {
    window.BLUECREW_SUPABASE_CONFIG = { url: "https://fixture.supabase.co", publishableKey: "sb_publishable_fixture" };
    function query(table) {
      let ids = [];
      const builder = {
        select() { return builder; }, eq() { return builder; }, order() { return builder; },
        in(column, values) { ids = values || []; return builder; },
        maybeSingle() { return window.__claimRead({ table, mode: "single", ids: [] }); },
        then(resolve, reject) { return window.__claimRead({ table, mode: "list", ids }).then(resolve, reject); }
      };
      return builder;
    }
    window.BLUECREW_SUPABASE_CLIENT_FACTORY = () => ({
      auth: {
        getSession: async () => ({ data: { session: localStorage.getItem(sessionKey) ? { user } : null }, error: null }),
        signInWithPassword: async () => { localStorage.setItem(sessionKey, "1"); return { data: { user, session: { user } }, error: null }; },
        signOut: async () => { localStorage.removeItem(sessionKey); return { error: null }; },
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } })
      },
      from: query,
      rpc: (name, args) => window.__claimRpc({ name, args })
    });
  }, { user: { id: profile.auth_user_id, email: profile.email }, sessionKey: `claim-session-${profile.id}` });

  await page.goto("/");
  const login = await page.evaluate(({ email }) => loginService.loginWithPassword(email, "password1234"), { email: profile.email });
  expect(login.success).toBe(true);
  return { context, page };
}

test("umpire claim persists across contexts, administrator approves, and refresh updates My Schedule", async ({ browser }) => {
  const rows = sharedRows();
  const umpire = await openSharedSession(browser, rows, rows.profiles[1].auth_user_id);
  await umpire.page.evaluate(() => renderPage("claim-games"));
  await expect(umpire.page.getByTestId(`claim-game-${gameId}`)).toBeVisible();
  await umpire.page.getByTestId(`claim-game-${gameId}`).click();
  await expect.poll(() => rows.claims.length).toBe(1);
  expect(rows.assignments[0].status).toBe("pending_approval");

  const admin = await openSharedSession(browser, rows, rows.profiles[0].auth_user_id);
  const pending = await admin.page.evaluate(() => claimsQueueService.getPendingClaims());
  expect(pending).toHaveLength(1);
  await admin.page.evaluate(() => renderPage("claims-queue"));
  await expect(admin.page.getByTestId(`approve-claim-${assignmentId}`)).toBeVisible();
  await admin.page.getByTestId(`approve-claim-${assignmentId}`).click();
  await expect.poll(() => rows.assignments[0].status).toBe("assigned");

  await umpire.page.reload();
  await expect.poll(() => umpire.page.evaluate(() => supabaseAuthService.getHydrationState().status)).toBe("ready");
  const finalState = await umpire.page.evaluate(() => ({
    available: portalService.getClaimableGames().map(game => game.id),
    mine: portalService.getMySchedule().map(game => game.id)
  }));
  expect(finalState.available).not.toContain(gameId);
  expect(finalState.mine).toContain(gameId);

  await admin.context.close();
  await umpire.context.close();
});

test("two umpires claiming concurrently produce one persisted winner and one friendly failure", async ({ browser }) => {
  const rows = sharedRows();
  const first = await openSharedSession(browser, rows, rows.profiles[1].auth_user_id);
  const second = await openSharedSession(browser, rows, rows.profiles[2].auth_user_id);
  const [left, right] = await Promise.all([
    first.page.evaluate(gameId => portalService.claimGame(gameId), gameId),
    second.page.evaluate(gameId => portalService.claimGame(gameId), gameId)
  ]);
  expect([left.success, right.success].sort()).toEqual([false, true]);
  expect([left, right].find(result => !result.success).message).toBe("This assignment has already been claimed by another official.");
  expect(rows.claims).toHaveLength(1);
  expect(rows.assignments[0].status).toBe("pending_approval");
  await first.context.close();
  await second.context.close();
});

fixtureTest.describe("shared claim failures", () => {
  const location = { id: "location-1", organization_id: "organization-1", name: "Complex", active: true };
  const field = { id: "field-1", organization_id: "organization-1", location_id: "location-1", name: "Field", active: true };
  const game = { id: "game-1", organization_id: "organization-1", season_id: "season-1", location_id: "location-1", field_id: "field-1", game_date: "2099-08-20", game_time: "18:00:00", home_team: "Home", away_team: "Away", level: "12U", game_type: "single", lifecycle_status: "scheduled", review: {}, report: {}, source_metadata: {} };
  const assignment = { id: "assignment-1", organization_id: "organization-1", game_id: "game-1", position: "Plate", status: "open_for_claim", assigned_crew_member_id: null, locked: false };

  fixtureTest.use({ supabaseScenario: { locations: [location], fields: [field], games: [game], assignments: [assignment], failedRpc: "submit_assignment_claim" } });
  fixtureTest("claim insert failure retains identity and published schedule", async ({ supabaseAuthApp }) => {
    const result = await supabaseAuthApp.page.evaluate(async () => {
      await loginService.loginWithPassword("linked@example.com", "password1234");
      const claim = await portalService.claimGame("game-1");
      return { claim, account: loginService.getCurrentAccount(), games: gameService.getAll() };
    });
    fixtureExpect(result.claim.success).toBe(false);
    fixtureExpect(result.account.id).toBe("profile-umpire-1");
    fixtureExpect(result.games).toHaveLength(1);
    const calls = await supabaseAuthApp.calls();
    fixtureExpect(calls.find(call => call.name === "submit_assignment_claim")?.args).toEqual({ p_assignment_id: "assignment-1" });
  });
});

const managerProfile = { id: "profile-admin-1", auth_user_id: "auth-admin-1", organization_id: "organization-1", first_name: "Ada", last_name: "Admin", email: "admin@example.com", role: "administrator", status: "approved", communication_preferences: {} };
const failureLocation = { id: "location-1", organization_id: "organization-1", name: "Complex", active: true };
const failureField = { id: "field-1", organization_id: "organization-1", location_id: "location-1", name: "Field", active: true };
const failureGame = { id: "game-1", organization_id: "organization-1", season_id: "season-1", location_id: "location-1", field_id: "field-1", game_date: "2099-08-20", game_time: "18:00:00", home_team: "Home", away_team: "Away", level: "12U", game_type: "single", lifecycle_status: "scheduled", review: {}, report: {}, source_metadata: {} };
const pendingAssignment = { id: "assignment-1", organization_id: "organization-1", game_id: "game-1", position: "Plate", status: "pending_approval", assigned_crew_member_id: null, locked: false };
const pendingClaim = { id: "claim-1", organization_id: "organization-1", assignment_id: "assignment-1", claimant_crew_member_id: "crew-umpire-1", status: "pending", claimed_at: "2099-08-01T00:00:00Z", decided_at: null };
const claimantCrew = { id: "crew-umpire-1", organization_id: "organization-1", profile_id: "profile-umpire-1", first_name: "Linked", last_name: "Umpire", email: "linked@example.com", active: true, eligible_levels: ["12U"], preferences: {} };

for (const decision of ["approved", "rejected"]) {
  fixtureTest.describe(`${decision} claim failure`, () => {
    fixtureTest.use({ supabaseScenario: { profile: managerProfile, crewId: null, locations: [failureLocation], fields: [failureField], games: [failureGame], assignments: [pendingAssignment], claims: [pendingClaim], crewMembers: [claimantCrew], failedRpc: "decide_assignment_claim" } });
    fixtureTest(`returns a structured ${decision} error without logout or partial publication`, async ({ supabaseAuthApp }) => {
      const result = await supabaseAuthApp.page.evaluate(async ({ decision }) => {
        await loginService.loginWithPassword("admin@example.com", "password1234");
        const before = gameService.getAll();
        const mutation = decision === "approved"
          ? await claimsQueueService.approveClaim("game-1", "assignment-1")
          : await claimsQueueService.rejectClaim("game-1", "assignment-1");
        return { mutation, before, after: gameService.getAll(), account: loginService.getCurrentAccount() };
      }, { decision });
      fixtureExpect(result.mutation.success).toBe(false);
      fixtureExpect(result.account.id).toBe("profile-admin-1");
      fixtureExpect(result.after).toEqual(result.before);
      const calls = await supabaseAuthApp.calls();
      fixtureExpect(calls.find(call => call.name === "decide_assignment_claim")?.args).toEqual({
        p_assignment_id: "assignment-1",
        p_decision: decision,
        p_reason: null
      });
    });
  });
}

fixtureTest.describe("post-claim scheduling refresh failure", () => {
  fixtureTest.use({ supabaseScenario: { locations: [failureLocation], fields: [failureField], games: [failureGame], assignments: [{ ...pendingAssignment, status: "open_for_claim" }] } });
  fixtureTest("retains authenticated identity and clears scheduling atomically after persistence", async ({ supabaseAuthApp }) => {
    const result = await supabaseAuthApp.page.evaluate(async () => {
      await loginService.loginWithPassword("linked@example.com", "password1234");
      window.__supabaseFixture.settings.deniedTable = "games";
      const mutation = await portalService.claimGame("game-1");
      return { mutation, account: loginService.getCurrentAccount(), games: gameService.getAll(), locations: locationService.getLocations(), hydration: supabaseAuthService.getHydrationState() };
    });
    fixtureExpect(result.mutation.success).toBe(false);
    fixtureExpect(result.mutation.data.persisted).toBe(true);
    fixtureExpect(result.account.id).toBe("profile-umpire-1");
    fixtureExpect(result.games).toEqual([]);
    fixtureExpect(result.locations).toEqual([]);
    fixtureExpect(result.hydration).toMatchObject({ status: "error", authenticated: true });
  });
});

fixtureTest.describe("claim hydration failure", () => {
  fixtureTest.use({ supabaseScenario: { locations: [failureLocation], fields: [failureField], games: [failureGame], assignments: [{ ...pendingAssignment, status: "open_for_claim" }], deniedTable: "assignment_claims" } });
  fixtureTest("retains identity and publishes no scheduling state", async ({ supabaseAuthApp }) => {
    const result = await supabaseAuthApp.page.evaluate(async () => {
      const login = await loginService.loginWithPassword("linked@example.com", "password1234");
      return { login, account: loginService.getCurrentAccount(), games: gameService.getAll(), locations: locationService.getLocations() };
    });
    fixtureExpect(result.login.success).toBe(false);
    fixtureExpect(result.account.id).toBe("profile-umpire-1");
    fixtureExpect(result.games).toEqual([]);
    fixtureExpect(result.locations).toEqual([]);
  });
});
