// Pure display formatting. Canonical domain values must never be mutated here.
const presentationFormattingService = (() => {
  const ASSIGNMENT_LABELS = Object.freeze({
    Plate: "U1",
    Base: "U2",
    U3: "U3",
    U4: "U4"
  });
  const STATUS_CLASSES = Object.freeze({
    "needs assignment": "status-badge-needs-assignment",
    assigned: "status-badge-assigned",
    scheduled: "status-badge-scheduled",
    "pending approval": "status-badge-pending-approval",
    completed: "status-badge-completed",
    approved: "status-badge-approved-semantic",
    cancelled: "status-badge-cancelled"
  });

  function getGreetingPeriod(date = new Date()) {
    const hour = date instanceof Date ? date.getHours() : new Date(date).getHours();
    if (hour < 12) return "Morning";
    if (hour < 18) return "Afternoon";
    return "Evening";
  }

  function formatGreeting({ name = "", role = "", date = new Date() } = {}) {
    const normalizedRole = String(role).toLowerCase();
    const suffix = ["admin", "administrator"].includes(normalizedRole) ? " (Admin)" : "";
    return `Good ${getGreetingPeriod(date)}, ${String(name).trim() || "User"}${suffix}`;
  }

  function formatAssignmentPosition(position, fallback = "—") {
    const canonical = String(position || "").trim();
    return ASSIGNMENT_LABELS[canonical] || canonical || fallback;
  }

  function getStatusBadgeClass(statusOrLabel, fallback = "status-badge-neutral") {
    return STATUS_CLASSES[String(statusOrLabel || "").trim().toLowerCase()] || fallback;
  }

  function formatGameIdentifier({
    year,
    seasonCode,
    organizationCode,
    leagueCode,
    level,
    canonicalLevel,
    sequence,
    gameNumber
  } = {}) {
    const normalize = value => String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    const sequenceValue = normalize(sequence ?? gameNumber);
    const parts = [
      normalize(year),
      normalize(seasonCode),
      normalize(organizationCode || leagueCode),
      normalize(canonicalLevel || level),
      sequenceValue ? sequenceValue.padStart(4, "0") : ""
    ].filter(Boolean);
    return parts.length ? parts.join("-") : "Game ID unavailable";
  }

  return Object.freeze({
    assignmentLabels: ASSIGNMENT_LABELS,
    statusClasses: STATUS_CLASSES,
    getGreetingPeriod,
    formatGreeting,
    formatAssignmentPosition,
    getStatusBadgeClass,
    formatGameIdentifier
  });
})();
