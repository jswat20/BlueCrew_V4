import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const migrationPath = path.join(process.cwd(), "supabase", "migrations", "20261123003820_secure_active_workspace_context.sql");

test("active workspace migration validates membership and keeps context server-owned", () => {
  const sql = fs.readFileSync(migrationPath, "utf8");
  expect(sql).toContain("create table public.user_workspace_contexts");
  expect(sql).toContain("revoke all on public.user_workspace_contexts from public, anon, authenticated");
  expect(sql).toContain("m.auth_user_id = v_auth_user_id");
  expect(sql).toContain("m.status = 'approved'");
  expect(sql).toContain("p.status = 'approved'");
  expect(sql).toContain("workspace_membership_required");
  expect(sql).toContain("organization_memberships_invalidate_active_context");
  expect(sql).not.toMatch(/grant\s+(?:insert|update|delete|all).*user_workspace_contexts.*authenticated/i);
  expect(sql).not.toMatch(/grant\s+execute\s+on\s+function\s+private\.valid_workspace_organization\(uuid\)\s+to\s+authenticated/i);
});

test("legacy identity helpers resolve through the validated active workspace", () => {
  const sql = fs.readFileSync(migrationPath, "utf8");
  expect(sql).toContain("create or replace function public.current_organization_id()");
  expect(sql).toContain("private.valid_workspace_organization((select auth.uid()))");
  expect(sql).toContain("private.single_valid_workspace_organization((select auth.uid()))");
  expect(sql).toContain("p.organization_id = public.current_organization_id()");
  expect(sql).toContain("profiles_organization_auth_user_key unique (organization_id, auth_user_id)");
});
