const claimsQueueService = (() => {
  function getPendingClaims() {
    return gameService
      .getAll()
      .flatMap(game =>
        (game.assignments || [])
          .filter(assignment =>
            assignment.status === AssignmentStatus.PENDING_APPROVAL
          )
          .map(assignment => ({
            game,
            assignment
          }))
      );
  }

  function approveClaim(gameId, assignmentId) {
    return assignmentService.approveClaim(gameId, assignmentId);
  }

  function rejectClaim(gameId, assignmentId) {
    return assignmentService.rejectClaim(gameId, assignmentId);
  }

  return {
    getPendingClaims,
    approveClaim,
    rejectClaim
  };
})();