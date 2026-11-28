const { test, expect } = require("@playwright/test");
const { readFileSync } = require("node:fs");

const migration = readFileSync("supabase/migrations/20261128014005_operational_incident_alerting.sql", "utf8");
const scheduleMigration = readFileSync("supabase/migrations/20261128014137_schedule_operational_retention.sql", "utf8");
const indexMigration = readFileSync("supabase/migrations/20261128015005_index_operational_incident_actors.sql", "utf8");

test.describe("Increment 7J alerting and incident operations", () => {
  test("incidents are tenant-scoped, admin-only, deduplicated, and non-delivering", () => {
    expect(migration).toContain("operational_incidents_active_fingerprint_uidx");
    expect(migration).toContain("where status in ('open', 'acknowledged')");
    expect(migration).toContain("organization_id = (select public.current_organization_id())");
    expect(migration).toContain("workspace_administrator_required");
    expect(migration).toContain("delivery_state text not null default 'disabled'");
    expect(migration).not.toMatch(/net\.http|send_email|process_communication_deliveries/i);
  });

  test("expected business rejections cannot produce incidents", () => {
    expect(migration).toContain("and e.classification in ('operational_failure', 'security_signal')");
    expect(migration).not.toMatch(/classification in \([^)]*expected_rejection/);
  });

  test("retention job can only clean monitoring records", () => {
    const body = migration.match(/create or replace function private\.run_operational_retention\(\)[\s\S]*?\$\$;/i)?.[0] || "";
    expect(body).toContain("delete from public.operational_events");
    expect(body).toContain("delete from public.operational_incidents");
    expect(body).not.toContain("communication_deliveries");
    expect(scheduleMigration).toContain("'slate-operational-retention'");
    expect(scheduleMigration).toContain("select * from private.run_operational_retention()");
    expect(scheduleMigration).not.toContain("communication_deliveries");
  });

  test("incident actor foreign keys have covering indexes", () => {
    expect(indexMigration).toContain("operational_incidents_ack_profile_idx");
    expect(indexMigration).toContain("operational_incidents_recovery_profile_idx");
  });

  test("administrator UI supports evaluation, acknowledgement, and recovery", () => {
    const ui = readFileSync("js/ui/operationalMonitoring.js", "utf8");
    expect(ui).toContain('data-testid="monitoring-evaluate-alerts"');
    expect(ui).toContain('data-incident-action="acknowledge"');
    expect(ui).toContain('data-incident-action="recover"');
    expect(ui).toContain("External alert delivery is disabled");
  });

  test("independent probe requires sustained failure and contains no credential", () => {
    const workflow = readFileSync(".github/workflows/v2-uptime-monitor.yml", "utf8");
    expect(workflow).toContain("https://the-slate-v2.pages.dev/");
    expect(workflow).toContain("for attempt in 1 2 3");
    expect(workflow).not.toMatch(/SUPABASE_|secret|token/i);
  });
});
