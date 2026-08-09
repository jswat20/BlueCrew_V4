const communicationPreferenceService = (() => {
  const mandatoryTypes = new Set(["account-approved", "account-rejected"]);
  function eventOverride(preferences, type, channel) {
    const events = preferences?.communicationEvents || preferences?.events || {};
    const value = events?.[type]?.[channel];
    return typeof value === "boolean" ? value : undefined;
  }
  function channelOverride(preferences, channel) {
    const value = preferences?.channels?.[channel];
    if (typeof value === "boolean") return value;
    if (channel === "email" && typeof preferences?.emailEnabled === "boolean") return preferences.emailEnabled;
    return undefined;
  }
  function legacyCategoryEnabled(preferences, definition) {
    const legacy = { account: "accounts", claims: "claims", assignments: "assignments", game_changes: "assignments", reminders: "availability" };
    const value = preferences?.[legacy[definition.category]];
    return typeof value === "boolean" ? value : undefined;
  }
  function shouldDeliver({ preferences = {}, eventType, channel } = {}) {
    const definition = communicationEventCatalog.get(eventType);
    if (!definition || !communicationEventCatalog.supportedChannels.includes(channel)) return false;
    if (["sms", "push"].includes(channel)) return false;
    if (mandatoryTypes.has(eventType)) return definition.defaultChannels.includes(channel);
    const explicit = eventOverride(preferences, eventType, channel);
    if (typeof explicit === "boolean") return explicit;
    const enabled = channelOverride(preferences, channel);
    if (typeof enabled === "boolean") return enabled && definition.defaultChannels.includes(channel);
    if (channel === "in_app") {
      const legacy = legacyCategoryEnabled(preferences, definition);
      if (typeof legacy === "boolean") return legacy && definition.defaultChannels.includes(channel);
    }
    if (eventType === "availability-reminder" && channel === "email") return false;
    return definition.defaultChannels.includes(channel);
  }
  function enabledChannels({ preferences = {}, eventType } = {}) {
    return communicationEventCatalog.supportedChannels.filter(channel => shouldDeliver({ preferences, eventType, channel }));
  }
  return Object.freeze({ shouldDeliver, enabledChannels, mandatoryTypes: Object.freeze([...mandatoryTypes]) });
})();
