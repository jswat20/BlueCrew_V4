// Canonical communication vocabulary. Business workflows and channel adapters
// must reference this catalog instead of defining channel-specific event names.
const communicationEventCatalog = (() => {
  const CHANNELS = Object.freeze({ IN_APP: "in_app", EMAIL: "email", SMS: "sms", PUSH: "push" });
  const definitions = {
    "account-approved": ["account", true, [CHANNELS.IN_APP, CHANNELS.EMAIL]],
    "account-rejected": ["account", true, [CHANNELS.IN_APP, CHANNELS.EMAIL]],
    "claim-submitted": ["claims", false, [CHANNELS.IN_APP]],
    "claim-approved": ["claims", false, [CHANNELS.IN_APP, CHANNELS.EMAIL]],
    "claim-rejected": ["claims", false, [CHANNELS.IN_APP, CHANNELS.EMAIL]],
    "claim-withdrawn": ["claims", false, [CHANNELS.IN_APP]],
    "assignment-created": ["assignments", false, [CHANNELS.IN_APP, CHANNELS.EMAIL]],
    "assignment-removed": ["assignments", false, [CHANNELS.IN_APP, CHANNELS.EMAIL]],
    "assignment-declined": ["assignments", false, [CHANNELS.IN_APP]],
    "game-cancelled": ["game_changes", true, [CHANNELS.IN_APP, CHANNELS.EMAIL]],
    "game-date-changed": ["game_changes", false, [CHANNELS.IN_APP, CHANNELS.EMAIL]],
    "game-time-changed": ["game_changes", false, [CHANNELS.IN_APP, CHANNELS.EMAIL]],
    "game-location-changed": ["game_changes", false, [CHANNELS.IN_APP, CHANNELS.EMAIL]],
    "game-field-changed": ["game_changes", false, [CHANNELS.IN_APP, CHANNELS.EMAIL]],
    "game-reminder": ["reminders", false, [CHANNELS.IN_APP, CHANNELS.EMAIL]],
    "availability-reminder": ["reminders", false, [CHANNELS.IN_APP, CHANNELS.EMAIL]]
  };
  const catalog = Object.freeze(Object.fromEntries(Object.entries(definitions).map(([type, value]) => [type, Object.freeze({
    type, category: value[0], critical: value[1], importance: value[1] ? "critical" : "standard", defaultChannels: Object.freeze([...value[2]])
  })])));
  function get(type) { return catalog[String(type || "").trim()] || null; }
  function isSupported(type) { return Boolean(get(type)); }
  function list() { return Object.values(catalog); }
  return Object.freeze({ CHANNELS, supportedChannels: Object.freeze(Object.values(CHANNELS)), get, isSupported, list });
})();
