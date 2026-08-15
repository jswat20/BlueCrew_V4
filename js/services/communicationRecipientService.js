const communicationRecipientService = (() => {
  function normalizeRole(value) { return value === "admin" ? "administrator" : String(value || "umpire"); }
  function resolve({ organizationId, profileId = "", crewMemberId = "", eventType } = {}) {
    if (!organizationId || (!profileId && !crewMemberId)) return { success: false, message: "Organization and recipient identity are required." };
    const crew = crewMemberId && typeof crewService !== "undefined" ? crewService.getById(crewMemberId) : null;
    const resolvedProfileId = profileId || crew?.profileId || "";
    const account = typeof accountService !== "undefined"
      ? accountService.getAll().find(item => String(item.id) === String(resolvedProfileId) || (crew?.id && String(item.crewId) === String(crew.id)))
      : null;
    if (!account) return { success: false, message: "Recipient was not found." };
    const authoritativeOrganizationId = account.organizationId || crew?.organizationId || "local";
    if (String(authoritativeOrganizationId) !== String(organizationId)) return { success: false, message: "Recipient does not belong to this organization." };
    const preferences = account.communicationPreferences || {};
    return { success: true, data: Object.freeze({
      profileId: account.id, crewMemberId: crew?.id || account.crewId || "", organizationId: authoritativeOrganizationId,
      role: normalizeRole(account.role), displayName: `${account.firstName || ""} ${account.lastName || ""}`.trim() || "The Slate user",
      email: account.email || "", enabledChannels: communicationPreferenceService.enabledChannels({ preferences, eventType }), preferences: structuredClone(preferences)
    }) };
  }
  return Object.freeze({ resolve });
})();
