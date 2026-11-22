import { readFileSync } from "node:fs";
import { test, expect } from "./fixtures/supabase-auth.fixture.js";

const migration = readFileSync("supabase/migrations/20261122195507_competition_catalog_foundation.sql", "utf8");
const administrator = {
  id: "profile-admin-catalog", auth_user_id: "auth-admin-catalog", organization_id: "organization-1",
  first_name: "Catalog", last_name: "Admin", email: "catalog-admin@example.test", phone: "",
  role: "administrator", status: "approved", communication_preferences: {}
};
const season = {
  id: "season-spring-2027", organization_id: "organization-1", name: "Spring 2027",
  starts_on: "2027-03-01", ends_on: "2027-06-30", active: true
};

test.describe("competition catalog administrator workflow", () => {
  test.use({ supabaseScenario: {
    profile: administrator,
    initialSession: true,
    seasons: [season],
    organizationSports: [{ id: "foreign-program", organization_id: "organization-2", sport_code: "baseball", display_name: "Hidden Baseball", active: true }],
    leagues: [{ id: "foreign-league", organization_id: "organization-2", organization_sport_id: "foreign-program", name: "Hidden League", slug: "hidden-league", active: true }],
    divisions: [{ id: "foreign-division", organization_id: "organization-2", league_id: "foreign-league", season_id: "foreign-season", name: "Hidden Division", code: "HIDDEN", active: true }],
    teams: [{ id: "foreign-team", organization_id: "organization-2", season_id: "foreign-season", division_id: "foreign-division", name: "Hidden Team", active: true }]
  } });

  test("creates a softball program, division, and team without exposing another organization", async ({ supabaseAuthApp }) => {
    const { page, calls } = supabaseAuthApp;
    await page.getByTestId("nav-settings").click();
    const catalog = page.getByTestId("settings-competition-catalog");
    await expect(catalog).toBeVisible();
    await expect(catalog).not.toContainText("Hidden Baseball");
    await expect(catalog).not.toContainText("Hidden Team");

    await page.getByTestId("add-competition-program").click();
    await page.getByTestId("competition-program-sport").selectOption("softball");
    await page.getByTestId("competition-program-name").fill("Lake Shore Softball");
    await page.getByTestId("competition-program-league").fill("Lake Shore Softball League");
    await page.getByTestId("competition-program-form").getByRole("button", { name: "Create Program" }).click();
    await expect(catalog).toContainText("Lake Shore Softball");

    await catalog.getByTestId("add-competition-division").click();
    await page.getByTestId("competition-division-name").fill("12U Softball");
    await page.getByTestId("competition-division-code").fill("12U-SB");
    await page.getByTestId("competition-division-min-age").fill("11");
    await page.getByTestId("competition-division-max-age").fill("12");
    await page.getByTestId("competition-division-form").getByRole("button", { name: "Create Division" }).click();
    await expect(catalog).toContainText("12U Softball");

    await catalog.getByTestId("add-competition-team").click();
    await page.getByTestId("competition-team-name").fill("Lake Shore Lightning");
    await page.getByTestId("competition-team-short-name").fill("Lightning");
    await page.getByTestId("competition-team-form").getByRole("button", { name: "Create Team" }).click();
    await expect(catalog.getByTestId("competition-team")).toHaveText("Lake Shore Lightning");

    const recorded = await calls();
    expect(recorded.find(call => call.operation === "rpc" && call.name === "create_competition_program")?.args).toEqual({
      p_sport_code: "softball", p_display_name: "Lake Shore Softball", p_league_name: "Lake Shore Softball League"
    });
    expect(recorded.some(call => call.operation === "rpc" && call.name === "create_competition_division" && call.args.p_season_id === season.id)).toBeTruthy();
    expect(recorded.some(call => call.operation === "rpc" && call.name === "create_competition_team" && call.args.p_name === "Lake Shore Lightning")).toBeTruthy();
  });
});

test.describe("competition catalog authorization", () => {
  test.use({ supabaseScenario: { initialSession: true, seasons: [season] } });

  test("rejects an umpire mutation even when called outside the hidden administrator UI", async ({ supabaseAuthApp }) => {
    const result = await supabaseAuthApp.page.evaluate(async () => {
      await leagueStructureService.loadCatalog();
      return leagueStructureService.createProgram({ sportCode: "softball", displayName: "Unauthorized", leagueName: "Unauthorized" });
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain("competition_catalog_administrator_required");
  });
});

test("competition catalog migration is tenant-qualified and fail-closed", () => {
  for (const table of ["organization_sports", "leagues", "divisions", "teams"]) {
    expect(migration).toContain(`create table public.${table}`);
    expect(migration).toContain(`alter table public.${table} enable row level security`);
    expect(migration).toMatch(new RegExp(`create policy ${table}_[\\s\\S]*?organization_id = \\(select public\\.current_organization_id\\(\\)\\)`, "i"));
  }
  expect(migration).toContain("foreign key (organization_id, organization_sport_id)");
  expect(migration).toContain("foreign key (organization_id, league_id)");
  expect(migration).toContain("foreign key (organization_id, division_id)");
  expect(migration).toContain("security invoker");
  expect(migration).toContain("competition_catalog_administrator_required");
  expect(migration).toContain("revoke all on public.sports, public.organization_sports, public.leagues, public.divisions, public.teams from anon");
});
