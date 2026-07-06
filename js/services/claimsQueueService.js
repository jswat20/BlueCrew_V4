const claimsQueueService = (() => {
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
            matchup: `${game.awayTeam} @ ${game.homeTeam}`,
            date: game.date,
            time: game.time,
            field: game.field,
            level: game.level,
            position: assignment.position,
            claimedBy: assignment.claimedBy,
            claimedByName:
              assignment.claimedByName ||
              assignment.claimedBy ||
              "Unknown Umpire",
            status: assignment.status
          }))
      );
  }

  function getPendingClaims() {
    return getClaimsByStatus(AssignmentStatus.PENDING_APPROVAL);
  }

  function getClaimHistory(options = {}) {
    const {
      status = "all",
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
        )
    ];

    if (status !== "all") {
      claims = claims.filter(
        claim => claim.assignment.claimStatus === status
      );
    }

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
    const today = new Date().toISOString().split("T")[0];

    return {
      approvedToday: approvedClaims.filter(claim =>
        claim.assignment.claimProcessedAt?.startsWith(today)
      ).length,

      rejectedToday: rejectedClaims.filter(claim =>
        claim.assignment.claimProcessedAt?.startsWith(today)
      ).length,

      totalApproved: approvedClaims.length,
      totalRejected: rejectedClaims.length
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

  function approveClaim(gameId, assignmentId) {
    return assignmentService.approveClaim(gameId, assignmentId);
  }

  function rejectClaim(gameId, assignmentId) {
    return assignmentService.rejectClaim(gameId, assignmentId);
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