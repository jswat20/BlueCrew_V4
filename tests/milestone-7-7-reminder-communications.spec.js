const { test, expect } = require("@playwright/test");
const { readFileSync } = require("node:fs");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

const migrationPath = "supabase/migrations/202608110002_game_reminder_communications.sql";
const migration = () => readFileSync(migrationPath, "utf8");

test("reminder catalog exposes exactly the three supported current reminder cadences", async ({ page }) => {
  await page.goto("/");
  const reminderTypes = await page.evaluate(() => communicationEventCatalog.list().map(item => item.type).filter(type => type.startsWith("game-reminder")));
  expect(reminderTypes).toEqual(["game-reminder-24-hour", "game-reminder-2-hour", "game-reminder-30-minute"]);
});

test("trusted producer owns eligibility, recipient isolation, and the three non-overlapping windows", () => {
  const sql = migration();
  for (const type of ["game-reminder-24-hour", "game-reminder-2-hour", "game-reminder-30-minute"]) expect(sql).toContain(`'${type}'`);
  expect(sql).toContain("organization.active");
  expect(sql).toContain("game.lifecycle_status='scheduled'");
  expect(sql).toContain("assignment.status in ('assigned','locked')");
  expect(sql).toContain("crew.active and profile.status='approved' and profile.role='umpire'");
  expect(sql).toContain("assignment.assigned_crew_member_id");
  expect(sql).toContain("interval '24 hours',interval '2 hours'");
  expect(sql).toContain("interval '2 hours',interval '30 minutes'");
  expect(sql).toContain("interval '30 minutes',interval '0 seconds'");
  expect(sql).not.toMatch(/claimant_crew_member_id|role in \('administrator','assigner'\)/);
});

test("idempotency survives cron repetition, worker restart, schedule changes, cancellation, and restoration", () => {
  const sql = migration();
  expect(sql).toContain("business_idempotency_key=v_business_key");
  expect(sql).toContain("v_due.event_type,':',v_due.game_id,':',v_due.assignment_id,':',v_due.recipient_profile_id");
  expect(sql).not.toContain("game.updated_at");
  expect(sql).not.toContain("game.game_time,':',v_due.recipient_profile_id");
  expect(sql).toContain("on conflict do nothing");
  expect(sql).toContain("reminder_key=v_business_key");
  expect(sql).toContain("game.lifecycle_status='scheduled'");
});

test("preferences retain skipped audit rows and the worker discovers reminders before claiming email", () => {
  const sql = migration();
  const worker = readFileSync("supabase/functions/process-communication-emails/index.ts", "utf8");
  expect(sql).toContain("public.enqueue_profile_communication");
  expect(sql).toContain("failure_code='preference_disabled'");
  expect(sql).toContain("array['communicationEvents',v_due.event_type,'email']");
  expect(sql).toContain("#>> '{channels,email}'");
  expect(sql).toContain("communication_event_id=v_event.id and channel='in_app' and status='pending'");
  expect(worker).toContain('client.rpc("enqueue_due_game_reminders")');
  const invocation = worker.indexOf('client.rpc("enqueue_due_game_reminders")');
  expect(invocation).toBeLessThan(worker.indexOf("processCommunicationEmails", invocation));
  expect(worker).toContain("reminders: reminders || { created: 0, duplicates: 0 }");
});

test("all reminder emails use rich assignment facts and cadence-specific wording", async () => {
  const { renderCommunicationEmail } = await import(pathToFileURL(path.resolve("supabase/functions/_shared/communication-template.mjs")).href);
  const base = { recipient_display_name: "Test Official", game_id: "game-21", organization_settings: { level_aliases: { "8U": "Pinto" } }, metadata: {
    gameDisplay: "LSYB-021", level: "8U", date: "2026-09-05", time: "18:30", location: "Lake Shore Athletic Complex",
    field: "Field 4", position: "Plate", actionPath: "my-schedule"
  } };
  const tomorrow = renderCommunicationEmail({ ...base, event_type: "game-reminder-24-hour" });
  const twoHour = renderCommunicationEmail({ ...base, event_type: "game-reminder-2-hour" });
  const soon = renderCommunicationEmail({ ...base, event_type: "game-reminder-30-minute" });
  expect(tomorrow.subject).toBe("The Slate — Game Tomorrow");
  expect(twoHour.subject).toBe("The Slate — Game in 2 Hours");
  expect(soon.subject).toBe("The Slate — Game Starts Soon");
  expect(twoHour.text).toContain("Your game begins in approximately two hours.");
  for (const value of ["Game: LSYB-021", "Division: Pinto", "Date: September 5, 2026", "Time: 6:30 PM", "Location: Lake Shore Athletic Complex", "Field: Field 4", "Assignment: U1"]) {
    expect(twoHour.text).toContain(value);
  }
  expect(twoHour.text).not.toContain("Home");
});

test("migration exposes only the service-role reminder boundary", () => {
  const sql = migration();
  expect(sql).toContain("if auth.role() <> 'service_role' then raise exception 'reminder_worker_forbidden'");
  expect(sql).toMatch(/revoke all on function public\.enqueue_due_game_reminders\(timestamptz\) from public,anon,authenticated/);
  expect(sql).toContain("grant execute on function public.enqueue_due_game_reminders(timestamptz) to service_role");
});
