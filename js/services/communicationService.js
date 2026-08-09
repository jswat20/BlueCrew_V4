const communicationService = (() => {
  const metadataKeys = new Set(["year", "seasonCode", "organizationCode", "leagueCode", "level", "canonicalLevel", "sequence", "gameNumber", "gameIdentifier", "gameDisplay", "date", "time", "location", "field", "position", "actionPath"]);
  const deliveries = new Map();
  function normalizeMetadata(source = {}) { return Object.fromEntries(Object.entries(source).filter(([key, value]) => metadataKeys.has(key) && ["string", "number", "boolean"].includes(typeof value))); }
  function normalizeEvent(input = {}) {
    const definition = communicationEventCatalog.get(input.type);
    if (!definition || !input.organizationId || !input.recipientProfileId) return null;
    return Object.freeze({ id: String(input.id || `communication-${Date.now()}-${Math.random().toString(16).slice(2)}`), type: definition.type,
      category: definition.category, organizationId: String(input.organizationId), actorProfileId: String(input.actorProfileId || ""),
      recipientProfileId: String(input.recipientProfileId), subjectEntityType: String(input.subjectEntityType || ""), subjectEntityId: String(input.subjectEntityId || ""),
      gameId: String(input.gameId || ""), assignmentId: String(input.assignmentId || ""), claimId: String(input.claimId || ""),
      occurredAt: String(input.occurredAt || new Date().toISOString()), metadata: Object.freeze(normalizeMetadata(input.metadata)) });
  }
  function keyFor(event, channel, supplied = "") { return String(supplied || [event.organizationId, event.type, event.subjectEntityType, event.subjectEntityId, event.recipientProfileId, event.occurredAt, channel].join(":")); }
  function record(event, channel, idempotencyKey, status, message = "") {
    const key = keyFor(event, channel, idempotencyKey); const existing = deliveries.get(key); if (existing) return { ...existing, duplicate: true };
    const delivery = { id: `delivery-${Date.now()}-${Math.random().toString(16).slice(2)}`, communicationEventId: event.id, recipientProfileId: event.recipientProfileId,
      channel, status, attemptCount: ["pending", "skipped"].includes(status) ? 0 : 1, createdAt: new Date().toISOString(), lastAttemptAt: ["pending", "skipped"].includes(status) ? null : new Date().toISOString(),
      sentAt: status === "sent" ? new Date().toISOString() : null, failureCode: "", failureMessage: message, providerMessageId: "", idempotencyKey: key };
    deliveries.set(key, delivery); return structuredClone(delivery);
  }
  function publish(input = {}) {
    const event = normalizeEvent(input); if (!event) return { success: false, message: "A supported type, organization, and recipient are required." };
    const recipientResult = communicationRecipientService.resolve({ organizationId: event.organizationId, profileId: event.recipientProfileId, eventType: event.type });
    if (!recipientResult.success) return recipientResult;
    const recipient = recipientResult.data; const message = communicationTemplateService.render(event, recipient); const results = [];
    communicationEventCatalog.get(event.type).defaultChannels.forEach(channel => {
      const idempotencyKey = keyFor(event, channel, input.idempotencyKey ? `${input.idempotencyKey}:${channel}` : "");
      if (deliveries.has(idempotencyKey)) { results.push({ ...deliveries.get(idempotencyKey), duplicate: true }); return; }
      if (!recipient.enabledChannels.includes(channel)) { results.push(record(event, channel, idempotencyKey, "skipped", "Disabled by communication preference.")); return; }
      if (channel === "in_app") {
        const created = notificationService.create({ type: event.type, title: message.inAppTitle, message: message.inAppSummary, audience: recipient.role === "umpire" ? "umpire" : "account",
          recipientAccountId: recipient.profileId, relatedId: event.gameId || event.subjectEntityId, destination: message.actionPath ? { page: message.actionPath, context: event.gameId ? { gameId: event.gameId } : {} } : null,
          reminderKey: idempotencyKey });
        results.push(record(event, channel, idempotencyKey, created.success ? "sent" : "failed", created.success ? "" : created.message));
      } else results.push(record(event, channel, idempotencyKey, "pending"));
    });
    return { success: true, data: { event, recipient, message, deliveries: results } };
  }
  function getDeliveries() { return [...deliveries.values()].map(delivery => structuredClone(delivery)); }
  function clearForTests() { deliveries.clear(); }
  return Object.freeze({ normalizeEvent, publish, getDeliveries, clearForTests });
})();
