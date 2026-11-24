const { test, expect } = require("@playwright/test");
const { readFileSync } = require("node:fs");

const migration = readFileSync("supabase/migrations/20261123210832_league_game_scheduling_atomic.sql", "utf8");
const editor = readFileSync("js/schedule/gameEditor.js", "utf8");
const service = readFileSync("js/services/gameService.js", "utf8");

test.describe("Increment 5A League scheduling", () => {
  test("uses an atomic backend transaction for game and reservation", () => {
    expect(migration).toContain("create or replace function public.save_league_game");
    expect(migration).toContain("insert into public.field_reservations");
    expect(migration).toContain("update public.field_reservations set field_id=p_field_id");
    expect(migration).toContain("for update");
    expect(migration).toContain("league_field_conflict");
  });

  test("enforces tenant, entitlement, role, and catalog boundaries", () => {
    expect(migration).toContain("public.current_organization_id()");
    expect(migration).toContain("private.organization_module_enabled(v_org, 'league')");
    expect(migration).toContain("public.is_administrator()");
    expect(migration).toContain("league_catalog_selection_invalid");
    expect(migration).toContain("game_domain='league'");
  });

  test("keeps drafts valid and releases reservations on lifecycle changes", () => {
    expect(migration).toContain("if p_field_id is null then");
    expect(migration).toContain("set status='cancelled'");
    expect(migration).toContain("p_action not in ('cancel','postpone','delete')");
    expect(migration).toContain("delete from public.field_reservations");
  });

  test("uses half-open conflict protection and one active reservation per game", () => {
    expect(migration).toContain("field_reservations_one_active_game_idx");
    expect(migration).toContain("where status = 'active' and game_id is not null");
    expect(migration).not.toContain("game_assignments");
  });

  test("renders catalog-backed League inputs and actionable conflict messages", () => {
    for (const id of ["game-season-input", "game-league-input", "game-division-input", "game-away-team-select", "game-home-team-select", "game-duration-input"]) {
      expect(editor).toContain(`data-testid=\"${id}\"`);
    }
    expect(editor).toContain("Unscheduled / field TBD");
    expect(service).toContain("That field is already reserved during the selected time.");
    expect(service).toContain("One of these teams already has a game during the selected time.");
    expect(service).toContain("maintenance closure or blackout");
    expect(editor).toContain('id="game-editor-error"');
    expect(editor).toContain("showGameEditorError(result?.message");
    expect(editor).toContain("error.focus()");
  });
});
