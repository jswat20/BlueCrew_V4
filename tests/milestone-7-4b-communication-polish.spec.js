const { test, expect } = require("@playwright/test");
const { readFileSync } = require("node:fs");
const { pathToFileURL } = require("node:url");
const path = require("node:path");
const { test: hostedTest } = require("./fixtures/supabase-auth.fixture");

const polishMigration = () => readFileSync("supabase/migrations/202608100001_game_change_communication_polish.sql", "utf8");
const sharedTemplate = () => import(pathToFileURL(path.resolve("supabase/functions/_shared/communication-template.mjs")).href);

test("7.4B keeps no-op detection inside the trusted operational RPC", () => {
  const sql = polishMigration();
  const earlyReturn = sql.indexOf("is not distinct from row(");
  const update = sql.indexOf("update public.games set");
  expect(earlyReturn).toBeGreaterThan(0);
  expect(earlyReturn).toBeLessThan(update);
  expect(sql).toContain("return v_game;");
  expect(sql).toContain("updated_at=clock_timestamp()");
});

test("7.4B rich hosted notification body uses the complete shared game presentation", () => {
  const sql = polishMigration();
  for (const value of [
    "Game: ", "Division: ", "Date: ", "Time: ", "Complex: ", "Field: ", "Assignment: ",
    "Game Time Changed", "Game Date Changed", "Field Changed", "Location Changed", "Game Cancelled", "Game Restored"
  ]) expect(sql).toContain(value);
  expect(sql).toContain("settings #>> array['level_aliases',new.level]");
  expect(sql).toContain("when 'Plate' then 'U1' when 'Base' then 'U2'");
  expect(sql).toContain("' → '");
});

test("7.4B email titles remain consistent with polished in-app titles", async () => {
  const { renderCommunicationEmail } = await sharedTemplate();
  const row = {
    recipient_display_name: "Test UmpireOne",
    organization_settings: { level_aliases: { "8U": "Pinto" } },
    metadata: {
      gameDisplay: "LSYB-020", level: "8U", divisionAlias: "Pinto", date: "2026-09-04", time: "18:30",
      location: "Staging Test Complex", field: "Field 1", position: "Plate", changeLabel: "Field",
      oldValue: "Field 8", newValue: "Field 1"
    }
  };
  expect(renderCommunicationEmail({ ...row, event_type: "game-field-changed" }).subject).toBe("The Slate — Field Changed");
  expect(renderCommunicationEmail({ ...row, event_type: "game-location-changed" }).subject).toBe("The Slate — Location Changed");
});

const scenario = {
  profile: { id: "profile-admin", auth_user_id: "auth-admin", organization_id: "organization-1", first_name: "Admin", last_name: "User", email: "admin@example.com", role: "administrator", status: "approved", communication_preferences: {} },
  crewId: null,
  locations: [{ id: "location-1", organization_id: "organization-1", name: "Test Complex", active: true }],
  fields: [{ id: "field-1", organization_id: "organization-1", location_id: "location-1", name: "Field 1", active: true }],
  games: [{ id: "game-polish", organization_id: "organization-1", season_id: "season-1", location_id: "location-1", field_id: "field-1", legacy_game_id: "LSYB-020", game_date: "2099-09-04", game_time: "18:30:00", timezone: "America/New_York", home_team: "Home", away_team: "Away", level: "8U", game_type: "single", lifecycle_status: "cancelled", updated_at: "2099-01-01T00:00:00.000Z", review: {}, report: {}, source_metadata: {} }],
  assignments: [{ id: "assignment-polish", organization_id: "organization-1", game_id: "game-polish", position: "Plate", status: "assigned", assigned_crew_member_id: "crew-umpire", locked: false }],
  crewMembers: [{ id: "crew-umpire", organization_id: "organization-1", profile_id: "profile-umpire", first_name: "Test", last_name: "UmpireOne", email: "umpire@example.com", active: true, eligible_levels: ["8U"], preferences: {} }],
  claims: [], notifications: [], activities: []
};

hostedTest.describe("Milestone 7.4B hosted presentation", () => {
  hostedTest.use({ supabaseScenario: scenario });

  hostedTest("rich in-app model matches email facts without matchup emphasis", async ({ supabaseAuthApp }) => {
    const model = await supabaseAuthApp.page.evaluate(async () => {
      await loginService.loginWithPassword("admin@example.com", "password");
      levelTerminologyService.configure({ "8U": "Pinto" });
      return communicationTemplateService.render({
        type: "game-time-changed", gameId: "game-polish", metadata: {
          gameDisplay: "LSYB-020", level: "8U", divisionAlias: "Pinto", date: "2099-09-04", time: "18:30",
          location: "Test Complex", field: "Field 1", position: "Plate",
          changeLabel: "Time", oldValue: "6:00 PM", newValue: "6:30 PM"
        }
      }, { displayName: "Test UmpireOne" });
    });
    expect(model.inAppTitle).toBe("Game Time Changed");
    for (const value of ["Game: LSYB-020", "Division: Pinto", "September 4, 2099", "Time: 6:30 PM", "Location: Test Complex", "Field: Field 1", "Assignment: U1", "Time changed\n6:00 PM → 6:30 PM"]) {
      expect(model.inAppSummary).toContain(value);
    }
    expect(model.inAppSummary).not.toContain("Away @ Home");
  });

  hostedTest("no-op hosted Save preserves updated_at", async ({ supabaseAuthApp }) => {
    const result = await supabaseAuthApp.page.evaluate(async () => {
      await loginService.loginWithPassword("admin@example.com", "password");
      const before = gameService.getById("game-polish");
      const response = await gameService.updateHostedOperationalDetails("game-polish", {
        date: before.date, time: before.time, locationComplex: before.locationComplex,
        locationField: before.locationField, field: before.locationField, lifecycleStatus: before.lifecycleStatus
      });
      return { response, before: before.updatedAt || before.updated_at, after: gameService.getById("game-polish").updatedAt || gameService.getById("game-polish").updated_at };
    });
    expect(result.response.success).toBe(true);
    expect(result.after).toBe(result.before);
  });

  hostedTest("cancelled lifecycle dominates assignment across presentation surfaces", async ({ supabaseAuthApp }) => {
    const output = await supabaseAuthApp.page.evaluate(async () => {
      await loginService.loginWithPassword("admin@example.com", "password");
      const game = gameService.getById("game-polish");
      const hub = portalService.getGameHub("game-polish");
      return {
        badge: renderAssignmentStatusBadge(game),
        schedule: renderGameCard(game),
        scheduleTable: renderAllGamesRow(game),
        hubAssignment: renderGameHubAssignmentBadge(hub),
        hubSummary: renderUmpireGameSummary(hub),
        crewSchedule: renderMyScheduleRow(hub),
        workbench: renderWorkbenchItem({ ...game, assignments: game.assignments || [] }, "needs-assignment", "polish-workbench"),
        operations: renderOperationsStaffingBoard([{ ...game, matchup: "Away @ Home", assignments: game.assignments || [] }], "2099-09-04")
      };
    });
    for (const html of Object.values(output)) expect(html).toContain("Cancelled");
    expect(output.badge).not.toContain("> Assigned<");
    expect(output.hubAssignment).not.toContain(">Assigned<");
    expect(output.hubSummary).not.toContain('data-testid="game-hub-assignment-badge">Assigned');
  });
});
