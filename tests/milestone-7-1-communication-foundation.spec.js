const { test, expect } = require("@playwright/test");
const { readFileSync } = require("node:fs");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    repositoryProvider.useLocalStorage();
    localStorage.removeItem("bluecrew_accounts");
    localStorage.removeItem("bluecrew_session");
    localStorage.removeItem("bluecrew_notifications");
    communicationService.clearForTests();
    authService.loginAsAdmin();
  });
});

test("catalog is the canonical source for pilot events and channels", async ({ page }) => {
  const result = await page.evaluate(() => ({
    types: communicationEventCatalog.list().map(item => item.type),
    channels: communicationEventCatalog.supportedChannels,
    cancelled: communicationEventCatalog.get("game-cancelled")
  }));
  expect(result.types).toEqual(expect.arrayContaining(["account-approved", "claim-submitted", "claim-approved", "assignment-created", "game-cancelled", "game-reminder", "availability-reminder"]));
  expect(result.channels).toEqual(["in_app", "email", "sms", "push"]);
  expect(result.cancelled).toMatchObject({ category: "game_changes", critical: true, defaultChannels: ["in_app", "email"] });
});

test("preference evaluation reuses legacy preferences and protects mandatory account communication", async ({ page }) => {
  const result = await page.evaluate(() => ({
    mutedClaim: communicationPreferenceService.shouldDeliver({ preferences: { claims: false }, eventType: "claim-approved", channel: "in_app" }),
    mutedEmail: communicationPreferenceService.shouldDeliver({ preferences: { emailEnabled: false }, eventType: "claim-approved", channel: "email" }),
    mandatory: communicationPreferenceService.shouldDeliver({ preferences: { accounts: false, emailEnabled: false }, eventType: "account-approved", channel: "email" }),
    futureSms: communicationPreferenceService.shouldDeliver({ preferences: {}, eventType: "claim-approved", channel: "sms" }),
    availabilityDefault: communicationPreferenceService.shouldDeliver({ preferences: {}, eventType: "availability-reminder", channel: "email" }),
    availabilityOptIn: communicationPreferenceService.shouldDeliver({ preferences: { communicationEvents: { "availability-reminder": { email: true } } }, eventType: "availability-reminder", channel: "email" })
  }));
  expect(result).toEqual({ mutedClaim: false, mutedEmail: false, mandatory: true, futureSms: false, availabilityDefault: false, availabilityOptIn: true });
});

test("recipient resolution uses authoritative identity and enforces organization isolation", async ({ page }) => {
  const result = await page.evaluate(() => {
    const account = accountService.createAccount({ firstName: "Test", lastName: "Recipient", email: "authoritative@example.com", organizationId: "org-a" }).data;
    const resolved = communicationRecipientService.resolve({ organizationId: "org-a", profileId: account.id, eventType: "claim-approved", email: "attacker@example.com" });
    const rejected = communicationRecipientService.resolve({ organizationId: "org-b", profileId: account.id, eventType: "claim-approved" });
    return { resolved, rejected };
  });
  expect(result.resolved.success).toBe(true);
  expect(result.resolved.data).toMatchObject({ organizationId: "org-a", displayName: "Test Recipient", email: "authoritative@example.com" });
  expect(result.rejected).toEqual({ success: false, message: "Recipient does not belong to this organization." });
});

test("one event renders in-app and email from shared normalized metadata", async ({ page }) => {
  const result = await page.evaluate(() => {
    levelTerminologyService.configure({ level_aliases: { "8U": "Pinto" } });
    const account = accountService.createAccount({ firstName: "Test", lastName: "UmpireOne", email: "template@example.com", organizationId: "org-a" }).data;
    const event = communicationService.normalizeEvent({ type: "claim-approved", organizationId: "org-a", recipientProfileId: account.id, gameId: "game-1", occurredAt: "2026-08-12T17:00:00Z", metadata: {
      year: 2026, seasonCode: "S", organizationCode: "LSYB", level: "8U", sequence: 112, date: "2026-08-12", time: "18:00", location: "Lake Shore Athletic Complex", field: "Field 3", position: "Plate", injected: "discard me"
    } });
    return { event, message: communicationTemplateService.render(event, { displayName: "Test UmpireOne" }) };
  });
  expect(result.event.metadata.injected).toBeUndefined();
  expect(result.message.emailSubject).toBe("The Slate — Claim Approved");
  expect(result.message.emailTextBody).toContain("Game: 2026-S-LSYB-8U-0112");
  expect(result.message.emailTextBody).toContain("Division: Pinto");
  expect(result.message.emailTextBody).toContain("Time: 6:00 PM");
  expect(result.message.emailTextBody).toContain("Assignment: U1");
  expect(result.message.inAppSummary).toBe("Your claim has been approved.");
});

test("publish creates one in-app notification, queues email, and is idempotent", async ({ page }) => {
  const result = await page.evaluate(() => {
    const account = accountService.createAccount({ firstName: "Ida", lastName: "Potent", email: "idempotent@example.com", organizationId: "org-a" }).data;
    const input = { type: "assignment-created", organizationId: "org-a", recipientProfileId: account.id, subjectEntityType: "assignment", subjectEntityId: "assignment-1", assignmentId: "assignment-1", gameId: "game-1", occurredAt: "2026-08-12T17:00:00Z", idempotencyKey: "assignment-created:assignment-1", metadata: { date: "2026-08-12", time: "18:00", position: "Base", actionPath: "game-hub" } };
    const first = communicationService.publish(input); const second = communicationService.publish(input);
    return { first, second, notifications: notificationService.getAll(), audit: communicationService.getDeliveries() };
  });
  expect(result.first.success).toBe(true);
  expect(result.first.data.deliveries).toEqual(expect.arrayContaining([expect.objectContaining({ channel: "in_app", status: "sent" }), expect.objectContaining({ channel: "email", status: "pending" })]));
  expect(result.second.data.deliveries.every(item => item.duplicate)).toBe(true);
  expect(result.notifications).toHaveLength(1);
  expect(result.audit).toHaveLength(2);
  expect(result.audit.find(item => item.channel === "email")).toMatchObject({ status: "pending", attemptCount: 0, lastAttemptAt: null, providerMessageId: "" });
});

test("hosted audit migration is recipient-scoped, idempotent, and server-owned", () => {
  const migration = readFileSync("supabase/migrations/202608080001_communication_foundation.sql", "utf8");
  expect(migration).toContain("unique (organization_id, business_idempotency_key)");
  expect(migration).toContain("idempotency_key text not null unique");
  expect(migration).toContain("recipient_profile_id = public.current_profile_id()");
  expect(migration).toContain("communication_recipient_outside_organization");
  expect(migration).toContain("to service_role");
  expect(migration).not.toMatch(/grant execute on function public\.enqueue_communication_event[\s\S]*to authenticated/);
  expect(migration).not.toMatch(/api[_-]?key|authorization header|provider_secret/i);
});
