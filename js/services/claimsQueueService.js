const claimsQueueService = (() => {
  function getPendingClaims() {
    return gameService
      .getAll()
      .flatMap(game =>
        (game.assignments || [])
          .filter(
            assignment =>
              assignment.status === AssignmentStatus.PENDING_APPROVAL
          )
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