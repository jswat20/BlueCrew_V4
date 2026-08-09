const { test, expect } = require("@playwright/test");
const { readFileSync } = require("node:fs");

const migration = readFileSync("supabase/migrations/202608080003_assignment_claim_communication_coverage.sql", "utf8");

test("hosted claim producer covers every claim transition with server-derived recipients", () => {
  expect(migration).toContain("after insert or update of status on public.assignment_claims");
  expect(migration).toContain("new.status in ('approved','rejected')");
  expect(migration).toContain("new.status in ('pending','withdrawn')");
  expect(migration).toContain("case when new.status='pending' then 'claim-submitted' else 'claim-withdrawn' end");
  expect(migration).toContain("concat('claim-',new.status)");
  expect(migration).toContain("new.claimant_crew_member_id");
  expect(migration).toContain("role in ('administrator','assigner')");
  expect(migration).not.toMatch(/recipient_email|email subject|email body/i);
});

test("hosted assignment producer distinguishes assignment, removal, and decline", () => {
  expect(migration).toContain("after update of assigned_crew_member_id, declined_at on public.game_assignments");
  expect(migration).toContain("'assignment-created'");
  expect(migration).toContain("'assignment-removed'");
  expect(migration).toContain("'assignment-declined'");
  expect(migration).toContain("not exists(select 1 from public.assignment_claims");
  expect(migration).toContain("not v_is_decline");
});

test("every hosted event has recipient-scoped deterministic identity and preference audit", () => {
  expect(migration).toMatch(/concat\('claim-',new\.status,':',new\.id,':',v_claimant_profile\)/);
  expect(migration).toMatch(/concat\('assignment-created:',new\.id,':',new\.assigned_crew_member_id,':',v_profile\)/);
  expect(migration).toMatch(/concat\('assignment-removed:',new\.id,':',old\.assigned_crew_member_id,':',v_profile\)/);
  expect(migration).toMatch(/concat\('assignment-declined:',new\.id,':',old\.assigned_crew_member_id,':',v_admin\.id\)/);
  expect(migration).toContain("failure_code='preference_disabled'");
  expect(migration).toContain("array['in_app','email']::public.communication_channel[]");
  expect(migration).toContain("p_type in ('claim-rejected','claim-withdrawn','assignment-created','assignment-declined')");
  expect(migration).toContain("perform public.create_notification");
});

test("trusted worker templates cover pilot assignment and claim copy", async () => {
  const module = await import("../supabase/functions/_shared/communication-template.mjs");
  const base = {
    recipient_display_name: "Test UmpireOne", recipient_email: "test@example.com",
    metadata: { year: 2026, seasonCode: "S", organizationCode: "LSYB", level: "8U", sequence: 112,
      date: "2026-08-12", time: "18:00", location: "Lake Shore Athletic Complex", field: "Field 3", position: "Plate" },
    organization_settings: { level_aliases: { "8U": "Pinto" } }
  };
  const created = module.renderCommunicationEmail({ ...base, event_type: "assignment-created" });
  const removed = module.renderCommunicationEmail({ ...base, event_type: "assignment-removed" });
  const rejected = module.renderCommunicationEmail({ ...base, event_type: "claim-rejected" });
  expect(created.subject).toContain("Assignment Confirmed");
  expect(created.text).toContain("You have been assigned a game.");
  expect(removed.text).toContain("You have been removed from a game.");
  expect(rejected.text).toContain("Your claim was not approved.");
  for (const value of ["Game: 2026-S-LSYB-8U-0112", "Division: Pinto", "Time: 6:00 PM", "Location: Lake Shore Athletic Complex", "Field: Field 3", "Assignment: U1"]) {
    expect(created.text).toContain(value);
  }
});

test("producer migration keeps enqueue functions inaccessible to browser roles", () => {
  expect(migration).toMatch(/revoke all on function public\.enqueue_profile_communication[\s\S]*from public,anon,authenticated/);
  expect(migration).not.toMatch(/grant execute[\s\S]*to authenticated/);
  expect(migration).not.toMatch(/resend|api[_-]?key|provider_secret/i);
});
