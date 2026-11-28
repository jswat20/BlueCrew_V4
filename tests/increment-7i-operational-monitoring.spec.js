const { test, expect } = require("@playwright/test");
const { readFileSync } = require("node:fs");

const migration = readFileSync("supabase/migrations/20261128004437_operational_monitoring_foundation.sql", "utf8");

test.describe("Increment 7I operational monitoring", () => {
  test("database boundary is tenant-scoped, admin-readable, and privacy allowlisted", () => {
    expect(migration).toContain("organization_id = (select public.current_organization_id())");
    expect(migration).toContain("and (select public.is_administrator())");
    expect(migration).toContain("v_organization_id uuid := public.current_organization_id()");
    expect(migration).toContain("jsonb_build_object(");
    expect(migration).toContain("'duration_ms'");
    expect(migration).not.toMatch(/diagnostic_context[\s\S]{0,300}'(token|password|email|body|url)'/i);
    expect(migration).toMatch(/revoke all on public\.operational_events from public, anon, authenticated/);
    expect(migration).toMatch(/grant execute on function public\.get_operational_health[\s\S]*to authenticated/);
    expect(migration).toContain("expires_at timestamptz not null default (now() + interval '30 days')");
  });

  test("non-admin and cross-workspace reads fail closed in SQL", () => {
    expect(migration).toContain("workspace_administrator_required");
    expect(migration).toContain("where e.organization_id = v_organization_id");
    expect(migration).not.toMatch(/grant (insert|update|delete) on public\.operational_events to authenticated/i);
    expect(migration).toMatch(/revoke all on function private\.purge_expired_operational_events\(\)[\s\S]*from public, anon, authenticated/);
  });

  test("business conflicts are classified separately and monitoring is best effort", () => {
    const service = readFileSync("js/services/operationalMonitoringService.js", "utf8");
    expect(service).toContain('"reservation_conflict"');
    expect(service).toContain('expected ? "expected_rejection" : "operational_failure"');
    expect(service).toContain('severity: expected ? "info" : "error"');
    expect(service).toContain("Monitoring failures are");
    expect(service).toContain('console.warn("Operational monitoring signal could not be recorded."');
    expect(service).not.toMatch(/safeContext[\s\S]{0,600}\b(token|password|email|body)\s*:/i);
  });

  test("thresholds escalate faults but not legitimate conflicts", async ({ page }) => {
    await page.goto("/");
    await page.addScriptTag({ path: "js/services/operationalMonitoringService.js" });
    const summary = await page.evaluate(() => operationalMonitoringService.thresholds([
      { occurred_at: new Date().toISOString(), classification: "expected_rejection", severity: "info", module_code: "facility" },
      { occurred_at: new Date().toISOString(), classification: "expected_rejection", severity: "info", module_code: "league" }
    ], { failed_count: 0 }));
    expect(summary.status).toBe("healthy");
    expect(summary.expectedRejections).toBe(2);
    expect(summary.operationalFailures).toBe(0);
  });

  test("administrator-only UI provides safe controlled diagnostic and queue health", () => {
    const index = readFileSync("index.html", "utf8");
    const authorization = readFileSync("js/services/authorizationService.js", "utf8");
    const ui = readFileSync("js/ui/operationalMonitoring.js", "utf8");
    expect(index).toContain('data-page="operational-monitoring"');
    expect(authorization).toMatch(/"operational-monitoring": Object\.freeze\(\[\s*ROLES\.ADMINISTRATOR/);
    expect(ui).toContain("diagnostic.controlled_failure");
    expect(ui).toContain("Business-rule conflicts are tracked separately");
    expect(ui).toContain("Pending email deliveries");
    expect(ui).toContain("aria-live=\"polite\"");
  });
});
