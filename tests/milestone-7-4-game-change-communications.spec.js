const { test, expect } = require("@playwright/test");
const { readFileSync } = require("node:fs");
const { pathToFileURL } = require("node:url");
const path = require("node:path");
const { test: hostedTest } = require("./fixtures/supabase-auth.fixture");

const migration = () => readFileSync("supabase/migrations/202608090002_game_change_communications.sql", "utf8");
const sharedTemplate = () => import(pathToFileURL(path.resolve("supabase/functions/_shared/communication-template.mjs")).href);

test("authoritative trigger covers operational changes, cancellation, and restoration", () => {
  const sql = migration();
  for (const eventType of ["game-date-changed", "game-time-changed", "game-location-changed", "game-field-changed", "game-cancelled", "game-restored"]) {
    expect(sql).toContain("'" + eventType + "'");
  }
  expect(sql).toContain("after update of game_date,game_time,location_id,field_id,lifecycle_status");
  expect(sql).toContain("old.game_date is distinct from new.game_date");
  expect(sql).toContain("old.game_time is distinct from new.game_time");
  expect(sql).toContain("old.location_id is distinct from new.location_id");
  expect(sql).toContain("old.field_id is distinct from new.field_id");
});

test("assigned recipients, preferences, notification, and idempotency remain server-owned", () => {
  const sql = migration();
  expect(sql).toContain("assigned_crew_member_id is not null");
  expect(sql).toContain("select profile_id into v_recipient_profile_id from public.crew_members");
  expect(sql).toContain("public.enqueue_profile_communication");
  expect(sql).toContain("public.create_notification");
  expect(sql).toContain("communication_event_id=v_event.id and channel='in_app' and status='pending'");
  expect(sql).toContain("to_char(v_changed_at,'YYYYMMDDHH24MISSUS')");
  expect(sql).not.toMatch(/recipient_email|p_recipient_profile_id|p_recipient_email/);
  expect(sql).toMatch(/revoke all on function public\.update_game_operational_details[\s\S]*from public,anon,authenticated/);
  expect(sql).toContain("grant execute on function public.update_game_operational_details");
});

test("no-change saves retain updated_at and produce no trigger changes", () => {
  const sql = migration();
  expect(sql).toContain("is distinct from row(game_date,game_time,location_id,field_id,lifecycle_status)");
  expect(sql).toContain("then clock_timestamp() else updated_at end");
});

test("game-change email renders changed values and complete assigned-game facts", async () => {
  const { renderCommunicationEmail } = await sharedTemplate();
  const base = {
    recipient_display_name: "Test UmpireOne", game_id: "game-1",
    organization_settings: { level_aliases: { "8U": "Pinto" } },
    metadata: {
      gameDisplay: "2026-S-LSYB-8U-0112", level: "8U", date: "2026-08-12", time: "19:30",
      location: "Lake Shore Athletic Complex", field: "Field 6", position: "Plate",
      changeLabel: "Time", oldValue: "6:00 PM", newValue: "7:30 PM", actionPath: "my-schedule"
    }
  };
  const changed = renderCommunicationEmail({ ...base, event_type: "game-time-changed" });
  expect(changed.subject).toBe("The Slate — Game Time Changed");
  expect(changed.text).toContain("The game below has been updated.");
  expect(changed.text).toContain("Time changed from:\n6:00 PM\n\nto\n\n7:30 PM");
  expect(changed.text).toContain("Game: 2026-S-LSYB-8U-0112");
  expect(changed.text).toContain("Division: Pinto");
  expect(changed.text).toContain("Time: 7:30 PM");
  expect(changed.text).toContain("Location: Lake Shore Athletic Complex");
  expect(changed.text).toContain("Field: Field 6");
  expect(changed.text).toContain("Assignment: U1");
  expect(changed.html).toContain("↓");
  expect(renderCommunicationEmail({ ...base, event_type: "game-cancelled" }).subject).toBe("The Slate — Game Cancelled");
  expect(renderCommunicationEmail({ ...base, event_type: "game-restored" }).text).toContain("has been restored");
});

const hostedScenario = {
  profile: { id: "profile-admin", auth_user_id: "auth-admin", organization_id: "organization-1", first_name: "Admin", last_name: "User", email: "admin@example.com", role: "administrator", status: "approved", communication_preferences: {} },
  crewId: null,
  locations: [
    { id: "location-old", organization_id: "organization-1", name: "Old Complex", active: true },
    { id: "location-new", organization_id: "organization-1", name: "New Complex", active: true }
  ],
  fields: [
    { id: "field-old", organization_id: "organization-1", location_id: "location-old", name: "Field 3", active: true },
    { id: "field-new", organization_id: "organization-1", location_id: "location-new", name: "Field 6", active: true }
  ],
  games: [{ id: "game-change", organization_id: "organization-1", season_id: "season-1", location_id: "location-old", field_id: "field-old", game_date: "2099-08-12", game_time: "18:00:00", timezone: "America/New_York", home_team: "Home", away_team: "Away", level: "8U", game_type: "single", lifecycle_status: "scheduled", review: {}, report: {}, source_metadata: {} }],
  assignments: [{ id: "assignment-change", organization_id: "organization-1", game_id: "game-change", position: "Plate", status: "assigned", assigned_crew_member_id: "crew-umpire", locked: false }],
  crewMembers: [{ id: "crew-umpire", organization_id: "organization-1", profile_id: "profile-umpire", first_name: "Test", last_name: "UmpireOne", email: "umpire@example.com", active: true, eligible_levels: ["8U"], preferences: {} }],
  claims: [], notifications: [], activities: []
};

hostedTest.describe("Milestone 7.4 hosted mutation", () => {
  hostedTest.use({ supabaseScenario: hostedScenario });
  hostedTest("persists date, time, complex, and field through the trusted RPC and refreshes", async ({ supabaseAuthApp }) => {
    const result = await supabaseAuthApp.page.evaluate(async () => {
      await loginService.loginWithPassword("admin@example.com", "password");
      return gameService.updateHostedOperationalDetails("game-change", {
        date: "2099-08-13", time: "19:30", locationComplex: "New Complex", locationField: "Field 6", field: "Field 6"
      });
    });
    expect(result.success).toBe(true);
    const rpc = (await supabaseAuthApp.calls()).find(call => call.name === "update_game_operational_details");
    expect(rpc.args).toMatchObject({
      p_game_id: "game-change", p_game_date: "2099-08-13", p_game_time: "19:30",
      p_location_id: "location-new", p_field_id: "field-new"
    });
    const game = await supabaseAuthApp.page.evaluate(() => gameService.getById("game-change"));
    expect(game).toMatchObject({ date: "2099-08-13", time: "19:30", locationComplex: "New Complex", locationField: "Field 6" });
  });
});
