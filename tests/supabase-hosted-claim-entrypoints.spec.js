import { test, expect } from "./fixtures/supabase-auth.fixture.js";

const profile = { id: "profile-claim-ui", auth_user_id: "auth-claim-ui", organization_id: "organization-1", first_name: "Claim", last_name: "Umpire", email: "claim-ui@example.com", role: "umpire", status: "approved", communication_preferences: {} };
const crew = { id: "crew-claim-ui", organization_id: "organization-1", profile_id: profile.id, first_name: "Claim", last_name: "Umpire", email: profile.email, active: true, eligible_levels: ["12U"], preferences: {} };
const location = { id: "location-claim-ui", organization_id: "organization-1", name: "Claim Complex", active: true };
const field = { id: "field-claim-ui", organization_id: "organization-1", location_id: location.id, name: "Field 1", active: true };
const game = { id: "game-claim-ui", organization_id: "organization-1", season_id: "season-1", location_id: location.id, field_id: field.id, game_date: "2099-09-10", game_time: "18:00:00", home_team: "Home", away_team: "Away", level: "12U", game_type: "single", lifecycle_status: "scheduled", review: {}, report: {}, source_metadata: {} };
const assignment = { id: "assignment-claim-ui", organization_id: "organization-1", game_id: game.id, position: "Plate", status: "needs_assignment", assigned_crew_member_id: null, locked: false };
const withdrawn = { id: "claim-withdrawn-ui", organization_id: "organization-1", assignment_id: assignment.id, claimant_crew_member_id: crew.id, status: "withdrawn", claimed_at: "2099-08-01T00:00:00Z", decided_at: "2099-08-02T00:00:00Z", decision_by_profile_id: "admin-profile", decision_reason: "Administrative assignment removal" };
const scenario = { profile, crewId: crew.id, crewMembers: [crew], locations: [location], fields: [field], games: [game], assignments: [assignment], claims: [withdrawn] };

test.describe("Hosted claim entry points", () => {
  test.use({ supabaseScenario: scenario });

  test("Dashboard Claim awaits the shared hosted command and refreshes", async ({ supabaseAuthApp }) => {
    const { page, calls } = supabaseAuthApp;
    await page.evaluate(async () => { await loginService.loginWithPassword("claim-ui@example.com", "password"); renderPage("dashboard"); });
    await page.getByTestId(`dashboard-claim-${game.id}`).click();
    await expect.poll(() => page.evaluate(() => window.__supabaseFixture.settings.assignments[0].status)).toBe("pending_approval");
    expect((await calls()).filter(call => call.name === "submit_assignment_claim")).toHaveLength(1);
  });

  test("Claim Games uses the same hosted RPC and preserves withdrawn history", async ({ supabaseAuthApp }) => {
    const { page, calls } = supabaseAuthApp;
    await page.evaluate(async () => { await loginService.loginWithPassword("claim-ui@example.com", "password"); renderPage("claim-games"); });
    await page.getByTestId(`claim-game-${game.id}`).click();
    await expect(page.locator(".toast.success")).toContainText("Claim submitted for approval.");
    await expect(page.getByTestId("claim-games-empty")).toBeVisible();
    const state = await page.evaluate(() => window.__supabaseFixture.settings);
    expect(state.claims.filter(claim => claim.status === "withdrawn")).toHaveLength(1);
    expect(state.claims.filter(claim => claim.status === "pending")).toHaveLength(1);
    expect((await calls()).filter(call => call.name === "submit_assignment_claim")).toHaveLength(1);
  });

  test("duplicate submission creates only one pending claim", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    const results = await page.evaluate(async () => {
      await loginService.loginWithPassword("claim-ui@example.com", "password");
      return Promise.all([portalService.claimGame("game-claim-ui"), portalService.claimGame("game-claim-ui")]);
    });
    expect(results.filter(result => result.success)).toHaveLength(1);
    expect(await page.evaluate(() => window.__supabaseFixture.settings.claims.filter(claim => claim.status === "pending").length)).toBe(1);
  });
});

test.describe("Hosted claim level eligibility", () => {
  test.use({ supabaseScenario: { ...scenario, games: [{ ...game, level: "Test Division" }] } });

  test("unsupported level is not listed and command eligibility agrees", async ({ supabaseAuthApp }) => {
    const { page, calls } = supabaseAuthApp;
    const result = await page.evaluate(async () => {
      await loginService.loginWithPassword("claim-ui@example.com", "password");
      renderPage("claim-games");
      return portalService.claimGame("game-claim-ui");
    });
    await expect(page.getByTestId("claim-games-empty")).toBeVisible();
    expect(result).toMatchObject({ success: false, message: "You are not certified for this game's level." });
    expect((await calls()).filter(call => call.name === "submit_assignment_claim")).toHaveLength(0);
  });

  test("RPC reports a level-specific error when invoked directly", async ({ supabaseAuthApp }) => {
    const result = await supabaseAuthApp.page.evaluate(async () => {
      await loginService.loginWithPassword("claim-ui@example.com", "password");
      return supabaseSharedRepository.submitAssignmentClaim("assignment-claim-ui");
    });
    expect(result.error?.message).toBe("claim_level_ineligible");
  });
});

test.describe("Hosted claim errors", () => {
  test.use({ supabaseScenario: { ...scenario, failedRpc: "submit_assignment_claim" } });

  test("Dashboard shows the hosted error and retains the claimable state", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    await page.evaluate(async () => { await loginService.loginWithPassword("claim-ui@example.com", "password"); renderPage("dashboard"); });
    await page.getByTestId(`dashboard-claim-${game.id}`).click();
    await expect(page.getByText("The claim could not be submitted. Please try again.")).toBeVisible();
    expect(await page.evaluate(() => window.__supabaseFixture.settings.assignments[0].status)).toBe("needs_assignment");
    expect(await page.evaluate(() => window.__supabaseFixture.settings.claims.filter(claim => claim.status === "pending").length)).toBe(0);
  });

  test("Claim Games shows hosted errors without removing the game", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    await page.evaluate(async () => { await loginService.loginWithPassword("claim-ui@example.com", "password"); renderPage("claim-games"); });
    await page.getByTestId(`claim-game-${game.id}`).click();
    await expect(page.locator(".toast.error")).toContainText("The claim could not be submitted. Please try again.");
    await expect(page.getByTestId(`claim-game-row-${game.id}`)).toBeVisible();
  });
});
