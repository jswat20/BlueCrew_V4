const { test, expect } = require("@playwright/test");
const { readFileSync } = require("node:fs");

const sql = readFileSync(
  "supabase/migrations/202609100001_authoritative_schedule_game_delete.sql",
  "utf8"
);

test.describe("Authoritative hosted game deletion migration", () => {
  test("uses the established authenticated organization authorization model", () => {
    expect(sql).toContain("create or replace function public.delete_schedule_game(p_game_id uuid)");
    expect(sql).toContain("v_organization_id uuid := public.current_organization_id()");
    expect(sql).toContain("v_profile_id uuid := public.current_profile_id()");
    expect(sql).toContain("auth.uid() is null");
    expect(sql).toContain("not public.is_assigner_or_administrator()");
    expect(sql).toMatch(/where id = p_game_id\s+and organization_id = v_organization_id\s+for update/);
  });

  test("is security-definer with pinned search path and least-privilege execution", () => {
    expect(sql).toMatch(/security definer\s+set search_path = pg_catalog, public/i);
    expect(sql).toContain("revoke all on function public.delete_schedule_game(uuid) from public, anon, authenticated");
    expect(sql).toContain("grant execute on function public.delete_schedule_game(uuid) to authenticated");
    expect(sql).not.toMatch(/grant execute[\s\S]*to (public|anon)/i);
  });

  test("returns explicit affected counts and relies on the existing cascade contract", () => {
    expect(sql).toContain("'status', 'deleted'");
    expect(sql).toContain("'deleted', true");
    expect(sql).toContain("'deletedGameCount', v_deleted_count");
    expect(sql).toContain("'deletedAssignmentCount', v_assignment_count");
    expect(sql).toContain("'deletedClaimCount', v_claim_count");
    expect(sql).toMatch(/delete from public\.games\s+where id = v_game\.id\s+and organization_id = v_organization_id/);
    expect(sql).not.toMatch(/delete from public\.(game_assignments|assignment_claims)/);
  });
});
