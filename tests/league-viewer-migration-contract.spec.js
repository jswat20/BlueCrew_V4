const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const roleSql = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "202608270001_league_viewer_role.sql"), "utf8");
const scopeSql = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "202608270002_league_viewer_scope_and_rls.sql"), "utf8");

test.describe("League Viewer migration contract", () => {
  test("adds the role separately from dependent objects", () => {
    expect(roleSql).toContain("add value if not exists 'league_viewer'");
    expect(scopeSql).toContain("create table public.league_viewer_scopes");
    expect(scopeSql).toContain("when 'league_viewer' then 'LVW'");
  });

  test("supports all-division and selected-division scope", () => {
    expect(scopeSql).toContain("all_divisions boolean");
    expect(scopeSql).toContain("division_levels text[]");
    expect(scopeSql).toContain("crew.eligible_levels && scope.division_levels");
    expect(scopeSql).toContain("assignment.assigned_crew_member_id = crew.id");
    expect(scopeSql).toContain("scope.all_divisions or p_level = any(scope.division_levels)");
  });

  test("constrains profiles, crew, games, assignments, and photos", () => {
    for (const contract of ["profiles_select_league_viewer", "league_viewer_can_view_profile", "league_viewer_can_view_crew", "league_viewer_can_view_level", "profile_photos_select_league_viewer"]) expect(scopeSql).toContain(contract);
    expect(scopeSql).toContain("target.organization_id = viewer.organization_id");
    expect(scopeSql).toContain("public.current_account_role() = 'league_viewer'");
  });

  test("preserves read-only enforcement for self profile and photo paths", () => {
    expect(scopeSql.match(/public\.current_account_role\(\) <> 'league_viewer'/g)?.length).toBeGreaterThanOrEqual(6);
    expect(scopeSql).not.toMatch(/profile_photos_(insert|update|delete)_league_viewer/);
    expect(scopeSql).toContain("activities_insert_member");
    expect(scopeSql).toContain("notifications_update_recipient");
  });
});
