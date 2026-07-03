// js/services/crewService.js

const crewService = {
  getAll() {
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

    const normalizedName = String(name).trim().toLowerCase();

    return this.getAll().find(member =>
      this.getName(member).toLowerCase() === normalizedName
    ) || null;
  },

  getName(member) {
    if (!member) return "Unknown Crew";

    const fullName = `${member.firstName || ""} ${member.lastName || ""}`.trim();

    if (fullName) return fullName;
    if (member.name || `${member.firstName || ""} ${member.lastName || ""}`.trim() || member.email || "Unnamed Crew Member") return member.name || `${member.firstName || ""} ${member.lastName || ""}`.trim() || member.email || "Unnamed Crew Member";
    if (member.email) return member.email;

    return "Unnamed Crew";
  },

  getDisplayName(crewId) {
    const member = this.getById(crewId);
    return member ? this.getName(member) : "Needs umpire";
  },

  getActive() {
    return this.getAll().filter(member => this.isActive(member));
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

  return member.levels.includes(level);
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

  saveCrew();

  return true;
},

isAvailable(gameId, crewId) {
  return this.getAvailability(gameId, crewId) === "available";
}
};