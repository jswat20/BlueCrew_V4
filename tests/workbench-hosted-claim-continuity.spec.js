import { test, expect } from "./fixtures/supabase-auth.fixture.js";

const admin = { id: "profile-review-admin", auth_user_id: "auth-review-admin", organization_id: "organization-1", first_name: "Review", last_name: "Admin", email: "review-admin@example.com", role: "administrator", status: "approved", communication_preferences: {} };
const claimant = { id: "crew-review", organization_id: "organization-1", profile_id: "profile-review-umpire", first_name: "Review", last_name: "Umpire", email: "review-umpire@example.com", active: true, eligible_levels: ["8U"], preferences: {} };
const location = { id: "location-review", organization_id: "organization-1", name: "Review Complex", active: true };
const field = { id: "field-review", organization_id: "organization-1", location_id: location.id, name: "Field 1", active: true };
const games = [1, 2].map(index => ({ id: `game-review-${index}`, organization_id: "organization-1", season_id: "season-1", location_id: location.id, field_id: field.id, game_date: `2099-09-1${index}`, game_time: "18:00:00", home_team: `Home ${index}`, away_team: `Away ${index}`, level: "8U", game_type: "single", lifecycle_status: "scheduled", review: {}, report: {}, source_metadata: {} }));
const assignments = games.map((game, index) => ({ id: `assignment-review-${index + 1}`, organization_id: "organization-1", game_id: game.id, position: "Plate", status: "pending_approval", assigned_crew_member_id: null, locked: false }));
const claims = assignments.map((assignment, index) => ({ id: `claim-review-${index + 1}`, organization_id: "organization-1", assignment_id: assignment.id, claimant_crew_member_id: claimant.id, status: "pending", claimed_at: `2099-08-0${index + 1}T12:00:00Z`, decided_at: null }));
const scenario = { profile: admin, crewId: null, crewMembers: [claimant], locations: [location], fields: [field], games, assignments, claims, notifications: [], activities: [] };

async function openReview(page) {
  await page.evaluate(async () => { await loginService.loginWithPassword("review-admin@example.com", "password"); renderPage("assigner-workbench"); });
  await page.getByTestId("workbench-pending-claims-item").first().click();
  await expect(page.getByTestId("workbench-game-dialog")).toBeVisible();
}

async function visibleDecisionIdentity(page) {
  const button = page.getByTestId("workbench-accept-claim");
  return {
    claimId: await button.getAttribute("data-claim-id"),
    assignmentId: await button.getAttribute("data-assignment-id"),
    gameId: await button.getAttribute("data-game-id")
  };
}

async function decideCalls(calls) {
  return (await calls()).filter(call => call.name === "decide_assignment_claim");
}

test.describe("hosted Workbench claim-review continuity", () => {
  test.use({ supabaseScenario: scenario });

  test("approves two claims with one decision call per click while keeping continuity", async ({ supabaseAuthApp }) => {
    const { page, calls } = supabaseAuthApp;
    await openReview(page);
    await expect(page.getByTestId("workbench-claim-remaining")).toHaveText("2 pending claims");
    expect(await visibleDecisionIdentity(page)).toEqual({ claimId: "claim-review-1", assignmentId: "assignment-review-1", gameId: "game-review-1" });
    const firstButton = await page.getByTestId("workbench-accept-claim").elementHandle();
    await page.getByTestId("workbench-accept-claim").click();
    await expect(page.getByTestId("workbench-game-dialog")).toBeVisible();
    await expect(page.getByTestId("workbench-claim-remaining")).toHaveText("1 pending claim");
    expect((await decideCalls(calls)).map(call => call.args.p_assignment_id)).toEqual(["assignment-review-1"]);
    expect(await visibleDecisionIdentity(page)).toEqual({ claimId: "claim-review-2", assignmentId: "assignment-review-2", gameId: "game-review-2" });
    await firstButton.evaluate(button => button.click());
    expect((await decideCalls(calls)).map(call => call.args.p_assignment_id)).toEqual(["assignment-review-1"]);
    await page.getByTestId("workbench-accept-claim").click();
    await expect(page.getByTestId("workbench-game-dialog")).toHaveCount(0);
    expect((await decideCalls(calls)).map(call => call.args.p_assignment_id)).toEqual(["assignment-review-1", "assignment-review-2"]);
    const state = await page.evaluate(() => window.__supabaseFixture.settings);
    expect(state.claims.map(({ id, assignment_id, status }) => ({ id, assignment_id, status }))).toEqual([
      { id: "claim-review-1", assignment_id: "assignment-review-1", status: "approved" },
      { id: "claim-review-2", assignment_id: "assignment-review-2", status: "approved" }
    ]);
    expect(state.assignments.map(({ id, status, assigned_crew_member_id }) => ({ id, status, assigned_crew_member_id }))).toEqual([
      { id: "assignment-review-1", status: "assigned", assigned_crew_member_id: "crew-review" },
      { id: "assignment-review-2", status: "assigned", assigned_crew_member_id: "crew-review" }
    ]);
  });

  test("supports reject then approve without reopening", async ({ supabaseAuthApp }) => {
    const { page, calls } = supabaseAuthApp;
    await openReview(page);
    expect((await visibleDecisionIdentity(page)).claimId).toBe("claim-review-1");
    await page.getByTestId("workbench-reject-claim").click();
    await expect(page.getByTestId("workbench-claim-remaining")).toHaveText("1 pending claim");
    expect(await visibleDecisionIdentity(page)).toEqual({ claimId: "claim-review-2", assignmentId: "assignment-review-2", gameId: "game-review-2" });
    await page.getByTestId("workbench-accept-claim").click();
    await expect(page.getByTestId("workbench-game-dialog")).toHaveCount(0);
    expect(await page.evaluate(() => window.__supabaseFixture.settings.claims.map(claim => claim.status).sort())).toEqual(["approved", "rejected"]);
    expect((await decideCalls(calls)).map(call => ({ assignmentId: call.args.p_assignment_id, decision: call.args.p_decision }))).toEqual([
      { assignmentId: "assignment-review-1", decision: "rejected" },
      { assignmentId: "assignment-review-2", decision: "approved" }
    ]);
  });

  test("rapid double click issues one hosted decision", async ({ supabaseAuthApp }) => {
    const { page, calls } = supabaseAuthApp;
    await openReview(page);
    await page.getByTestId("workbench-accept-claim").evaluate(button => { button.click(); button.click(); });
    await expect(page.getByTestId("workbench-claim-remaining")).toHaveText("1 pending claim");
    expect((await decideCalls(calls)).map(call => call.args.p_assignment_id)).toEqual(["assignment-review-1"]);
  });
});

test.describe("hosted Workbench claim-review failure", () => {
  test.use({ supabaseScenario: { ...scenario, failedRpc: "decide_assignment_claim" } });

  test("keeps the current claim open and restores the initiating control", async ({ supabaseAuthApp }) => {
    const { page, calls } = supabaseAuthApp;
    await openReview(page);
    const approve = page.getByTestId("workbench-accept-claim");
    await approve.click();
    await expect(page.getByTestId("workbench-game-dialog")).toBeVisible();
    await expect(page.getByTestId("workbench-claim-decision-error")).toContainText("The claim could not be approved.");
    await expect(approve).toBeFocused();
    await expect(approve).toBeEnabled();
    expect((await calls()).filter(call => call.name === "decide_assignment_claim")).toHaveLength(1);
  });
});
