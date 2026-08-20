import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";

test("reservation migration is position-specific, concurrency-safe, and non-destructive", () => {
  const migration = readFileSync("supabase/migrations/202608200001_exclusive_pending_claim_reservations.sql", "utf8");
  expect(migration).toContain("assignment_claims_one_pending_per_assignment");
  expect(migration).toContain("on public.assignment_claims (organization_id, assignment_id)");
  expect(migration).toContain("where status = 'pending'");
  expect(migration).toContain("for update");
  expect(migration).toContain("pg_advisory_xact_lock");
  expect(migration).toContain("claim_schedule_conflict");
  expect(migration).toContain("claim_daily_limit_reached");
  expect(migration).toContain("assignment_position_reserved");
  expect(migration).toContain("pending_claim_reservation_duplicates_require_reconciliation");
  expect(migration).toContain("having count(*) > 1");
  expect(migration).not.toMatch(/delete\s+from\s+public\.assignment_claims/i);
});
