import { test, expect } from "./fixtures/supabase-auth.fixture.js";

const aliases = { "6U": "Clinic", "8U": "Pinto", "10U": "Mustang", "12U": "Bronco", "14U": "Pony", "16U": "Colt" };
const profile = { id: "profile-level", auth_user_id: "auth-level", organization_id: "organization-level", first_name: "Level", last_name: "Umpire", email: "level@example.com", role: "umpire", status: "approved", communication_preferences: {} };
const crew = { id: "crew-level", organization_id: profile.organization_id, profile_id: profile.id, first_name: "Level", last_name: "Umpire", email: profile.email, active: true, eligible_levels: ["12U"], preferences: {} };
const game = { id: "game-level", organization_id: profile.organization_id, season_id: "season-level", location_id: "location-level", field_id: "field-level", game_date: "2099-10-01", game_time: "18:00:00", home_team: "Home", away_team: "Away", level: "12U", game_type: "single", lifecycle_status: "scheduled", review: {}, report: {}, source_metadata: {} };
const scenario = { profile, crewId: crew.id, organization: { id: profile.organization_id, name: "Lake Shore", slug: "lake-shore", timezone: "America/New_York", settings: { level_aliases: aliases } }, crewMembers: [crew], games: [game], assignments: [{ id: "assignment-level", organization_id: profile.organization_id, game_id: game.id, position: "Plate", status: "open_for_claim", assigned_crew_member_id: null, locked: false }], locations: [{ id: "location-level", organization_id: profile.organization_id, name: "Complex", active: true }], fields: [{ id: "field-level", organization_id: profile.organization_id, location_id: "location-level", name: "Field 1", active: true }] };

test.describe("Organization level terminology", () => {
  test.use({ supabaseScenario: scenario });

  test("Lake Shore displays canonical levels with aliases while retaining canonical game data", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    const result = await page.evaluate(async () => {
      await loginService.loginWithPassword("level@example.com", "password");
      renderPage("claim-games");
      return { stored: gameService.getById("game-level").level, formatted: levelTerminologyService.format("12U") };
    });
    expect(result).toEqual({ stored: "12U", formatted: "12U - Bronco" });
    await expect(page.getByTestId(`claim-game-row-${game.id}`)).toContainText("12U - Bronco");
  });

  test("canonical and alias checkboxes synchronize and persist one canonical value", async ({ supabaseAuthApp }) => {
    const result = await supabaseAuthApp.page.evaluate(async () => {
      await loginService.loginWithPassword("level@example.com", "password");
      document.body.insertAdjacentHTML("beforeend", '<input class="crew-level-checkbox" value="12U" data-canonical="12U"><input class="crew-level-checkbox" value="Bronco" data-canonical="12U">');
      const canonical = document.querySelector('.crew-level-checkbox[value="12U"]');
      const alias = document.querySelector('.crew-level-checkbox[value="Bronco"]');
      alias.checked = true; levelTerminologyService.synchronizeCheckbox(alias);
      const checked = [canonical.checked, alias.checked];
      const persisted = crewService.toHostedChanges({ levels: [canonical.value, alias.value] }).eligible_levels;
      canonical.checked = false; levelTerminologyService.synchronizeCheckbox(canonical);
      return { checked, unchecked: [canonical.checked, alias.checked], persisted };
    });
    expect(result).toEqual({ checked: [true, true], unchecked: [false, false], persisted: ["12U"] });
  });

  test("Select All selects canonical levels and every configured partner without duplicates", async ({ supabaseAuthApp }) => {
    const result = await supabaseAuthApp.page.evaluate(async () => {
      await loginService.loginWithPassword("level@example.com", "password");
      const holder = document.createElement("div");
      levelTerminologyService.checkboxOptions(settings.levels).forEach(option => {
        const input = document.createElement("input"); input.type = "checkbox"; input.className = "crew-level-checkbox"; input.value = option.value; input.dataset.canonical = option.canonical; holder.appendChild(input);
      });
      document.body.appendChild(holder);
      toggleCrewLevels(true);
      return {
        allChecked: [...document.querySelectorAll(".crew-level-checkbox")].every(input => input.checked),
        persisted: levelTerminologyService.normalizeLevels([...document.querySelectorAll(".crew-level-checkbox:checked")].map(input => input.value))
      };
    });
    expect(result.allChecked).toBe(true);
    expect(new Set(result.persisted).size).toBe(result.persisted.length);
    expect(result.persisted).toContain("12U");
    expect(result.persisted).not.toContain("Bronco");
  });

  test("aliases canonicalize schedule imports but never bypass unsupported eligibility", async ({ supabaseAuthApp }) => {
    const result = await supabaseAuthApp.page.evaluate(async () => {
      await loginService.loginWithPassword("level@example.com", "password");
      return {
        imported: scheduleImportService.preview('date,time,away,home,level\n2099-10-02,6:00 PM,Away,Home,Bronco').games[0].level,
        supported: crewService.canWorkLevel(crewService.getById("crew-level"), "Bronco"),
        unsupported: crewService.canWorkLevel(crewService.getById("crew-level"), "Pinto")
      };
    });
    expect(result).toEqual({ imported: "12U", supported: true, unsupported: false });
  });
});

test("other organizations do not receive Lake Shore terminology", async ({ supabaseAuthApp }) => {
  const result = await supabaseAuthApp.page.evaluate(async () => {
    await loginService.loginWithPassword("linked@example.com", "password");
    return { display: levelTerminologyService.format("12U"), canonical: levelTerminologyService.canonicalize("Bronco") };
  });
  expect(result).toEqual({ display: "12U", canonical: "Bronco" });
});
