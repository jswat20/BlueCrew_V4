const { test, expect } = require("@playwright/test");
const { readFileSync, readdirSync } = require("node:fs");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

const shared = name => import(pathToFileURL(path.resolve(`supabase/functions/_shared/${name}.mjs`)).href);
const delivery = (overrides = {}) => ({ delivery_id: "delivery-1", lease_token: "lease-1", idempotency_key: "org:event:recipient:email", attempt_count: 0,
  event_id: "event-1", event_type: "claim-approved", organization_id: "org-1", recipient_profile_id: "profile-1", recipient_email: "umpire@example.com",
  recipient_display_name: "Test UmpireOne", occurred_at: "2026-08-12T17:00:00Z", game_id: "game-1", assignment_id: "assignment-1", claim_id: "claim-1",
  metadata: { year: 2026, seasonCode: "S", organizationCode: "LSYB", level: "8U", sequence: 112, date: "2026-08-12", time: "18:00", location: "Lake Shore Athletic Complex", field: "Field 3", position: "Plate", actionPath: "game-hub" },
  organization_settings: { level_aliases: { "8U": "Pinto" } }, ...overrides });

function fakeStore(row = delivery()) {
  const state = { row: { ...row, status: "pending", retryable: true }, completions: [] };
  return {
    state,
    async claim() { if (!["pending", "failed"].includes(state.row.status) || (state.row.status === "failed" && !state.row.retryable) || state.row.attempt_count >= 3) return []; state.row.status = "processing"; return [{ ...state.row }]; },
    async beginAttempt(id, token) { if (state.row.status !== "processing" || id !== state.row.delivery_id || token !== state.row.lease_token) return false; state.row.attempt_count += 1; return true; },
    async complete(id, token, result) { if (id !== state.row.delivery_id || token !== state.row.lease_token) return false; state.completions.push({ ...result }); state.row.status = result.success ? "sent" : "failed"; state.row.retryable = result.retryable === true && state.row.attempt_count < 3; state.row.provider_message_id = result.providerMessageId || ""; return true; }
  };
}

test("Resend adapter sends the trusted model and stable idempotency key", async () => {
  const calls = []; const { createResendAdapter } = await shared("resend-adapter");
  const adapter = createResendAdapter({ apiKey: "server-test-key", from: "The Slate <verified@example.com>", fetchImpl: async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200, json: async () => ({ id: "resend-message-1" }) }; } });
  const result = await adapter.sendEmail({ to: "umpire@example.com", subject: "The Slate — Claim Approved", text: "Text", html: "<p>HTML</p>", idempotencyKey: "stable-key" });
  expect(result).toEqual({ success: true, providerMessageId: "resend-message-1" });
  expect(calls[0].url).toBe("https://api.resend.com/emails");
  expect(calls[0].init.headers["Idempotency-Key"]).toBe("stable-key");
  expect(JSON.parse(calls[0].init.body).to).toEqual(["umpire@example.com"]);
});

test("provider classifies transient and permanent failures safely", async () => {
  const { createResendAdapter } = await shared("resend-adapter");
  const response = status => ({ ok: false, status, json: async () => ({ message: "Provider rejected request" }) });
  const transient = await createResendAdapter({ apiKey: "test", from: "verified@example.com", fetchImpl: async () => response(429) }).sendEmail({ to: "a@example.com", idempotencyKey: "same" });
  const permanent = await createResendAdapter({ apiKey: "test", from: "verified@example.com", fetchImpl: async () => response(422) }).sendEmail({ to: "a@example.com", idempotencyKey: "same" });
  expect(transient).toMatchObject({ success: false, retryable: true, failureCode: "resend_429" });
  expect(permanent).toMatchObject({ success: false, retryable: false, failureCode: "resend_422" });
  expect(JSON.stringify({ transient, permanent })).not.toContain("test");
});

test("worker renders claim-approved terminology and records provider acceptance", async () => {
  const { processCommunicationEmails } = await shared("email-processor"); const store = fakeStore(); const sent = [];
  const summary = await processCommunicationEmails({ store, provider: { sendEmail: async input => { sent.push(input); return { success: true, providerMessageId: "provider-1" }; } }, appUrl: "https://slate.example.com" });
  expect(summary).toEqual({ claimed: 1, sent: 1, failed: 0, skipped: 0 });
  expect(sent[0]).toMatchObject({ to: "umpire@example.com", subject: "The Slate — Claim Approved", idempotencyKey: "org:event:recipient:email" });
  expect(sent[0].text).toContain("Game: 2026-S-LSYB-8U-0112");
  expect(sent[0].text).toContain("Division: Pinto");
  expect(sent[0].text).toContain("Time: 6:00 PM");
  expect(sent[0].text).toContain("Assignment: U1");
  expect(sent[0].text).toContain("https://slate.example.com/game-hub");
  expect(store.state).toMatchObject({ row: { status: "sent", attempt_count: 1, provider_message_id: "provider-1" } });
});

