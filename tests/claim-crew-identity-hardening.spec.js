import { test, expect } from "./fixtures/supabase-auth.fixture.js";

const organizationId = "10000000-0000-4000-8000-000000000001";
const claimantProfile = {
  id: "40000000-0000-4000-8000-000000000002",
  auth_user_id: "30000000-0000-4000-8000-000000000002",
  organization_id: organizationId,
  first_name: "Casey",
  last_name: "Claimant",
  email: "casey@example.com",
  role: "umpire",
  status: "approved",
  personnel_id: "UMP-002",
  personnel_id_issued_at: "2026-08-14T00:00:00.000Z",
  crew_code: "BC-2026-0002",
  communication_preferences: {}
};
const administrator = {
  id: "40000000-0000-4000-8000-000000000001",
  auth_user_id: "30000000-0000-4000-8000-000000000001",
  organization_id: organizationId,
  first_name: "Admin",
  last_name: "User",
  email: "admin@example.com",
  role: "administrator",
  status: "approved",
  communication_preferences: {}
};
const claimantCrew = {
  id: "50000000-0000-4000-8000-000000000002",
  organization_id: organizationId,
  profile_id: claimantProfile.id,
  first_name: "Casey",
  last_name: "Claimant",
  email: claimantProfile.email,
  active: true,
  eligible_levels: ["12U"],
  preferences: {}
};
const location = { id: "location-identity", organization_id: organizationId, name: "Identity Complex", active: true };
const field = { id: "field-identity", organization_id: organizationId, location_id: location.id, name: "Field 1", active: true };
const statuses = ["pending", "approved", "rejected", "withdrawn"];
const games = statuses.map((status, index) => ({
  id: `game-${status}`,
  organization_id: organizationId,
  season_id: "season-1",
  location_id: location.id,
  field_id: field.id,
  game_date: `2099-09-${String(10 + index).padStart(2, "0")}`,
  game_time: "18:00:00",
  home_team: `${status} Home`,
  away_team: `${status} Away`,
  level: "12U",
  game_type: "single",
  lifecycle_status: "scheduled",
  review: {},
  report: {},
  source_metadata: {}
}));
const assignments = statuses.map(status => ({
  id: `assignment-${status}`,
  organization_id: organizationId,
  game_id: `game-${status}`,
  position: "Plate",
  status: status === "pending" ? "pending_approval" : status === "approved" ? "assigned" : status === "rejected" ? "open_for_claim" : "needs_assignment",
  assigned_crew_member_id: status === "approved" ? claimantCrew.id : null,
  locked: false
}));
const claims = statuses.map((status, index) => ({
  id: `claim-${status}`,
  organization_id: organizationId,
  assignment_id: `assignment-${status}`,
  claimant_crew_member_id: index === 2 ? claimantCrew.id.toUpperCase() : claimantCrew.id,
  status,
  claimed_at: `2099-08-0${index + 1}T00:00:00.000Z`,
  decided_at: status === "pending" ? null : `2099-08-1${index}T00:00:00.000Z`,
  decision_by_profile_id: status === "pending" ? null : administrator.id
}));

const identityScenario = {
  profile: administrator,
  crewId: null,
  pendingProfiles: [claimantProfile],
  crewMembers: [claimantCrew],
  locations: [location],
  fields: [field],
  games,
  assignments,
  claims
};

test.describe("authoritative claimant identity resolution", () => {
  test.use({ supabaseScenario: identityScenario });

  test("pending and processed claims resolve the same linked crew identity", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    await page.evaluate(async () => { await loginService.loginWithPassword("admin@example.com", "password"); });
    const resolved = await page.evaluate(() => ({
      pending: claimsQueueService.getPendingClaims().map(claim => claim.claimedByName),
      history: claimsQueueService.getClaimHistory().map(claim => ({ id: claim.assignment.claimId, name: claim.claimedByName, crewId: claim.claimedBy }))
    }));
    expect(resolved.pending).toEqual(["Casey Claimant"]);
    expect(resolved.history).toHaveLength(3);
    expect(resolved.history.map(item => item.name)).toEqual(["Casey Claimant", "Casey Claimant", "Casey Claimant"]);
    expect(resolved.history.find(item => item.id === "claim-rejected")?.crewId.toLowerCase()).toBe(claimantCrew.id);

    await page.evaluate(() => renderPage("claims-queue"));
    await expect(page.getByTestId("claim-claimed-by")).toHaveText("Casey Claimant");
    await page.evaluate(() => renderPage("operations-center"));
    await expect(page.getByTestId("operations-claim-requester")).toContainText("Casey Claimant");
    await page.evaluate(() => renderPage("claim-history"));
    await expect(page.getByTestId("approved-claim-card")).toContainText("Claimed by Casey Claimant");
    await expect(page.getByTestId("rejected-claim-card")).toContainText("Claimed by Casey Claimant");
    await expect(page.getByTestId("withdrawn-claim-card")).toContainText("Claimed by Casey Claimant");
    await expect(page.getByTestId("approved-claim-card")).toContainText("approved Away @ approved Home");
  });

  test("history chronology and supporting fields remain unchanged", async ({ supabaseAuthApp }) => {
    const ordered = await supabaseAuthApp.page.evaluate(async () => {
      await loginService.loginWithPassword("admin@example.com", "password");
      return claimsQueueService.getClaimHistory().map(claim => ({
        id: claim.assignment.claimId,
        matchup: claim.matchup,
        position: claim.position,
        status: claim.assignment.claimStatus
      }));
    });
    expect(ordered.map(item => item.id)).toEqual(["claim-withdrawn", "claim-rejected", "claim-approved"]);
    expect(ordered[0]).toMatchObject({ matchup: "withdrawn Away @ withdrawn Home", position: "Plate", status: "withdrawn" });
  });
});

test.describe("neutral claimant fallback", () => {
  test.use({
    supabaseScenario: {
      ...identityScenario,
      crewMembers: [],
      assignments: [assignments[2]],
      games: [games[2]],
      claims: [claims[2]]
    }
  });

  test("a genuinely inaccessible crew record remains neutral", async ({ supabaseAuthApp }) => {
    const name = await supabaseAuthApp.page.evaluate(async () => {
      await loginService.loginWithPassword("admin@example.com", "password");
      return claimsQueueService.getClaimHistory()[0].claimedByName;
    });
    expect(name).toBe("Unknown Umpire");
  });
});
