import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const migration = readFileSync("supabase/migrations/202609040001_messaging_email_notifications.sql", "utf8");

async function templateModule() {
  return import(`${pathToFileURL(`${process.cwd()}/supabase/functions/_shared/communication-template.mjs`).href}?messaging-email=${Date.now()}`);
}

function delivery(eventType, metadata = {}) {
  return {
    event_type: eventType,
    recipient_display_name: "Test Recipient",
    recipient_email: "recipient@example.com",
    metadata,
    organization_settings: {}
  };
}

test("direct-message email derives from authoritative receipt rows and excludes the sender", () => {
  expect(migration).toContain("after insert on public.message_receipts");
  expect(migration).toContain("v_message.sender_profile_id = new.recipient_profile_id");
  expect(migration).toContain("p_recipient_profile_id => new.recipient_profile_id");
  expect(migration).toContain("message-received:', new.message_id, ':', new.recipient_profile_id");
  expect(migration).toContain("p_channels => array['email']::public.communication_channel[]");
});

test("announcement email derives only from snapshotted recipients and remains individually addressed", () => {
  expect(migration).toContain("after insert on public.message_announcement_recipients");
  expect(migration).toContain("announcement-received:', new.announcement_id, ':', new.recipient_profile_id");
  expect(migration).toContain("p_recipient_profile_id => new.recipient_profile_id");
  expect(migration).not.toMatch(/\bcc\b|\bbcc\b/i);
});

test("messaging events extend the established event and delivery model", () => {
  expect(migration).toContain("'message-received', 'announcement-received'");
  expect(migration).toContain("'game_changes', 'reminders', 'messaging'");
  expect(migration).toContain("public.enqueue_communication_event(");
  expect(migration).not.toMatch(/resend|sendgrid|smtp|api[_-]?key/i);
  expect(migration).toContain("revoke all on function public.enqueue_message_receipt_email() from public, anon, authenticated");
  expect(migration).toContain("revoke all on function public.enqueue_announcement_recipient_email() from public, anon, authenticated");
});

test("missing recipient email is observable but never rolls back messaging", () => {
  expect(migration).toContain("failure_code = 'recipient_email_unavailable'");
  expect(migration).toContain("status = 'skipped', retryable = false");
  expect(migration).toContain("exception when others then");
  expect(migration).toContain("The in-app message is authoritative and must survive notification faults.");
  expect(migration).toContain("Announcement creation and its recipient snapshot remain successful.");
});

test("direct-message template contains no private message content and uses the root Slate CTA", async () => {
  const { renderCommunicationEmail } = await templateModule();
  const privateBody = "SECRET PRIVATE MESSAGE BODY";
  const rendered = renderCommunicationEmail(delivery("message-received", { body: privateBody, actionPath: "" }), {
    appUrl: "https://app.worktheslate.com"
  });
  expect(rendered.subject).toBe("You have a new message in The Slate");
  expect(rendered.text).toContain("You have a new message waiting in The Slate.");
  expect(rendered.text).toContain("View Message: https://app.worktheslate.com/");
  expect(rendered.html).toContain("View Message");
  expect(`${rendered.text}${rendered.html}`).not.toContain(privateBody);
});

test("announcement template contains no announcement body and uses an individual CTA", async () => {
  const { renderCommunicationEmail } = await templateModule();
  const announcementBody = "SECRET ANNOUNCEMENT BODY";
  const rendered = renderCommunicationEmail(delivery("announcement-received", { body: announcementBody, actionPath: "" }), {
    appUrl: "https://app.worktheslate.com"
  });
  expect(rendered.subject).toBe("New announcement in The Slate");
  expect(rendered.text).toContain("A new announcement is waiting for you in The Slate.");
  expect(rendered.text).toContain("View Announcement: https://app.worktheslate.com/");
  expect(rendered.html).toContain("View Announcement");
  expect(`${rendered.text}${rendered.html}`).not.toContain(announcementBody);
});

test("read-state and Realtime changes cannot enqueue messaging email", () => {
  expect(migration).not.toMatch(/after update[^;]*(message_receipts|message_announcement_recipients)/i);
  expect(migration).not.toMatch(/read_at[\s\S]*enqueue_communication_event/i);
  expect(migration).not.toMatch(/supabase_realtime|publication/i);
});