test("transient failure retries at most with the same provider idempotency key", async () => {
  const { processCommunicationEmails } = await shared("email-processor"); const store = fakeStore(); const keys = []; let call = 0;
  const provider = { sendEmail: async input => { keys.push(input.idempotencyKey); call += 1; return call === 1 ? { success: false, retryable: true, failureCode: "resend_503", failureMessage: "Temporary" } : { success: true, providerMessageId: "provider-2" }; } };
  expect((await processCommunicationEmails({ store, provider })).failed).toBe(1);
  expect((await processCommunicationEmails({ store, provider })).sent).toBe(1);
  expect(keys).toEqual(["org:event:recipient:email", "org:event:recipient:email"]);
  expect(store.state.row.attempt_count).toBe(2);
});

test("permanent failure and already-sent rows are not retried", async () => {
  const { processCommunicationEmails } = await shared("email-processor"); const store = fakeStore(); let sends = 0;
  const provider = { sendEmail: async () => { sends += 1; return { success: false, retryable: false, failureCode: "resend_422", failureMessage: "Invalid recipient" }; } };
  await processCommunicationEmails({ store, provider }); const second = await processCommunicationEmails({ store, provider });
  expect(second.claimed).toBe(0); expect(sends).toBe(1); expect(store.state.row.attempt_count).toBe(1);
  store.state.row.status = "sent"; expect((await processCommunicationEmails({ store, provider })).claimed).toBe(0);
});

test("transient failures stop after three provider attempts", async () => {
  const { processCommunicationEmails } = await shared("email-processor"); const store = fakeStore(); let sends = 0;
  const provider = { sendEmail: async () => { sends += 1; return { success: false, retryable: true, failureCode: "resend_503", failureMessage: "Temporary" }; } };
  await processCommunicationEmails({ store, provider }); await processCommunicationEmails({ store, provider }); await processCommunicationEmails({ store, provider });
  const exhausted = await processCommunicationEmails({ store, provider });
  expect(exhausted.claimed).toBe(0); expect(sends).toBe(3); expect(store.state.row).toMatchObject({ attempt_count: 3, retryable: false, status: "failed" });
});

test("concurrent worker invocation sends a leased delivery only once", async () => {
  const { processCommunicationEmails } = await shared("email-processor"); const store = fakeStore(); let sends = 0;
  const provider = { sendEmail: async () => { sends += 1; return { success: true, providerMessageId: "one" }; } };
  const results = await Promise.all([processCommunicationEmails({ store, provider }), processCommunicationEmails({ store, provider })]);
  expect(results.map(result => result.claimed).sort()).toEqual([0, 1]); expect(sends).toBe(1);
});

test("SQL lease and Edge entrypoint enforce trusted server processing", () => {
  const migration = readFileSync("supabase/migrations/202608080002_email_delivery_worker.sql", "utf8");
  const edge = readFileSync("supabase/functions/process-communication-emails/index.ts", "utf8");
  expect(migration).toContain("for update of delivery skip locked");
  expect(migration).toContain("profile.organization_id = delivery.organization_id");
  expect(migration).toContain("attempt_count = attempt_count + 1");
  expect(migration).toContain("attempt_started_for_lease is null");
  expect(migration).toContain("lease_token = gen_random_uuid()");
  expect(migration).toContain("attempt_count < 3");
  expect(migration).toContain("assignment_claim_approved_communication");
  expect(migration).toContain("'claim-approved'");
  expect(migration).toContain("exception when others");
  expect(migration).toMatch(/revoke all on function public\.complete_communication_email_delivery[\s\S]*from public, anon, authenticated/);
  expect(migration).not.toMatch(/grant execute on function public\.(claim|begin|complete)_communication_email[\s\S]*to authenticated/);
  expect(edge).toContain('request.headers.get("Authorization")');
  expect(edge).toContain('Deno.env.get("RESEND_API_KEY")');
  expect(edge).not.toMatch(/recipient_email|subject\s*:\s*body|request\.json\(/);
  expect(edge).not.toContain("console.log");
  const browserFiles = ["index.html", "config/supabase.js", ...readdirSync("js/services").filter(file => file.endsWith(".js")).map(file => `js/services/${file}`)];
  expect(browserFiles.map(file => readFileSync(file, "utf8")).join("\n")).not.toContain("RESEND_API_KEY");
});
