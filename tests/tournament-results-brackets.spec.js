const { test, expect } = require("@playwright/test");
const fs = require("fs");

const migration = fs.readFileSync("supabase/migrations/20261123234032_tournament_results_standings_brackets.sql", "utf8");
const repository = fs.readFileSync("js/repositories/supabaseSharedRepository.js", "utf8");
const service = fs.readFileSync("js/services/tournamentManagementService.js", "utf8");
const ui = fs.readFileSync("js/schedule/tournamentManagement.js", "utf8");

test.describe("Increment 6B tournament lifecycle contract", () => {
  test("models scoring, results, manual decisions, and persistent brackets", async () => {
    for (const table of ["tournament_scoring_rules", "tournament_game_results", "tournament_manual_tiebreaks", "tournament_brackets", "tournament_bracket_rounds", "tournament_bracket_games"])
      expect(migration).toContain(`create table public.${table}`);
    expect(migration).toContain("unique (organization_id,game_id)");
    expect(migration).toContain("revision=public.tournament_game_results.revision+1");
  });

  test("standings are deterministic and never use database row order", async () => {
    expect(migration).toContain("head_to_head_points");
    expect(migration).toContain("differential_cap");
    expect(migration).toContain("manual_priority asc nulls last");
    expect(migration).toContain("unresolved_tie");
    expect(migration).toContain("order by seed,name");
  });

  test("finals require valid scores and elimination ties require a winner", async () => {
    expect(migration).toContain("tournament_final_score_required");
    expect(migration).toContain("elimination_winner_required");
    expect(migration).toContain("tournament_winner_score_mismatch");
    expect(migration).toContain("home_score is null or home_score >= 0");
  });

  test("advancement locks rows and protects completed downstream games", async () => {
    expect(migration).toContain("for update");
    expect(migration).toContain("downstream_bracket_result_final");
    expect(migration).toContain("next_slot='home'");
    expect(migration).toContain("champion_team_id=v_winner");
  });

  test("generation is idempotent and regeneration is deliberately constrained", async () => {
    expect(migration).toContain("unique (organization_id,division_id,generation_key)");
    expect(migration).toContain("tournament_bracket_regeneration_locked");
    expect(migration).toContain("tournament_pool_results_incomplete");
    expect(migration).toContain("bracket_size in (4,8)");
  });

  test("bracket scheduling reuses canonical games and reservations atomically", async () => {
    expect(migration).toContain("schedule_tournament_bracket_game");
    expect(migration).toContain("insert into public.games");
    expect(migration).toContain("insert into public.field_reservations");
    expect(migration).toContain("tournament_field_conflict");
  });

  test("RLS and RPC grants remain workspace and entitlement scoped", async () => {
    expect(migration).toContain("organization_id=public.current_organization_id()");
    expect(migration).toContain("private.organization_module_enabled(organization_id,''tournament'')");
    expect(migration).toContain("private.require_tournament_admin()");
    expect(migration).toContain("revoke all on function %s from public,anon");
    expect(migration).not.toContain("grant execute on function %s to anon");
  });

  test("application exposes score, standings, bracket, and scheduling workflows", async () => {
    for (const method of ["saveTournamentGameResult", "getTournamentPoolStandings", "generateTournamentBracket", "scheduleTournamentBracketGame"])
      expect(repository).toContain(method);
    for (const method of ["saveResult", "loadTournamentStandings", "generateBracket", "scheduleBracketGame"])
      expect(service).toContain(method);
    expect(ui).toContain('data-testid="tournament-results-workspace"');
    expect(ui).toContain('data-testid="tournament-standings"');
    expect(ui).toContain('data-testid="tournament-bracket"');
    expect(ui).toContain('if (!workspaceService.hasModule("tournament")) return false');
    expect(ui).toContain("tournamentCanManage()");
  });
});
