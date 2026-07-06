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

  function getApprovedClaims() {
  return getClaimsByStatus(AssignmentStatus.ASSIGNED)
    .filter(claim => claim.assignment.claimProcessed && claim.assignment.claimStatus === "approved");
}

function getRejectedClaims() {
  return getClaimsByStatus(AssignmentStatus.OPEN_FOR_CLAIM)
    .filter(claim => claim.assignment.claimProcessed && claim.assignment.claimStatus === "rejected");
}

  function approveClaim(gameId, assignmentId) {
    return assignmentService.approveClaim(gameId, assignmentId);
  }

  function rejectClaim(gameId, assignmentId) {
    return assignmentService.rejectClaim(gameId, assignmentId);
  }

  return {
    getPendingClaims,
    getApprovedClaims,
    getRejectedClaims,
    approveClaim,
    rejectClaim
  };
})();