// js/services/assignmentService.js

const assignmentService = (() => {
  const STATUS = {
    NEEDS_ASSIGNMENT: "needs_assignment",
    OPEN_FOR_CLAIM: "open_for_claim",
    PENDING_APPROVAL: "pending_approval",
    ASSIGNED: "assigned",
    LOCKED: "locked"
  };

  function getGames() {
    if (typeof gameService !== "undefined" && gameService.getAll) {
      return gameService.getAll();
    }

    if (typeof getGamesFromStorage === "function") {
      return getGamesFromStorage();
    }

    return JSON.parse(localStorage.getItem("bluecrew_games")) || [];
  }

  function saveGames(games) {
    if (typeof gameService !== "undefined" && gameService.save) {
      gameService.save();
      return;
    }

    if (typeof storageService !== "undefined" && storageService.saveGames) {
      storageService.saveGames(games);
      return;
    }

    if (typeof saveGamesToStorage === "function") {
      saveGamesToStorage(games);
      return;
    }

    localStorage.setItem("bluecrew_games", JSON.stringify(games));
  }

  function findGame(gameId) {
    const games = getGames();
    const game = games.find(item => String(item.id) === String(gameId));
    return { games, game };
  }

  function getCrewSize(game) {
    if (
      typeof gameTypeService !== "undefined" &&
      typeof gameTypeService.getCrewSize === "function"
    ) {
      return gameTypeService.getCrewSize(game);
    }

    if (
      typeof crewConfigurationService !== "undefined" &&
      typeof crewConfigurationService.getCrewSize === "function"
    ) {
      return crewConfigurationService.getCrewSize(game);
    }

    return 1;
  }

  function getPositionsForGame(game) {
    if (
      typeof crewConfigurationService !== "undefined" &&
      typeof crewConfigurationService.getPositionsForGame === "function"
    ) {
      const positions = crewConfigurationService.getPositionsForGame(game);
      if (Array.isArray(positions) && positions.length) return positions;
    }

    if (
      typeof crewConfigurationService !== "undefined" &&
      typeof crewConfigurationService.getAssignmentPositions === "function"
    ) {
      const positions = crewConfigurationService.getAssignmentPositions(game);
      if (Array.isArray(positions) && positions.length) return positions;
    }

    const size = Number(getCrewSize(game)) || 1;

    const fallback = ["Plate", "Base", "U3", "U4", "Observer", "Mentor"];
    return fallback.slice(0, Math.max(1, Math.min(size, fallback.length)));
  }

  function createAssignment(game, position, index) {
    const normalizedPosition = position || `Position ${index + 1}`;

    return {
      id: `${game.id}-${normalizedPosition.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      gameId: game.id,
      position: normalizedPosition,
      crewId: index === 0 ? game.crewId || "" : "",
      status:
        index === 0
          ? game.assignmentStatus || (game.crewId ? STATUS.ASSIGNED : STATUS.NEEDS_ASSIGNMENT)
          : STATUS.NEEDS_ASSIGNMENT,
      locked: index === 0 ? game.assignmentStatus === STATUS.LOCKED : false,
      claimedBy: index === 0 ? game.claimedBy || "" : ""
    };
  }

  function normalizeGame(game) {
    if (!game) return null;

    const positions = getPositionsForGame(game);

    if (!Array.isArray(game.assignments)) {
      game.assignments = [];
    }

    positions.forEach((position, index) => {
      let assignment = game.assignments.find(item => item.position === position);

      if (!assignment) {
        assignment = createAssignment(game, position, index);
        game.assignments.push(assignment);
      }

      assignment.id = assignment.id || `${game.id}-${position.toLowerCase()}`;
      assignment.gameId = game.id;
      assignment.position = assignment.position || position;
      assignment.crewId = assignment.crewId || "";
      assignment.claimedBy = assignment.claimedBy || "";
      assignment.status =
        assignment.status ||
        (assignment.crewId ? STATUS.ASSIGNED : STATUS.NEEDS_ASSIGNMENT);
      assignment.locked =
        assignment.locked === true || assignment.status === STATUS.LOCKED;
    });

    syncLegacyFields(game);
    return game;
  }

  function normalizeAllGames() {
    const games = getGames();
    games.forEach(normalizeGame);
    saveGames(games);
    return games;
  }

  function getAssignments(game) {
    return normalizeGame(game)?.assignments || [];
  }

  function getPrimaryAssignment(game) {
    return getAssignments(game)[0] || null;
  }

  function getAssignment(game, position = "Plate") {
    return getAssignments(game).find(item => item.position === position) || null;
  }

  function getAssignmentById(game, assignmentId) {
    return getAssignments(game).find(item => String(item.id) === String(assignmentId)) || null;
  }

  function getFilledPositions(game) {
    return getAssignments(game).filter(item => item.crewId);
  }

  function getOpenPositions(game) {
    return getAssignments(game).filter(item => !item.crewId);
  }

  function getOverallStatusFromAssignments(assignments) {
    if (!assignments.length) return STATUS.NEEDS_ASSIGNMENT;

    if (assignments.every(item => item.status === STATUS.LOCKED || item.locked)) {
      return STATUS.LOCKED;
    }

    if (assignments.some(item => item.status === STATUS.PENDING_APPROVAL)) {
      return STATUS.PENDING_APPROVAL;
    }

    if (assignments.some(item => item.status === STATUS.OPEN_FOR_CLAIM)) {
      return STATUS.OPEN_FOR_CLAIM;
    }

    if (assignments.every(item => item.crewId)) {
      return STATUS.ASSIGNED;
    }

    return STATUS.NEEDS_ASSIGNMENT;
  }
function getOverallStatus(game) {
  normalizeGame(game);
  return getOverallStatusFromAssignments(game.assignments);
}

  function syncLegacyFields(game) {
    if (!game || !Array.isArray(game.assignments)) return game;

    const primary = game.assignments[0];

    if (!primary) {
      game.crewId = "";
      game.claimedBy = "";
      game.assignmentStatus = STATUS.NEEDS_ASSIGNMENT;
      return game;
    }

    game.crewId = primary.crewId || "";
    game.claimedBy = primary.claimedBy || "";
game.assignmentStatus = getOverallStatusFromAssignments(game.assignments);
    game.assignmentMode = game.assignmentMode || "manual";

    return game;
  }

  function mutationResult(success, message, data = null) {
    return { success, message, data };
  }

  function requireAssignGames() {
    if (
      typeof authorizationService !== "undefined" &&
      !authorizationService.canAssignGames()
    ) {
      return mutationResult(false, "Unauthorized.");
    }

    return null;
  }

  function assignPosition(gameId, position, crewId) {
    const authorization = requireAssignGames();

    if (authorization) {
      return authorization;
    }

    const { games, game } = findGame(gameId);

    if (!game) return mutationResult(false, "Game not found.");

    normalizeGame(game);

    const assignment = getAssignment(game, position);

    if (!assignment) {
      return mutationResult(false, `${position} assignment not found.`);
    }

    if (assignment.locked || assignment.status === STATUS.LOCKED) {
      return mutationResult(false, "This assignment is locked.");
    }

    assignment.crewId = crewId || "";
    assignment.claimedBy = "";
    assignment.status = crewId ? STATUS.ASSIGNED : STATUS.NEEDS_ASSIGNMENT;
    assignment.locked = false;

    game.assignmentMode = "manual";

    syncLegacyFields(game);
    saveGames(games);

    activityService?.log?.(
      crewId ? `${position} assigned.` : `${position} cleared.`,
      game
    );

    return mutationResult(
      true,
      crewId ? `${position} assigned.` : `${position} cleared.`,
      assignment
    );
  }

  function assignToAssignment(gameId, assignmentId, crewId) {
    const authorization = requireAssignGames();

    if (authorization) {
      return authorization;
    }

    const { games, game } = findGame(gameId);

    if (!game) return mutationResult(false, "Game not found.");

    normalizeGame(game);

    const assignment = getAssignmentById(game, assignmentId);

    if (!assignment) {
      return mutationResult(false, "Assignment not found.");
    }

    if (assignment.locked || assignment.status === STATUS.LOCKED) {
      return mutationResult(false, "This assignment is locked.");
    }

    assignment.crewId = crewId || "";
    assignment.claimedBy = "";
    assignment.status = crewId ? STATUS.ASSIGNED : STATUS.NEEDS_ASSIGNMENT;
    assignment.locked = false;

    game.assignmentMode = "manual";

    syncLegacyFields(game);
    saveGames(games);

    activityService?.log?.(
      crewId ? `${assignment.position} assigned.` : `${assignment.position} cleared.`,
      game
    );

    return mutationResult(
      true,
      crewId ? `${assignment.position} assigned.` : `${assignment.position} cleared.`,
      assignment
    );
  }

  function clearPosition(gameId, position) {
    return assignPosition(gameId, position, "");
  }
  function getEditableAssignments(game) {
  return getAssignments(game).filter(assignment =>
    !assignment.locked &&
    assignment.status !== STATUS.LOCKED
  );
}

function openAssignmentForClaims(gameId, assignmentId) {
  const authorization = requireAssignGames();

  if (authorization) {
    return authorization;
  }

  const { games, game } = findGame(gameId);

  if (!game) return mutationResult(false, "Game not found.");

  normalizeGame(game);

  const assignment = getAssignmentById(game, assignmentId);

  if (!assignment) return mutationResult(false, "Assignment not found.");

  if (assignment.locked || assignment.status === STATUS.LOCKED) {
    return mutationResult(false, "This assignment is locked.");
  }

  assignment.crewId = "";
  assignment.claimedBy = "";
  assignment.status = STATUS.OPEN_FOR_CLAIM;
  assignment.locked = false;

  game.assignmentMode = "claim";

  syncLegacyFields(game);
  saveGames(games);

  activityService?.log?.(`${assignment.position} opened for claims.`, game);

  return mutationResult(true, `${assignment.position} opened for claims.`, assignment);
}

function clearAssignmentSlot(gameId, assignmentId) {
  const authorization = requireAssignGames();

  if (authorization) {
    return authorization;
  }

  const { games, game } = findGame(gameId);

  if (!game) return mutationResult(false, "Game not found.");

  normalizeGame(game);

  const assignment = getAssignmentById(game, assignmentId);

  if (!assignment) return mutationResult(false, "Assignment not found.");

  if (assignment.locked || assignment.status === STATUS.LOCKED) {
    return mutationResult(false, "This assignment is locked.");
  }

  assignment.crewId = "";
  assignment.claimedBy = "";
  assignment.status = STATUS.NEEDS_ASSIGNMENT;
  assignment.locked = false;

  syncLegacyFields(game);
  saveGames(games);

  activityService?.log?.(`${assignment.position} cleared.`, game);

  return mutationResult(true, `${assignment.position} cleared.`, assignment);
}

function approveAssignmentClaim(gameId, assignmentId) {
  const { games, game } = findGame(gameId);

  if (!game) return mutationResult(false, "Game not found.");

  normalizeGame(game);

  const assignment = getAssignmentById(game, assignmentId);

  if (!assignment) return mutationResult(false, "Assignment not found.");

  if (assignment.status !== STATUS.PENDING_APPROVAL || !assignment.claimedBy) {
    return mutationResult(false, "No pending claim found for this position.");
  }

  assignment.crewId = assignment.claimedBy;
  assignment.claimedBy = "";
  assignment.status = STATUS.ASSIGNED;
  assignment.locked = false;

  game.assignmentMode = "claim";

  syncLegacyFields(game);
  saveGames(games);

  activityService?.log?.(`${assignment.position} claim approved.`, game);

  return mutationResult(true, `${assignment.position} claim approved.`, assignment);
}

function rejectAssignmentClaim(gameId, assignmentId) {
  const { games, game } = findGame(gameId);

  if (!game) return mutationResult(false, "Game not found.");

  normalizeGame(game);

  const assignment = getAssignmentById(game, assignmentId);

  if (!assignment) return mutationResult(false, "Assignment not found.");

  if (assignment.status !== STATUS.PENDING_APPROVAL || !assignment.claimedBy) {
    return mutationResult(false, "No pending claim found for this position.");
  }

  assignment.claimedBy = "";
  assignment.status = STATUS.OPEN_FOR_CLAIM;

  syncLegacyFields(game);
  saveGames(games);

activityService?.log?.(`${assignment.position} claim rejected.`, game);

  return mutationResult(true, `${assignment.position} claim rejected.`, assignment);
}

function lockAssignmentSlot(gameId, assignmentId) {
  const authorization = requireAssignGames();

  if (authorization) {
    return authorization;
  }

  const { games, game } = findGame(gameId);

  if (!game) return mutationResult(false, "Game not found.");

  normalizeGame(game);

  const assignment = getAssignmentById(game, assignmentId);

  if (!assignment) return mutationResult(false, "Assignment not found.");

  if (!assignment.crewId) {
    return mutationResult(false, "Cannot lock an open assignment.");
  }

  assignment.status = STATUS.LOCKED;
  assignment.locked = true;

  syncLegacyFields(game);
  saveGames(games);

  activityService?.log?.(`${assignment.position} locked.`, game);

  return mutationResult(true, `${assignment.position} locked.`, assignment);
}

  function assignCrew(gameId, crewId) {
    const { game } = findGame(gameId);
    if (!game) return mutationResult(false, "Game not found.");

    const primary = getPrimaryAssignment(game);
    if (!primary) return mutationResult(false, "Assignment not found.");

    return assignToAssignment(gameId, primary.id, crewId);
  }

  function updateAssignment(gameId, value) {
  const authorization = requireAssignGames();

  if (authorization) {
    return authorization;
  }

  // Legacy: updateAssignment(gameId, crewId)
  if (
    value === "" ||
    typeof value === "string" ||
    typeof value === "number"
  ) {
    return assignCrew(gameId, value);
  }

  // New object signature
  if (value && typeof value === "object") {
    if (value.status === "open_for_claim") {
      return openForClaims(gameId);
    }

    if (value.status === "locked") {
      return lockAssignment(gameId);
    }

    return assignCrew(gameId, value.crewId || "");
  }

  return {
    success: false,
    message: "Invalid assignment update."
  };
}

  function clearAssignment(gameId) {
    const authorization = requireAssignGames();

    if (authorization) {
      return authorization;
    }

    const { games, game } = findGame(gameId);

    if (!game) return mutationResult(false, "Game not found.");

    normalizeGame(game);

    getAssignments(game).forEach(assignment => {
      if (assignment.locked || assignment.status === STATUS.LOCKED) return;

      assignment.crewId = "";
      assignment.claimedBy = "";
      assignment.status = STATUS.NEEDS_ASSIGNMENT;
      assignment.locked = false;
    });

    game.assignmentMode = "manual";

    syncLegacyFields(game);
    saveGames(games);

    activityService?.log?.("Assignment cleared.", game);

    return mutationResult(true, "Assignment cleared.", game);
  }

  function openForClaims(gameId) {
    const authorization = requireAssignGames();

    if (authorization) {
      return authorization;
    }

    const { games, game } = findGame(gameId);

    if (!game) return mutationResult(false, "Game not found.");

    normalizeGame(game);

    getAssignments(game).forEach(assignment => {
  if (assignment.locked || assignment.status === STATUS.LOCKED) return;

  assignment.crewId = "";
  assignment.claimedBy = "";
  assignment.status = STATUS.OPEN_FOR_CLAIM;
  assignment.locked = false;
});

    game.assignmentMode = "claim";

    syncLegacyFields(game);
    saveGames(games);

    activityService?.log?.("Game opened for claims.", game);

    return mutationResult(true, "Game opened for claims.", game);
  }

  function claimGame(gameId, crewId) {
    const { games, game } = findGame(gameId);

    if (!game) return mutationResult(false, "Game not found.");

    normalizeGame(game);

    const assignment =
      getAssignments(game).find(item => item.status === STATUS.OPEN_FOR_CLAIM && !item.claimedBy) ||
      getPrimaryAssignment(game);

    if (!assignment || assignment.status !== STATUS.OPEN_FOR_CLAIM) {
      return mutationResult(false, "This game is not open for claims.");
    }

    assignment.claimedBy = crewId;
    assignment.status = STATUS.PENDING_APPROVAL;

    syncLegacyFields(game);
    saveGames(games);

    activityService?.log?.("Game claimed and awaiting approval.", game);

notificationService?.create?.({
  type: "claim-submitted",
  title: "New Claim Submitted",
  message: `${game.awayTeam} @ ${game.homeTeam} has been claimed and is awaiting approval.`,
  relatedId: game.id,
  audience: "admin"
});

    return mutationResult(true, "Claim submitted for approval.", game);
  }

  function approveClaim(gameId) {
    const { games, game } = findGame(gameId);

    if (!game) return mutationResult(false, "Game not found.");

    normalizeGame(game);

    const assignment =
      getAssignments(game).find(item => item.status === STATUS.PENDING_APPROVAL && item.claimedBy) ||
      getPrimaryAssignment(game);

    if (!assignment || !assignment.claimedBy) {
      return mutationResult(false, "No pending claim found.");
    }

    assignment.claimedByName =
  assignment.claimedByName ||
  assignment.claimedBy ||
  "Unknown Umpire";

assignment.claimProcessed = true;
assignment.claimStatus = "approved";

assignment.crewId = assignment.claimedBy;
assignment.claimedBy = "";
assignment.status = STATUS.ASSIGNED;

    game.assignmentMode = "claim";

    syncLegacyFields(game);
    saveGames(games);

    activityService?.log?.("Claim approved.", game);

notificationService?.create?.({
  type: "claim-approved",
  title: "Claim Approved",
  message: `${game.awayTeam} @ ${game.homeTeam} claim has been approved.`,
  relatedId: game.id,
  audience: "umpire"
});

    return mutationResult(true, "Claim approved.", game);
  }

  function rejectClaim(gameId) {
    const { games, game } = findGame(gameId);

    if (!game) return mutationResult(false, "Game not found.");

    normalizeGame(game);

    const assignment =
      getAssignments(game).find(item => item.status === STATUS.PENDING_APPROVAL && item.claimedBy) ||
      getPrimaryAssignment(game);

    if (!assignment || !assignment.claimedBy) {
      return mutationResult(false, "No pending claim found.");
    }

    assignment.claimedByName =
  assignment.claimedByName ||
  assignment.claimedBy ||
  "Unknown Umpire";

assignment.claimProcessed = true;
assignment.claimStatus = "rejected";

assignment.claimedBy = "";
assignment.status = STATUS.OPEN_FOR_CLAIM;

    syncLegacyFields(game);
    saveGames(games);

    activityService?.log?.("Claim rejected.", game);

notificationService?.create?.({
  type: "claim-rejected",
  title: "Claim Rejected",
  message: `${game.awayTeam} @ ${game.homeTeam} claim has been rejected.`,
  relatedId: game.id,
  audience: "umpire"
});

    return mutationResult(true, "Claim rejected.", game);
  }

  function lockAssignment(gameId) {
    const authorization = requireAssignGames();

    if (authorization) {
      return authorization;
    }

    const { games, game } = findGame(gameId);

    if (!game) return mutationResult(false, "Game not found.");

    normalizeGame(game);

    getAssignments(game).forEach(assignment => {
      assignment.status = STATUS.LOCKED;
      assignment.locked = true;
    });

    syncLegacyFields(game);
    saveGames(games);

    activityService?.log?.("Assignment locked.", game);

    return mutationResult(true, "Assignment locked.", game);
  }

  function unlockAssignment(gameId) {
    const authorization = requireAssignGames();

    if (authorization) {
      return authorization;
    }

    const { games, game } = findGame(gameId);

    if (!game) return mutationResult(false, "Game not found.");

    normalizeGame(game);

    getAssignments(game).forEach(assignment => {
      assignment.locked = false;
      assignment.status = assignment.crewId ? STATUS.ASSIGNED : STATUS.NEEDS_ASSIGNMENT;
    });

    syncLegacyFields(game);
    saveGames(games);

    activityService?.log?.("Assignment unlocked.", game);

    return mutationResult(true, "Assignment unlocked.", game);
  }

  function getStatus(game) {
    return getOverallStatus(game);
  }

  function getAssignedCrewId(game) {
    return getPrimaryAssignment(game)?.crewId || "";
  }

  function getClaimedBy(game) {
    return getPrimaryAssignment(game)?.claimedBy || "";
  }

  function isNeedsAssignment(game) {
    return getStatus(game) === STATUS.NEEDS_ASSIGNMENT;
  }

  function isOpenForClaim(game) {
    return getStatus(game) === STATUS.OPEN_FOR_CLAIM;
  }

  function isPendingApproval(game) {
    return getStatus(game) === STATUS.PENDING_APPROVAL;
  }

  function isAssigned(game) {
    return [STATUS.ASSIGNED, STATUS.LOCKED].includes(getStatus(game));
  }

  function isLocked(game) {
    return getStatus(game) === STATUS.LOCKED;
  }

  function getStatusInfo(game) {
    const status = getStatus(game);

    const map = {
      needs_assignment: {
        label: "Needs Crew",
        className: "status-needs-assignment",
        icon: "🔴"
      },
      open_for_claim: {
        label: "Open for Claim",
        className: "status-open-for-claim",
        icon: "🟡"
      },
      pending_approval: {
        label: "Pending Approval",
        className: "status-pending-approval",
        icon: "🟠"
      },
      assigned: {
        label: "Assigned",
        className: "status-assigned",
        icon: "🟢"
      },
      locked: {
        label: "Locked",
        className: "status-locked",
        icon: "🔒"
      }
    };

    return map[status] || map.needs_assignment;
  }

  function getWarnings(game, crewId) {
    if (!crewId) return [];

    if (
      typeof availabilityService !== "undefined" &&
      typeof availabilityService.evaluateAssignment === "function"
    ) {
      const evaluation = availabilityService.evaluateAssignment(crewId, game);

      if (Array.isArray(evaluation?.warnings)) {
        return evaluation.warnings;
      }

      if (Array.isArray(evaluation?.issues)) {
        return evaluation.issues.map(issue => ({
          type: issue.type || "warning",
          message: issue.message || "Review this assignment."
        }));
      }
    }

    return [];
  }

  function getAssignmentContext(gameId) {
    const { game } = findGame(gameId);

    if (!game) return null;

    normalizeGame(game);

    let recommendations = [];

    if (
      typeof recommendationService !== "undefined" &&
      typeof recommendationService.getRecommendedCrewForGame === "function"
    ) {
      recommendations = recommendationService.getRecommendedCrewForGame(game) || [];
    }

    const currentCrewId = getAssignedCrewId(game);
    const warnings = getWarnings(game, currentCrewId);
    const bestMatch = Array.isArray(recommendations) && recommendations.length
      ? recommendations[0]
      : null;

    return {
      game,
      assignments: getAssignments(game),
      recommendations,
      warnings,
      bestMatch,
      currentCrewId,
      issueType: getIssueType(game)
    };
  }

  function getIssueType(game) {
    if (isNeedsAssignment(game)) return "open_assignment";
    if (isOpenForClaim(game)) return "open_assignment";

    const assignments = getAssignments(game);

    const hasInactive = assignments.some(assignment => {
      if (!assignment.crewId || typeof crewService === "undefined") return false;
      const crew = crewService.getById?.(assignment.crewId);
      return !crew || crew.active === false;
    });

    if (hasInactive) return "inactive_assignment";

    return null;
  }

  function getTodaysAssignmentsForCrew(crewId) {
    const today = new Date().toISOString().split("T")[0];

    return normalizeAllGames().filter(game =>
      game.date === today &&
      getAssignments(game).some(assignment =>
        assignment.crewId === crewId &&
        [STATUS.ASSIGNED, STATUS.LOCKED].includes(assignment.status)
      )
    );
  }

  function getUpcomingAssignmentsForCrew(crewId) {
    const today = new Date().toISOString().split("T")[0];

    return normalizeAllGames().filter(game =>
      game.date >= today &&
      getAssignments(game).some(assignment =>
        assignment.crewId === crewId &&
        [STATUS.ASSIGNED, STATUS.LOCKED].includes(assignment.status)
      )
    );
  }

  function getPendingClaimsForCrew(crewId) {
    return normalizeAllGames().filter(game =>
      getAssignments(game).some(assignment =>
        assignment.claimedBy === crewId &&
        assignment.status === STATUS.PENDING_APPROVAL
      )
    );
  }

  function getClaimableGames() {
    return normalizeAllGames().filter(game =>
      getAssignments(game).some(assignment => assignment.status === STATUS.OPEN_FOR_CLAIM)
    );
  }

  function getNeedsAssignmentGames() {
    return normalizeAllGames().filter(isNeedsAssignment);
  }

  function getAssignedGames() {
    return normalizeAllGames().filter(isAssigned);
  }

  function getPendingApprovalGames() {
    return normalizeAllGames().filter(isPendingApproval);
  }

  function getOpenForClaimGames() {
    return getClaimableGames();
  }

  function getOpenGames() {
    return getClaimableGames();
  }

  function getLockedGames() {
    return normalizeAllGames().filter(isLocked);
  }

  function getUnassignedGames() {
    return getNeedsAssignmentGames();
  }

  function getAssignedCount() {
    return getAssignedGames().length;
  }

  function getNeedsAssignmentCount() {
    return getNeedsAssignmentGames().length;
  }

  function getPendingApprovalCount() {
    return getPendingApprovalGames().length;
  }

  function getOpenForClaimCount() {
    return getOpenForClaimGames().length;
  }

  function getInactiveAssignments() {
    return normalizeAllGames().filter(game =>
      getAssignments(game).some(assignment => {
        if (!assignment.crewId || typeof crewService === "undefined") return false;

        const crew = crewService.getById?.(assignment.crewId);
        return !crew || crew.active === false;
      })
    );
  }

  function getEligibilityIssues() {
    return normalizeAllGames().filter(game =>
      getAssignments(game).some(assignment => {
        if (!assignment.crewId) return false;

        if (
          typeof recommendationService !== "undefined" &&
          typeof recommendationService.isCrewEligibleForGame === "function"
        ) {
          return !recommendationService.isCrewEligibleForGame(assignment.crewId, game);
        }

        return false;
      })
    );
  }

  return {
    normalizeGame,
    normalizeAllGames,

    getAssignments,
    getPrimaryAssignment,
    getAssignment,
    getAssignmentById,
    getFilledPositions,
    getOpenPositions,

    getStatus,
    getStatusInfo,
    getAssignedCrewId,
    getClaimedBy,

    isNeedsAssignment,
    isOpenForClaim,
    isPendingApproval,
    isAssigned,
    isLocked,

    getAssignmentContext,
    getWarnings,

    assignCrew,
    updateAssignment,
    assignPosition,
    assignToAssignment,
    clearPosition,
    clearAssignment,
getEditableAssignments,

openAssignmentForClaims,
clearAssignmentSlot,
approveAssignmentClaim,
rejectAssignmentClaim,
lockAssignmentSlot,


    openForClaims,
    openForClaim: openForClaims,
    claimGame,
    approveClaim,
    rejectClaim,
    lockAssignment,
    unlockAssignment,

    getTodaysAssignmentsForCrew,
    getUpcomingAssignmentsForCrew,
    getPendingClaimsForCrew,
    getClaimableGames,
    getNeedsAssignmentGames,
    getAssignedGames,
    getPendingApprovalGames,
    getOpenForClaimGames,
    getOpenGames,
    getLockedGames,
    getUnassignedGames,

    getAssignedCount,
    getNeedsAssignmentCount,
    getPendingApprovalCount,
    getOpenForClaimCount,

    getInactiveAssignments,
    getEligibilityIssues
  };
})();