const { test, expect } = require("@playwright/test");
const { readFileSync } = require("node:fs");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

const migrationPath = "supabase/migrations/20261127201646_staging_email_safety_sink.sql";
const categoryFixPath = "supabase/migrations/20261127202013_fix_staging_email_test_category.sql";
const loadShared = name => import(pathToFileURL(path.resolve(`supabase/functions/_shared/${name}.mjs`)).href);

test("staging sink accepts only the reserved non-routable recipient domain", async () => {
  const { createStagingSinkAdapter } = await loadShared("staging-sink-adapter");
  const captured = [];
  const adapter = createStagingSinkAdapter({ capture: async input => {
    captured.push(input);
    return { success: true, providerMessageId: "staging-sink:delivery-1" };
  } });
  const accepted = await adapter.sendEmail({
    to: "official@slate.invalid",subject: "The Slate test",idempotencyKey: "stable-key"
  });
  const denied = await adapter.sendEmail({
    to: "person@example.com",subject: "Must not send",idempotencyKey: "unsafe-key"
  });
  expect(accepted).toEqual({ success: true, providerMessageId: "staging-sink:delivery-1" });
  expect(captured).toEqual([{ idempotencyKey: "stable-key", subject: "The Slate test" }]);
  expect(denied).toMatchObject({ success: false,retryable: false,failureCode: "staging_recipient_not_allowed" });
});

test("staging migration cannot claim the historical queue or external recipients", () => {
  const sql = readFileSync(migrationPath, "utf8");
  expect(sql).toContain("e.metadata @> '{\"staging_email_test\":true}'::jsonb");
  expect(sql).toMatch(/lower\(p\.email\) like '%@slate\.invalid'/);
  expect(sql).toContain("for update of d skip locked");
  expect(sql).toContain("attempt_count<3");
  expect(sql).toContain("unique (delivery_id,attempt_number)");
  expect(sql).toContain("p_event_type not in ('assignment-created','game-time-changed','account-approved')");
  expect(sql).toContain("staging_email_recipient_not_allowed");
  expect(sql).toMatch(/revoke all on table private\.staging_email_captures from public,anon,authenticated/);
  expect(sql).toMatch(/grant execute on function public\.claim_staging_email_deliveries[\s\S]*to service_role/);
  expect(sql).not.toMatch(/grant execute on function public\.claim_staging_email_deliveries[\s\S]*to authenticated/);
});

test("staging sink stores no message body, token, or provider credential", () => {
  const sql = readFileSync(migrationPath, "utf8");
  const edge = readFileSync("supabase/functions/staging-email-sink/index.ts", "utf8");
  expect(sql).not.toMatch(/\b(html|body|token|secret)\s+(text|jsonb|bytea)/i);
  expect(edge).not.toContain("RESEND_API_KEY");
  expect(edge).not.toContain("createResendAdapter");
  expect(edge).not.toContain("api.resend.com");
  expect(edge).not.toContain("console.log");
  expect(edge).toContain("fdjhwxmphdzodxvhrblk.supabase.co");
  expect(edge).toContain('rpc("authorize_staging_email_sink")');
});

test("controlled failure remains retryable once and capture is idempotent", () => {
  const sql = readFileSync(migrationPath, "utf8");
  expect(sql).toContain("v_delivery.attempt_count=1");
  expect(sql).toContain("'success',false,'retryable',true");
  expect(sql).toContain("on conflict(delivery_id,attempt_number) do nothing");
  expect(sql).toContain("staging_controlled_failure");
  expect(sql).toContain("concat('staging-sink:',v_delivery.id)");
});

test("synthetic events use established queue categories", () => {
  const sql = readFileSync(categoryFixPath, "utf8");
  expect(sql).toContain("when 'assignment-created' then 'assignments'");
  expect(sql).toContain("when 'game-time-changed' then 'game_changes'");
  expect(sql).toContain("when 'account-approved' then 'account'");
  expect(sql).not.toContain("p_event_type,'system'");
});

test("production Resend worker remains unchanged and separate", () => {
  const worker = readFileSync("supabase/functions/process-communication-emails/index.ts", "utf8");
  expect(worker).toContain('Deno.env.get("RESEND_API_KEY")');
  expect(worker).toContain('Deno.env.get("COMMUNICATION_WORKER_SECRET")');
  expect(worker).toContain("createResendAdapter");
  expect(worker).not.toContain("claim_staging_email_deliveries");
});
