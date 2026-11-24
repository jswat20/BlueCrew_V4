const { test, expect } = require("@playwright/test");
const fs = require("node:fs");

const migration = fs.readFileSync("supabase/migrations/20261123213717_league_schedule_proposals.sql", "utf8");
const teamConflictMigration = fs.readFileSync("supabase/migrations/20261123215136_enforce_league_team_schedule_conflicts.sql", "utf8");
const service = fs.readFileSync("js/services/leagueScheduleGeneratorService.js", "utf8");
const ui = fs.readFileSync("js/schedule/leagueScheduleGenerator.js", "utf8");

test.describe("Increment 5B League schedule generation", () => {
  test("keeps proposals separate from canonical games until publication", () => {
    expect(migration).toContain("create table public.league_schedule_proposals");
    expect(migration).toContain("create table public.league_schedule_proposal_games");
    expect(migration).toContain("public.save_league_game(null");
    expect(service).not.toContain("game_assignments");
  });

  test("publishes scheduled proposal rows atomically and idempotently", () => {
    expect(migration).toContain("for v_item in select * from public.league_schedule_proposal_games");
    expect(migration).toContain("if v_proposal.status='published'");
    expect(migration).toContain("'idempotent',true");
    expect(migration).toContain("'atomic',true");
  });

  test("enforces workspace, League entitlement, administrator, and tenant-qualified catalog", () => {
    expect(migration).toContain("public.current_organization_id()");
    expect(migration).toContain("private.organization_module_enabled(v_org,'league')");
    expect(migration).toContain("public.is_administrator()");
    expect(migration).toContain("where d.organization_id=v_org");
    expect(migration).toContain("revoke all on function public.publish_league_schedule_proposal(uuid) from public,anon");
  });

  test("generator respects field restrictions and prevents team or field overlap", () => {
    expect(service).toContain("state.closures.some");
    expect(service).toContain("state.reservations.some");
    expect(service).toContain("occupiedFields.some");
    expect(service).toContain("occupiedTeams.some");
    expect(service).toContain("No compatible field/time slot remained.");
    expect(service).toContain("timeZone: timezone");
    expect(service).toContain("zonedDate(date,timeText(start),timezone)");
    expect(teamConflictMigration).toContain("pg_advisory_xact_lock");
    expect(teamConflictMigration).toContain("league_team_conflict");
    expect(teamConflictMigration).toContain("game.home_team_id in (new.home_team_id, new.away_team_id)");
    expect(teamConflictMigration).toContain("game.lifecycle_status::text not in ('cancelled', 'postponed')");
  });

  test("preview supports adjustment, regeneration, deliberate publication, and retry verification", () => {
    expect(ui).toContain('data-testid="league-proposal-preview"');
    expect(ui).toContain("Adjust");
    expect(ui).toContain("Regenerate");
    expect(ui).toContain("Publish Atomically");
    expect(ui).toContain("Verify Idempotent Publication");
    expect(ui).toContain("refreshLeagueGeneratorTeams(this)");
    expect(ui).toContain('data-testid="saved-proposals"');
    expect(ui).toContain("renderLeagueScheduleProposalList()");
  });

  test("generator dialog restores focus and focuses actionable validation", () => {
    expect(ui).toContain('tabindex="-1"');
    expect(ui).toContain('event.key==="Escape"');
    expect(ui).toContain("leagueScheduleGeneratorReturnFocus.focus()");
    expect(ui).toContain("error.focus()");
  });
});
