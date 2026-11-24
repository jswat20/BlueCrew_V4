const { test, expect } = require("@playwright/test");
const fs = require("fs");

const migration = fs.readFileSync("supabase/migrations/20261124000537_tournament_publishing_game_day_operations.sql", "utf8");
const repository = fs.readFileSync("js/repositories/supabaseSharedRepository.js", "utf8");
const service = fs.readFileSync("js/services/tournamentManagementService.js", "utf8");
const ui = fs.readFileSync("js/schedule/tournamentManagement.js", "utf8");
const app = fs.readFileSync("app.js", "utf8");

test.describe("Increment 6C tournament publishing and game-day contract", () => {
  test("publishing is explicit, opaque, revocable, and table-private", async () => {
    expect(migration).toContain("create table public.tournament_publications");
    expect(migration).toContain("share_token uuid not null default gen_random_uuid()");
    expect(migration).toContain("where pub.share_token=p_share_token and pub.published");
    expect(migration).toContain("revoke all on public.tournament_publications from public,anon");
    expect(migration).toContain("grant execute on function public.get_public_tournament(uuid) to anon,authenticated");
  });

  test("public response is allowlisted and excludes private fields", async () => {
    const publicFunction = migration.slice(migration.indexOf("create or replace function public.get_public_tournament(p_share_token"), migration.indexOf("-- Public standings variant"));
    for (const safe of ["'tournament'", "'divisions'", "'teams'", "'games'", "'standings'", "'brackets'"]) expect(publicFunction).toContain(safe);
    for (const privateField of ["contact_email", "contact_phone", "contact_name", "workspace_audit_events", "auth_user_id"]) expect(publicFunction).not.toContain(privateField);
  });

  test("rescheduling preserves identity and updates reservations transactionally", async () => {
    expect(migration).toContain("where organization_id=v_org and id=p_game_id returning * into v_game");
    expect(migration).toContain("update public.field_reservations set field_id=p_field_id,starts_at=v_start,ends_at=v_end");
    expect(migration).toContain("tournament_final_game_locked");
    expect(migration).toContain("when exclusion_violation or unique_violation then raise exception");
    expect(migration).not.toContain("delete from public.games");
  });

  test("bye advancement is idempotent and creates no games or reservations", async () => {
    const bye = migration.slice(migration.indexOf("create or replace function public.advance_tournament_byes"), migration.indexOf("revoke all on function public.set_tournament_publication"));
    expect(bye).toContain("winner_team_id is null");
    expect(bye).toContain("(home_team_id is null)<>(away_team_id is null)");
    expect(bye).toContain("tournament.bye_advanced");
    expect(bye).not.toContain("insert into public.games");
    expect(bye).not.toContain("insert into public.field_reservations");
  });

  test("application exposes publishing, operations, mobile scoring, rescheduling, and export", async () => {
    for (const method of ["setTournamentPublication", "getPublicTournament", "rescheduleTournamentGame", "transitionTournamentGame", "advanceTournamentByes"]) expect(repository).toContain(method);
    for (const method of ["setPublication", "rescheduleGame", "transitionGame"]) expect(service).toContain(method);
    for (const marker of ["tournament-game-day", "tournament-publish", "tournament-reschedule-form", "exportTournamentSchedule", "renderPublicTournamentPage"]) expect(ui).toContain(marker);
    expect(app).toContain('get("tournament")');
  });
});
