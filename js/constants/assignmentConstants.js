// assignmentConstants.js

const AssignmentStatus = Object.freeze({
  NEEDS_ASSIGNMENT: "needs_assignment",
  OPEN_FOR_CLAIM: "open_for_claim",
  PENDING_APPROVAL: "pending_approval",
  ASSIGNED: "assigned",
  LOCKED: "locked"
});

const AssignmentMode = Object.freeze({
  ADMIN_ONLY: "admin_only",
  OPEN_CLAIM: "open_claim",
  INVITE_ONLY: "invite_only",
  LOCKED: "locked"
});