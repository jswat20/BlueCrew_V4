const {test,expect}=require("@playwright/test");
const fs=require("node:fs");
const migration=fs.readFileSync("supabase/migrations/20261123221924_tournament_pool_play_management.sql","utf8");
const service=fs.readFileSync("js/services/tournamentManagementService.js","utf8");
const ui=fs.readFileSync("js/schedule/tournamentManagement.js","utf8");
const auth=fs.readFileSync("js/services/supabaseAuthService.js","utf8");

test.describe("Increment 6A Tournament pool play",()=>{
  test("owns independent tournament catalog and participants",()=>{
    for(const table of ["tournaments","tournament_divisions","tournament_teams","tournament_pools","tournament_pool_memberships"])expect(migration).toContain(`create table public.${table}`);
    expect(migration).not.toContain("references public.leagues");
    expect(migration).not.toContain("references public.teams(");
  });
  test("enforces tenant, entitlement, administrator, and lifecycle boundaries",()=>{
    expect(migration).toContain("private.require_tournament_admin()");
    expect(migration).toContain("private.organization_module_enabled(v_org,'tournament')");
    expect(migration).toContain("public.is_administrator()");
    expect(migration).toContain("tournament_transition_invalid");
    expect(migration).toContain("enable row level security");
  });
  test("registers unique teams and validates pool membership",()=>{
    expect(migration).toContain("tournament_teams_active_name_idx");
    expect(migration).toContain("tournament_team_duplicate");
    expect(migration).toContain("tournament_pool_assignment_invalid");
    expect(migration).toContain("unique (organization_id,tournament_id,team_id)");
  });
  test("generates pool round robins without League or Officials dependencies",()=>{
    expect(service).toContain("function roundRobin(ids)");
    expect(service).toMatch(/state\.memberships\s*\.filter\(\(x\) => x\.pool_id === pool\.id\)/);
    expect(service).toContain("usedTeams.some");
    expect(service).toContain("usedFields.some");
    expect(service).not.toContain("assignmentService");
    expect(service).not.toContain("saveLeagueGame");
  });
  test("publishes Tournament games and reservations atomically and idempotently",()=>{
    expect(migration).toContain("private.create_tournament_game");
    expect(migration).toContain("'tournament'");
    expect(migration).toContain("insert into public.field_reservations");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("tournament_team_conflict");
    expect(migration).toContain("tournament_field_conflict");
    expect(migration).toContain("'idempotent',true");
    expect(migration).toContain("'atomic',true");
  });
  test("provides creation, registration, pool assignment, preview, edit, and publication UI",()=>{
    for(const text of ["Create Tournament","Register Team","Add Pool","Generate Pool-play Schedule","Adjust Proposed Game","Publish Atomically","Verify Idempotent Publication","Saved Proposals"])expect(ui).toContain(text);
    expect(ui).toContain('data-testid="tournament-manager"');
    expect(ui).toContain('data-testid="tournament-proposal-preview"');
  });
  test("closes Tournament UI before workspace scheduling state is cleared",()=>{
    const clearState=auth.slice(auth.indexOf("function clearSchedulingState()"),auth.indexOf("async function refreshScheduling()"));
    expect(clearState).toContain('typeof closeTournamentManager === "function"');
    expect(clearState.indexOf("closeTournamentManager()")).toBeLessThan(clearState.indexOf("tournamentManagementService?.clear?.()"));
  });
});
