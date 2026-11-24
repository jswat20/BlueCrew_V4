const fs = require("fs");
const { test, expect } = require("@playwright/test");

const migration = fs.readFileSync(
  "supabase/migrations/20261124003511_legacy_security_hardening.sql",
  "utf8",
);

test.describe("Increment 7A security hardening contract", () => {
  test("removes inherited and anonymous execution without weakening the public snapshot", () => {
    expect(migration).toContain("revoke execute on function %s from public");
    expect(migration).toContain("revoke execute on function %s from anon");
    expect(migration).toContain("p.oid <> 'public.get_public_tournament(uuid)'::regprocedure");
    expect(migration).toContain("grant execute on function public.get_public_tournament(uuid) to anon, authenticated");
  });

  test("locks down trigger and internal helper entry points", () => {
    for (const signature of [
      "assign_permanent_personnel_id()",
      "enforce_profile_photo_path()",
      "protect_notification_update()",
      "protect_profile_update()",
      "protect_requested_account_role()",
      "rls_auto_enable()",
      "sync_official_history_projection(uuid)",
      "validate_crew_profile_link()",
      "validate_field_reservation()",
      "create_notification(uuid, text, public.notification_audience, uuid, text, text, text)",
      "notify_organization_administrators(uuid, text, text, text, text)",
    ]) {
      expect(migration).toContain(`revoke execute on function public.${signature} from authenticated`);
    }
  });

  test("fixes mutable search paths and documents RPC-owned tables", () => {
    for (const name of ["is_administrator", "is_assigner_or_administrator", "is_approved_account", "set_updated_at"]) {
      expect(migration).toContain(`alter function public.${name}() set search_path = pg_catalog, public`);
    }
    for (const table of ["message_deletions", "personnel_id_counters", "user_workspace_contexts"]) {
      expect(migration).toContain(`${table}_no_direct_access`);
      expect(migration).toContain("using (false) with check (false)");
    }
  });
});
