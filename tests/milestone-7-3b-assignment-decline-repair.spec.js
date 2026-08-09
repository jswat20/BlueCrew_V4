import { readFileSync } from "node:fs";
import { expect, test } from "./fixtures/supabase-auth.fixture.js";

const admin = { id: "admin-profile", auth_user_id: "admin-auth", organization_id: "organization-1", first_name: "Admin", last_name: "User", email: "admin@example.com", role: "administrator", status: "approved", communication_preferences: {} };
const umpireProfile = { id: "umpire-profile", auth_user_id: "umpire-auth", organization_id: "organization-1", first_name: "Test", last_name: "UmpireOne", email: "umpire@example.com", role: "umpire", status: "approved", communication_preferences: {} };
const crew = { id: "crew-umpire", organization_id: "organization-1", profile_id: umpireProfile.id, first_name: "Test", last_name: "UmpireOne", email: umpireProfile.email, phone: "", active: true, eligible_levels: ["12U"], preferences: {}, notes: "" };
const game = { id: "game-73b", organization_id: "organization-1", season_id: "season-1", location_id: "location-1", field_id: "field-1", legacy_game_id: "LS26S-8U-0112", game_date: "2099-06-15", game_time: "18:30:00", timezone: "America/New_York", home_team: "Hawks", away_team: "Bears", level: "12U", game_type: "single", lifecycle_status: "scheduled", review: {}, report: {}, source_metadata: {} };
const openAssignment = { id: "assignment-73b", organization_id: "organization-1", game_id: game.id, position: "Plate", status: "needs_assignment", assigned_crew_member_id: null, locked: false };
const locations = [{ id: "location-1", organization_id: "organization-1", name: "Lake Shore Athletic Complex", address: "", active: true }];
const fields = [{ id: "field-1", organization_id: "organization-1", location_id: "location-1", name: "Field 1", active: true }];

test.describe("Milestone 7.3B hosted direct assignment", () => {
  test.use({ supabaseScenario: { profile: admin, crewId: null, games: [game], assignments: [openAssignment], crewMembers: [crew], locations, fields } });

  test("one Save persists exact crew, refreshes Game Hub, and guards duplicate submission", async ({ supabaseAuthApp }) => {
    const { page, calls } = supabaseAuthApp;
    await page.evaluate(async () => { await loginService.loginWithPassword("admin@example.com", "password"); renderPage("game-hub", { gameId: "game-73b" }); });
    await page.getByTestId("game-hub-assign-Plate").click();
    await page.locator('input[value="crew-umpire"]').check();
    const save = page.getByTestId("game-hub-crew-save-assignment-73b");
    await save.dblclick();
    await expect(page.getByTestId("game-hub-remove-assignment-73b")).toBeVisible();
    const state = await page.evaluate(() => ({ assignment: window.__supabaseFixture.settings.assignments[0], notifications: window.__supabaseFixture.settings.notifications, activities: window.__supabaseFixture.settings.activities }));
    expect(state.assignment).toMatchObject({ assigned_crew_member_id: "crew-umpire", status: "assigned", position: "Plate" });
    expect(state.notifications.filter(item => item.type === "assignment-created")).toHaveLength(1);
    expect(state.activities.filter(item => item.action === "assignment_assigned")).toHaveLength(1);
    expect((await calls()).filter(call => call.name === "assign_game_assignment_crew")).toHaveLength(1);
    expect((await calls()).filter(call => call.name === "decide_assignment_claim")).toHaveLength(0);
  });
});

test.describe("Milestone 7.3B direct assignment failure", () => {
  test.use({ supabaseScenario: { profile: admin, crewId: null, games: [game], assignments: [{ ...openAssignment }], crewMembers: [crew], locations, fields, failedRpc: "assign_game_assignment_crew" } });
  test("keeps selection and dialog open without local mutation", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    await page.evaluate(async () => { await loginService.loginWithPassword("admin@example.com", "password"); renderPage("game-hub", { gameId: "game-73b" }); });
    await page.getByTestId("game-hub-assign-Plate").click();
    await page.locator('input[value="crew-umpire"]').check();
    await page.getByTestId("game-hub-crew-save-assignment-73b").click();
    await expect(page.getByTestId("game-hub-crew-picker-assignment-73b")).toBeVisible();
    await expect(page.getByTestId("game-hub-crew-picker-status")).toContainText("Transactional write failed");
    await expect(page.locator('input[value="crew-umpire"]')).toBeChecked();
    expect(await page.evaluate(() => window.__supabaseFixture.settings.assignments[0].assigned_crew_member_id)).toBeNull();
  });
});

test.describe("Milestone 7.3B accessible hosted decline", () => {
  test.use({ supabaseScenario: { profile: umpireProfile, crewId: crew.id, games: [game], assignments: [{ ...openAssignment, status: "assigned", assigned_crew_member_id: crew.id }], crewMembers: [crew], locations, fields } });
  test("validates, cancels with focus restoration, and submits exactly one decline", async ({ supabaseAuthApp }) => {
    const { page, calls } = supabaseAuthApp;
    await page.evaluate(async () => { await loginService.loginWithPassword("umpire@example.com", "password"); renderPage("game-hub", { gameId: "game-73b" }); });
    const trigger = page.getByTestId("game-hub-decline-assignment");
    await trigger.click();
    const dialog = page.getByTestId("game-hub-decline-dialog");
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId("game-hub-decline-reason")).toBeFocused();
    await page.getByTestId("game-hub-decline-submit").click();
    await expect(page.getByTestId("game-hub-decline-status")).toContainText("Enter a reason");
    await page.getByTestId("game-hub-decline-cancel").click();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.getByTestId("game-hub-decline-reason").fill("Schedule conflict");
    await page.getByTestId("game-hub-decline-submit").dblclick();
    await expect(page.getByTestId("my-schedule")).toBeVisible();
    const state = await page.evaluate(() => ({ assignment: window.__supabaseFixture.settings.assignments[0], notifications: window.__supabaseFixture.settings.notifications, activities: window.__supabaseFixture.settings.activities }));
    expect(state.assignment).toMatchObject({ assigned_crew_member_id: null, status: "needs_assignment", decline_reason: "Schedule conflict" });
    expect(state.notifications.filter(item => item.type === "assignment-declined")).toHaveLength(1);
    expect(state.activities.filter(item => item.action === "assignment_declined")).toHaveLength(1);
    expect((await calls()).filter(call => call.name === "decline_own_game_assignment")).toHaveLength(1);
  });

  test("Escape closes safely and restores trigger focus", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    await page.evaluate(async () => { await loginService.loginWithPassword("umpire@example.com", "password"); renderPage("game-hub", { gameId: "game-73b" }); });
    const trigger = page.getByTestId("game-hub-decline-assignment");
    await trigger.click();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("game-hub-decline-dialog")).not.toBeVisible();
    await expect(trigger).toBeFocused();
  });
});

test("7.3B removes prompt and adds trusted server commands", () => {
  const source = readFileSync("js/ui/gameHub.js", "utf8");
  const migration = readFileSync("supabase/migrations/202608080004_hosted_assignment_decline_commands.sql", "utf8");
  expect(source).not.toContain("window.prompt");
  expect(migration).toContain("public.assign_game_assignment_crew");
  expect(migration).toContain("public.decline_own_game_assignment");
  expect(migration).toContain("public.current_organization_id()");
  expect(migration).toContain("public.current_profile_id()");
});
