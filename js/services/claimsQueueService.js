const claimsQueueService = (() => {
    function requireApproveClaims() {
    if (
      typeof authorizationService !== "undefined" &&
      !authorizationService.canApproveClaims()
    ) {
      return mutationResult(false, "Unauthorized.");
    }

    return null;
  }
  function mutationResult(success, message, data = null) {
    return {
      success,
      message,
      data
    };
  }
  function resolveClaimantName(crewMemberId) {
    if (!crewMemberId || typeof crewService === "undefined") return "Unknown Umpire";
    const member = typeof crewService.getById === "function"
      ? crewService.getById(String(crewMemberId))
      : null;
    return member && typeof crewService.getName === "function"
      ? crewService.getName(member)
      : "Unknown Umpire";
  }
  function getClaimsByStatus(status) {
    return gameService
      .getAll()
      .flatMap(game =>
        (game.assignments || [])
          .filter(assignment => assignment.status === status)
          .map(assignment => ({
            game,
            assignment,
            gameId: game.id,
            assignmentId: assignment.id,
            claimId: assignment.claimId || "",
            matchup: `${game.awayTeam} @ ${game.homeTeam}`,
            date: game.date,
            time: game.time,
            locationComplex: game.locationComplex || "",
            locationField: game.locationField || game.field || "",
            field: locationService.getDisplayName(game),
            level: game.level,
            position: assignment.position,
            claimedBy: assignment.claimedBy,
            claimedByName:
              assignment.claimedByName ||
              resolveClaimantName(assignment.claimedBy),
            status: assignment.status
          }))
      );
  }

  function getPendingClaims() {
    return getClaimsByStatus(AssignmentStatus.PENDING_APPROVAL);
  }

  function matchesDateRange(claim, dateRange) {
    if (!dateRange || dateRange === "all") return true;

    const processedAt = claim.assignment.claimProcessedAt || claim.date;

    if (!processedAt) return false;

    const claimDate = new Date(processedAt);
    const today = new Date();

    claimDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const diffDays = Math.floor(
      (today.getTime() - claimDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (dateRange === "today") return diffDays === 0;
    if (dateRange === "7") return diffDays >= 0 && diffDays <= 7;
    if (dateRange === "30") return diffDays >= 0 && diffDays <= 30;

    return true;
  }

  function getClaimHistory(options = {}) {
    const {
      status = "all",
      dateRange = "all",
      sort = "desc"
    } = options;

    let claims = [
      ...getClaimsByStatus(AssignmentStatus.ASSIGNED)
        .filter(
          claim =>
            claim.assignment.claimProcessed &&
            claim.assignment.claimStatus === "approved"
        ),

      ...getClaimsByStatus(AssignmentStatus.OPEN_FOR_CLAIM)
        .filter(
          claim =>
            claim.assignment.claimProcessed &&
            claim.assignment.claimStatus === "rejected"
        ),

      ...getClaimsByStatus(AssignmentStatus.NEEDS_ASSIGNMENT)
        .filter(claim => claim.assignment.claimProcessed && claim.assignment.claimStatus === "withdrawn")
    ];

    if (status !== "all") {
      claims = claims.filter(
        claim => claim.assignment.claimStatus === status
      );
    }

    claims = claims.filter(claim => matchesDateRange(claim, dateRange));

    claims.sort((a, b) => {
      const aTime = new Date(
        a.assignment.claimProcessedAt || a.date || 0
      ).getTime();

      const bTime = new Date(
        b.assignment.claimProcessedAt || b.date || 0
      ).getTime();

      return sort === "asc"
        ? aTime - bTime
        : bTime - aTime;
    });

    return claims;
  }

  function getClaimHistorySummary() {
    const approvedClaims = getClaimHistory({ status: "approved" });
    const rejectedClaims = getClaimHistory({ status: "rejected" });
    const withdrawnClaims = getClaimHistory({ status: "withdrawn" });
    const today = new Date().toISOString().split("T")[0];

    return {
      approvedToday: approvedClaims.filter(claim =>
        claim.assignment.claimProcessedAt?.startsWith(today)
      ).length,

      rejectedToday: rejectedClaims.filter(claim =>
        claim.assignment.claimProcessedAt?.startsWith(today)
      ).length,

      totalApproved: approvedClaims.length,
      totalRejected: rejectedClaims.length,
      totalWithdrawn: withdrawnClaims.length
    };
  }

  function getApprovedClaims() {
    return getClaimHistory({
      status: "approved"
    });
  }

  function getRejectedClaims() {
    return getClaimHistory({
      status: "rejected"
    });
  }

function approveClaim(gameId, assignmentId, claimId) {
  const denied = requireApproveClaims();

  if (denied) {
    return denied;
  }

  return assignmentService.approveClaim(
    gameId,
    assignmentId,
    claimId
  );
}

function rejectClaim(gameId, assignmentId, claimId) {
  const denied = requireApproveClaims();

  if (denied) {
    return denied;
  }

  return assignmentService.rejectClaim(
    gameId,
    assignmentId,
    claimId
  );
}

  return {
    getPendingClaims,
    getClaimHistory,
    getClaimHistorySummary,
    getApprovedClaims,
    getRejectedClaims,
    approveClaim,
    rejectClaim
  };
})();
