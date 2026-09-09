import { readFileSync } from "node:fs";
import { expect, test } from "./fixtures/supabase-auth.fixture.js";

const admin = { id: "admin", auth_user_id: "admin-auth", organization_id: "organization-1", first_name: "Admin", last_name: "User", email: "admin@example.com", role: "administrator", status: "approved", communication_preferences: {} };
const umpireProfile = { id: "umpire-profile", auth_user_id: "umpire-auth", organization_id: "organization-1", first_name: "Replacement", last_name: "Umpire", email: "umpire@example.com", role: "umpire", status: "approved", communication_preferences: {} };
const claimant = { id: "replacement-crew", organization_id: "organization-1", profile_id: umpireProfile.id, first_name: "Replacement", last_name: "Umpire", email: umpireProfile.email, active: true, eligible_levels: ["6U", "8U"], preferences: {} };
const priorCrew = { id: "prior-crew", organization_id: "organization-1", profile_id: "prior-profile", first_name: "Prior", last_name: "Umpire", email: "prior@example.com", active: true, eligible_levels: ["6U"], preferences: {} };
const location = { id: "location-1", organization_id: "organization-1", name: "Lake Shore", active: true };
const field = { id: "field-9", organization_id: "organization-1", location_id: location.id, name: "Field 9", active: true };
const game = { id: "game-reopened", organization_id: "organization-1", season_id: "season-1", location_id: location.id, field_id: field.id, game_date: "2099-09-26", game_time: "15:00:00", home_team: "Home", away_team: "Away", level: "6U", game_type: "single", lifecycle_status: "scheduled", review: {}, report: {}, source_metadata: {} };
const assignment = { id: "assignment-reopened", organization_id: "organization-1", game_id: game.id, position: "Plate", status: "pending_approval", assigned_crew_member_id: null, locked: false };
const priorApproved = { id: "claim-prior", organization_id: "organization-1", assignment_id: assignment.id, claimant_crew_member_id: priorCrew.id, status: "approved", claimed_at: "2099-08-01T12:00:00Z", decided_at: "2099-08-02T12:00:00Z" };
const replacementPending = { id: "claim-replacement", organization_id: "organization-1", assignment_id: assignment.id, claimant_crew_member_id: claimant.id, status: "pending", claimed_at: "2099-09-01T12:00:00Z", decided_at: null };

test.describe("hosted replacement claim approval", () => {
  test.use({ supabaseScenario: { profile: admin, crewId: null, crewMembers: [priorCrew, claimant], locations: [location], fields: [field], games: [game], assignments: [assignment], claims: [priorApproved, replacementPending] } });

  test("retires the prior approval and persists the replacement claimant", async ({ supabaseAuthApp }) => {
    const { page, calls } = supabaseAuthApp;
    await page.evaluate(async () => { await loginService.loginWithPassword("admin@example.com", "password"); renderPage("claims-queue"); });
    await page.getByTestId("approve-claim-assignment-reopened").click();
    await expect(page.getByTestId("claims-queue-empty")).toBeVisible();
    const state = await page.evaluate(() => ({
      assignment: window.__supabaseFixture.settings.assignments[0],
      claims: window.__supabaseFixture.settings.claims.map(({ id, status, decision_reason }) => ({ id, status, decision_reason }))
    }));
    expect(state.assignment).toMatchObject({ status: "assigned", assigned_crew_member_id: "replacement-crew" });
    expect(state.claims).toEqual([
      { id: "claim-prior", status: "withdrawn", decision_reason: "Superseded by a replacement approved claim" },
      { id: "claim-replacement", status: "approved", decision_reason: undefined }
    ]);
    expect((await calls()).filter(call => call.name === "decide_assignment_claim")).toHaveLength(1);
  });
});

test.describe("Claims Queue hosted failure feedback", () => {
  test.use({ supabaseScenario: { profile: admin, crewId: null, crewMembers: [claimant], locations: [location], fields: [field], games: [game], assignments: [assignment], claims: [replacementPending], failedRpc: "decide_assignment_claim" } });

  test("shows the backend-safe error and restores the claim action", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    await page.evaluate(async () => { await loginService.loginWithPassword("admin@example.com", "password"); renderPage("claims-queue"); });
    const approve = page.getByTestId("approve-claim-assignment-reopened");
    await approve.click();
    await expect(page.getByTestId("claims-queue-decision-error")).toContainText("The claim could not be approved.");
    await expect(approve).toBeEnabled();
    await expect(page.getByTestId("claim-queue-card")).toHaveCount(1);
  });
});

const multiGames = [1, 2, 3].map(index => ({ ...game, id: `game-${index}`, game_date: `2099-10-0${index}` }));
const multiAssignments = multiGames.map((item, index) => ({ ...assignment, id: `assignment-${index + 1}`, game_id: item.id }));
const multiClaims = multiAssignments.map((item, index) => ({ ...replacementPending, id: `claim-${index + 1}`, assignment_id: item.id }));

test.describe("three independent hosted claims", () => {
  test.use({ supabaseScenario: { profile: admin, crewId: null, crewMembers: [claimant], locations: [location], fields: [field], games: multiGames, assignments: multiAssignments, claims: multiClaims } });

  test("approve consecutively without stale identity", async ({ supabaseAuthApp }) => {
    const { page, calls } = supabaseAuthApp;
    const result = await page.evaluate(async () => {
      await loginService.loginWithPassword("admin@example.com", "password");
      const decisions = [];
      for (const item of claimsQueueService.getPendingClaims()) decisions.push(await claimsQueueService.approveClaim(item.gameId, item.assignmentId, item.claimId));
      const settings = window.__supabaseFixture.settings;
      return { decisions, assignments: settings.assignments.map(item => item.status), claims: settings.claims.map(item => item.status) };
    });
    expect(result.decisions.every(item => item.success)).toBe(true);
    expect(result.assignments).toEqual(["assigned", "assigned", "assigned"]);
    expect(result.claims).toEqual(["approved", "approved", "approved"]);
    expect((await calls()).filter(call => call.name === "decide_assignment_claim")).toHaveLength(3);
  });
});

test("migration reconciles decline, direct assignment, and replacement approval", () => {
  const migration = readFileSync("supabase/migrations/202609090001_claim_assignment_reconciliation.sql", "utf8");
  expect(migration).toContain("Superseded by a replacement approved claim");
  expect(migration).toContain("Assignment declined by umpire");
  expect(migration).toContain("Administrative direct assignment");
  expect(migration).toContain("status = 'approved' and id <> v_claim.id");
  expect(migration).toContain("status='pending'");
  expect(migration).not.toMatch(/update public\.assignment_claims[\s\S]*where status='pending'\s*;/);
});
