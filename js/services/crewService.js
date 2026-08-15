// js/services/crewService.js

let authenticatedCrewSnapshot = null;
let referencedCrewSnapshots = [];
let administrativeCrewSnapshot = null;
let administrativeCrewState = { status: "idle", message: "" };

const crewService = {
  isSharedMode() {
    return typeof supabaseClientService !== "undefined" && supabaseClientService.isConfigured();
  },

  async loadAuthenticatedCrewMember(profileId) {
    if (!this.isSharedMode() || !profileId) return null;
    const { data, error } = await supabaseSharedRepository.getLinkedCrewMember(profileId);
    if (error) throw error;
    authenticatedCrewSnapshot = sharedDomainMappingService.mapCrewMember(data);
    return authenticatedCrewSnapshot ? structuredClone(authenticatedCrewSnapshot) : null;
  },

  clearAuthenticatedCrewMember() {
    authenticatedCrewSnapshot = null;
  },

  clearReferencedCrewMembers() {
    referencedCrewSnapshots = [];
  },

  clearAllSharedCrew() {
    this.clearAuthenticatedCrewMember();
    this.clearReferencedCrewMembers();
    administrativeCrewSnapshot = null;
    administrativeCrewState = { status: "idle", message: "" };
  },

  getAdministrativeCrewState() {
    return { ...administrativeCrewState };
  },

  async loadAdministrativeCrew() {
    if (!this.isSharedMode()) return { success: true, data: this.getAll() };
    administrativeCrewState = { status: "loading", message: "" };
    const [{ data, error }, diagnostics] = await Promise.all([
      supabaseSharedRepository.getCrewMembers(),
      supabaseSharedRepository.getCrewIdentityDiagnostics()
    ]);
    if (error) {
      administrativeCrewState = { status: "error", message: error.message || "Crew roster could not be loaded." };
      return { success: false, message: administrativeCrewState.message };
    }
    if (diagnostics.error) {
      administrativeCrewState = { status: "error", message: diagnostics.error.message || "Crew identity status could not be loaded." };
      return { success: false, message: administrativeCrewState.message };
    }
    const profiles = await supabaseSharedRepository.getCrewProfiles((data || []).map(row => row.profile_id));
    if (profiles.error) {
      administrativeCrewState = { status: "error", message: profiles.error.message || "Linked Crew profiles could not be loaded." };
      return { success: false, message: administrativeCrewState.message };
    }
    const profileById = new Map((profiles.data || []).map(item => [String(item.id), item]));
    const identityByCrew = new Map((diagnostics.data || []).map(item => [String(item.crew_member_id), item]));
    administrativeCrewSnapshot = (data || []).map(row => {
      const identity = identityByCrew.get(String(row.id)) || {};
      const profile = row.profile_id ? profileById.get(String(row.profile_id)) || {} : {};
      return sharedDomainMappingService.mapCrewMember({ ...row, ...identity, linked_profile: profile });
    }).filter(Boolean)
      .sort((left, right) => `${left.lastName}\u0000${left.firstName}\u0000${left.id}`.localeCompare(`${right.lastName}\u0000${right.firstName}\u0000${right.id}`));
    administrativeCrewState = { status: "ready", message: "" };
    return { success: true, data: structuredClone(administrativeCrewSnapshot) };
  },

  toHostedChanges(member = {}) {
    return {
      first_name: String(member.firstName || "").trim(),
      last_name: String(member.lastName || "").trim(),
      email: String(member.email || "").trim(),
      phone: String(member.phone || "").trim(),
      active: member.active !== false,
      eligible_levels: levelTerminologyService.normalizeLevels(member.levels),
      preferences: member.preferences && typeof member.preferences === "object" ? structuredClone(member.preferences) : {},
      notes: String(member.notes || "").trim(),
      birthdate: member.birthdate || null,
      official_history: Array.isArray(member.officialHistory) ? structuredClone(member.officialHistory) : []
    };
  },

  async create(member) {
    if (!this.isSharedMode()) {
      const created = { ...member, id: Date.now() };
      crew.push(created);
      saveCrew();
      return { success: true, data: created };
    }
    const { data, error } = await supabaseSharedRepository.createCrewMember(this.toHostedChanges(member));
    if (error) return { success: false, message: error.message || "Crew member could not be created." };
    const refresh = await this.loadAdministrativeCrew();
    return refresh.success ? { success: true, data: sharedDomainMappingService.mapCrewMember(data) } : refresh;
  },

  async updateMember(crewMemberId, changes) {
    if (!this.isSharedMode()) {
      const member = crew.find(item => String(item.id) === String(crewMemberId));
      if (!member) return { success: false, message: "Crew member not found." };
      Object.assign(member, changes);
      saveCrew();
      return { success: true, data: member };
    }
    const existing = this.getById(crewMemberId);
    if (!existing) return { success: false, message: "Crew member not found." };
    const { data, error } = await supabaseSharedRepository.updateCrewMember(crewMemberId, this.toHostedChanges({ ...existing, ...changes }));
    if (error) return { success: false, message: error.message || "Crew member could not be updated." };
    const refresh = await this.loadAdministrativeCrew();
    return refresh.success ? { success: true, data: sharedDomainMappingService.mapCrewMember(data) } : refresh;
  },

  async getLinkableLoginProfiles() {
    if (!this.isSharedMode()) return { success: true, data: [] };
    const { data, error } = await supabaseSharedRepository.getLinkableUmpireProfiles();
    return error ? { success: false, message: error.message || "Login accounts could not be loaded." } : { success: true, data: data || [] };
  },

  async manageLoginIdentity(crewMemberId, action, profileId = null) {
    if (!this.isSharedMode()) return { success: false, message: "Trusted identity linking requires hosted mode." };
    const { error } = await supabaseSharedRepository.manageCrewLoginIdentity(crewMemberId, action, profileId);
    if (error) return { success: false, message: error.message || "Login identity could not be updated." };
    const refresh = await this.loadAdministrativeCrew();
    return refresh.success ? { success: true, message: `Login identity ${action} completed.` } : refresh;
  },

  getAuthenticatedCrewMember() {
    return authenticatedCrewSnapshot ? structuredClone(authenticatedCrewSnapshot) : null;
  },

  async prepareReferencedCrewMembers(crewMemberIds = []) {
    if (!this.isSharedMode()) return [];
    const ids = [...new Set(crewMemberIds.map(String).filter(Boolean))]
      .filter(id => String(authenticatedCrewSnapshot?.id || "") !== id);
    const { data, error } = await supabaseSharedRepository.getCrewMembersByIds(ids);
    if (error) throw error;
    return (data || [])
      .map(sharedDomainMappingService.mapCrewMember)
      .filter(Boolean)
      .sort((left, right) => `${left.lastName}\u0000${left.firstName}\u0000${left.id}`.localeCompare(`${right.lastName}\u0000${right.firstName}\u0000${right.id}`));
  },

  publishReferencedCrewMembers(prepared = []) {
    referencedCrewSnapshots = structuredClone(prepared);
    return structuredClone(referencedCrewSnapshots);
  },

  async loadReferencedCrewMembers(crewMemberIds = []) {
    const prepared = await this.prepareReferencedCrewMembers(crewMemberIds);
    return this.publishReferencedCrewMembers(prepared);
  },

  getAll() {
    if (this.isSharedMode()) {
      if (administrativeCrewSnapshot) return structuredClone(administrativeCrewSnapshot);
      return structuredClone([authenticatedCrewSnapshot, ...referencedCrewSnapshots].filter(Boolean));
    }
    return Array.isArray(crew) ? crew : [];
  },

  getById(crewId) {
    if (!crewId) return null;

    return this.getAll().find(member =>
      String(member.id) === String(crewId)
    ) || null;
  },

  getByName(name) {
    if (!name) return null;

    const normalizedName = String(name)
      .trim()
      .toLowerCase();

    return this.getAll().find(member =>
      this.getName(member).toLowerCase() === normalizedName
    ) || null;
  },

  getName(member) {
    if (!member) return "Unknown Crew";

    const fullName =
      `${member.firstName || ""} ${member.lastName || ""}`.trim();

    if (fullName) return fullName;
    if (member.name) return member.name;
    if (member.email) return member.email;

    return "Unnamed Crew Member";
  },

  getDisplayName(crewId) {
    const member = this.getById(crewId);

    return member
      ? this.getName(member)
      : "Needs umpire";
  },

  getActive() {
    return this.getAll().filter(member =>
      this.isActive(member)
    );
  },

  getEligible(level) {
    return this.getActive().filter(member =>
      this.canWorkLevel(member, level)
    );
  },

  isActive(member) {
    return !!member && member.active !== false;
  },

  canWorkLevel(member, level) {
    if (!member || !level) return true;
    if (!Array.isArray(member.levels)) return true;

    return levelTerminologyService.normalizeLevels(member.levels).includes(levelTerminologyService.canonicalize(level));
  },

  normalizePreferenceArray(values) {
    if (!Array.isArray(values)) return [];

    const seen = new Set();

    return values
      .map(value => String(value || "").trim())
      .filter(value => {
        if (!value || seen.has(value)) {
          return false;
        }

        seen.add(value);
        return true;
      });
  },

  normalizePreferences(member) {
    if (!member) {
      return {
        preferredCrewIds: [],
        avoidedCrewIds: [],
        preferredLevels: []
      };
    }

    const source =
      member.preferences &&
      typeof member.preferences === "object"
        ? member.preferences
        : {};

    const selfId = String(member.id || "");

    let preferredCrewIds =
      this.normalizePreferenceArray(
        source.preferredCrewIds
      ).filter(id => id !== selfId);

    const avoidedCrewIds =
      this.normalizePreferenceArray(
        source.avoidedCrewIds
      ).filter(id => id !== selfId);

    const avoidedSet = new Set(avoidedCrewIds);

    /*
     * An avoided preference wins when the same crew member
     * appears in both arrays. This prevents contradictory
     * preference scoring.
     */
    preferredCrewIds = preferredCrewIds.filter(
      id => !avoidedSet.has(id)
    );

    const preferredLevels =
      this.normalizePreferenceArray(
        source.preferredLevels
      );

    member.preferences = {
      preferredCrewIds,
      avoidedCrewIds,
      preferredLevels
    };

    return member.preferences;
  },

  getPreferences(crewIdOrMember) {
    const member =
      typeof crewIdOrMember === "object"
        ? crewIdOrMember
        : this.getById(crewIdOrMember);

    return this.normalizePreferences(member);
  },

  setPreferences(crewId, preferences = {}) {
    const member = this.getById(crewId);

    if (!member) {
      return {
        success: false,
        message: "Crew member not found.",
        data: null
      };
    }

    member.preferences = {
      preferredCrewIds:
        preferences.preferredCrewIds,
      avoidedCrewIds:
        preferences.avoidedCrewIds,
      preferredLevels:
        preferences.preferredLevels
    };

    const normalized =
      this.normalizePreferences(member);

    if (typeof saveCrew === "function") {
      saveCrew();
    }

    return {
      success: true,
      message: "Crew preferences saved.",
      data: normalized
    };
  },

  getAvailability(gameId, crewId) {
    const member = this.getById(crewId);

    if (!member) return "unknown";

    if (!member.availability) {
      member.availability = {};
    }

    return member.availability[gameId] || "unknown";
  },

  setAvailability(gameId, crewId, status) {
    const member = this.getById(crewId);

    if (!member) return false;

    if (!member.availability) {
      member.availability = {};
    }

    member.availability[gameId] = status;

    if (typeof saveCrew === "function") {
      saveCrew();
    }

    return true;
  },

  isAvailable(gameId, crewId) {
    return (
      this.getAvailability(gameId, crewId) ===
      "available"
    );
  }
};
