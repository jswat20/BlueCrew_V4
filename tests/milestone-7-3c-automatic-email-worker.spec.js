const { test, expect } = require("@playwright/test");
const { readFileSync, readdirSync } = require("node:fs");

const migrationPath = "supabase/migrations/202608090001_automatic_communication_email_worker.sql";

test("cron invokes the communication email worker every minute using Vault", () => {
  const sql = readFileSync(migrationPath, "utf8");

  expect(sql).toContain("create extension if not exists pg_cron");
  expect(sql).toContain("create extension if not exists pg_net");
  expect(sql).toContain("'process-communication-emails-every-minute'");
  expect(sql).toContain("'* * * * *'");
  expect(sql).toContain("net.http_post");
  expect(sql).toContain("vault.decrypted_secrets");
  expect(sql).toContain("slate_communication_worker_url");
  expect(sql).toContain("slate_communication_worker_secret");
  expect(sql).toContain("'Authorization', 'Bearer ' ||");
  expect(sql).toContain("timeout_milliseconds := 30000");
});

test("cron installation is repeatable and never embeds credentials", () => {
  const sql = readFileSync(migrationPath, "utf8");

  expect(sql).toContain("cron.unschedule(existing_job_id)");
  expect(sql).not.toMatch(/COMMUNICATION_WORKER_SECRET\s*=/);
  expect(sql).not.toMatch(/Bearer\s+[A-Za-z0-9_-]{16,}/);
  expect(sql).not.toContain("service_role");
  expect(sql).not.toContain("RESEND_API_KEY");
});

test("scheduled invocation preserves the unchanged trusted worker boundary", () => {
  const edge = readFileSync("supabase/functions/process-communication-emails/index.ts", "utf8");
  const config = readFileSync("supabase/config.toml", "utf8");

  expect(config).toMatch(/\[functions\.process-communication-emails\][\s\S]*verify_jwt\s*=\s*false/);
  expect(edge).toContain('Deno.env.get("COMMUNICATION_WORKER_SECRET")');
  expect(edge).toContain('request.headers.get("Authorization") !== `Bearer ${workerSecret}`');
  expect(edge).toContain('request.method !== "POST"');
  expect(edge).not.toContain("console.log");
});

test("worker idle, duplicate, retry, and pending-to-sent guarantees remain covered", () => {
  const workerTests = readFileSync("tests/milestone-7-2-transactional-email.spec.js", "utf8");

  expect(workerTests).toContain("claimed: 1, sent: 1, failed: 0, skipped: 0");
  expect(workerTests).toContain("transient failure retries at most with the same provider idempotency key");
  expect(workerTests).toContain("permanent failure and already-sent rows are not retried");
  expect(workerTests).toContain("concurrent worker invocation sends a leased delivery only once");
  expect(workerTests).toContain("expect(second.claimed).toBe(0)");
});

test("worker and provider secrets are absent from browser-delivered JavaScript", () => {
  const browserFiles = [
    "config/supabase.js",
    ...readdirSync("js", { recursive: true })
      .filter(file => file.endsWith(".js"))
      .map(file => `js/${file.replaceAll("\\", "/")}`)
  ];
  const browserSource = browserFiles.map(file => readFileSync(file, "utf8")).join("\n");

  expect(browserSource).not.toContain("COMMUNICATION_WORKER_SECRET");
  expect(browserSource).not.toContain("RESEND_API_KEY");
  expect(browserSource).not.toContain("slate_communication_worker_secret");
});

