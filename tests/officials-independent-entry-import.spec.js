import { readFileSync } from "node:fs";
import { expect, test } from "./fixtures/supabase-auth.fixture.js";

const migration = readFileSync(
  "supabase/migrations/20261123013654_close_increment_4c_officials_independence.sql",
  "utf8"
);
const legacyIdMigration = readFileSync(
  "supabase/migrations/20261123015157_qualify_game_legacy_ids_by_domain.sql",
  "utf8"
);

const administrator = {
  id: "profile-officials-independent-admin",
  auth_user_id: "auth-officials-independent-admin",
  organization_id: "organization-1",
  first_name: "Officials",
  last_name: "Administrator",
  email: "officials-independent@example.com",
  role: "administrator",
  status: "approved",
  communication_preferences: {}
};

test.describe("Officials-only game entry and import", () => {
  test.use({
    supabaseScenario: {
      profile: administrator,
      locations: [],
      fields: [],
      games: [],
      assignments: []
    }
  });

  test("database import no longer requires league seasons or exact facility mapping", () => {
    expect(migration).not.toContain("schedule_import_active_season_required");
    expect(migration).not.toContain("schedule_import_unknown_location");
    expect(migration).not.toContain("schedule_import_unknown_field");
    expect(migration).toContain("game_domain, sport, season_id");
    expect(migration).toContain("v_org, 'officials', v_sport, null");
    expect(migration).toContain("private.organization_module_enabled(v_org, 'umpire')");
    expect(legacyIdMigration).toContain("unique (organization_id, game_domain, legacy_game_id)");
  });

  test("administrator creates an Officials game with descriptive location and two staffing positions", async ({ supabaseAuthApp }) => {
    const { page, calls } = supabaseAuthApp;
    await page.evaluate(async () => loginService.loginWithPassword("officials-independent@example.com", "password"));
    await page.evaluate(() => renderPage("schedule"));
    await page.getByTestId("add-game").click();

    await page.getByTestId("game-sport-input").fill("Softball");
    await page.getByTestId("game-date-input").fill("2099-05-10");
    await page.getByTestId("game-time-input").selectOption("6:00 PM");
    await page.getByTestId("game-matchup-description-input").fill("Officials-only showcase");
    await page.getByTestId("game-location-name-input").fill("North Park — field pending");
    await page.getByTestId("game-type-input").selectOption("twoMan");
    await page.getByTestId("game-notes-input").fill("Synthetic acceptance record");
    await page.getByTestId("save-game-button").click();

    const rpc = (await calls()).find(call => call.name === "import_schedule_games");
    expect(rpc).toBeTruthy();
    expect(rpc.args.p_games[0]).toMatchObject({
      sport: "Softball",
      matchupDescription: "Officials-only showcase",
      locationName: "North Park — field pending",
      positions: ["Plate", "Base"]
    });
    const persisted = await page.evaluate(() => ({
      game: window.__supabaseFixture.settings.games[0],
      positions: window.__supabaseFixture.settings.assignments.map(item => item.position)
    }));
    expect(persisted.game).toMatchObject({
      game_domain: "officials",
      season_id: null,
      location_id: null,
      field_id: null,
      location_name: "North Park — field pending"
    });
    expect(persisted.positions).toEqual(["Plate", "Base"]);
  });

  test("CSV import accepts matchup text and incomplete location without league records", async ({ supabaseAuthApp }) => {
    const { page, calls } = supabaseAuthApp;
    await page.evaluate(async () => loginService.loginWithPassword("officials-independent@example.com", "password"));
    const result = await page.evaluate(async () => {
      const preview = scheduleImportService.preview([
        "date,time,matchupDescription,sport,locationText,officialsRequested,notes,externalGameId",
        "2099-05-11,7:00 PM,Imported showcase,Softball,East Field TBD,3,Synthetic import,officials-only-import-1"
      ].join("\n"));
      const imported = await gameService.importSchedule(preview.games);
      return { preview, imported };
    });

    expect(result.preview).toMatchObject({ success: true, validRows: 1, invalidRows: 0 });
    expect(result.imported.success).toBe(true);
    const rpc = (await calls()).find(call => call.name === "import_schedule_games");
    expect(rpc.args.p_games[0]).toMatchObject({
      matchupDescription: "Imported showcase",
      sport: "Softball",
      locationName: "East Field TBD",
      positions: ["Plate", "Base", "U3"]
    });
  });
});
