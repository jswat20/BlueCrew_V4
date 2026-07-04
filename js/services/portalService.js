// js/services/portalService.js

const portalService = (() => {
  function getCurrentAccount() {
    return loginService.getCurrentAccount();
  }

  function getMySchedule() {
    const account = getCurrentAccount();

    if (!account || !account.crewId) {
      return [];
    }

    return gameService
      .getAll()
      .filter(game => isGameAssignedToCrew(game, account.crewId))
      .sort(sortByDateTime)
      .map(game => ({
        id: game.id,
        date: game.date,
        time: game.time,
        field: game.field,
        level: game.level,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        matchup: `${game.awayTeam} @ ${game.homeTeam}`,
        assignmentStatus: assignmentService.getStatus(game),
        assignmentStatusLabel:
          typeof getAssignmentStatusLabel === "function"
            ? getAssignmentStatusLabel(game)
            : assignmentService.getStatus(game)
      }));
  }

  function isGameAssignedToCrew(game, crewId) {
    if (String(game.crewId) === String(crewId)) {
      return true;
    }

    if (!Array.isArray(game.assignments)) {
      return false;
    }

    return game.assignments.some(
      assignment => String(assignment.crewId) === String(crewId)
    );
  }

  function sortByDateTime(a, b) {
    return `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);
  }

  function getClaimableGames() {
    const account = getCurrentAccount();

    if (!account || !account.crewId) {
      return [];
    }

    return gameService
      .getAll()
      .filter(game =>
        assignmentService.getStatus(game) === AssignmentStatus.OPEN_FOR_CLAIM
      )
      .sort(sortByDateTime)
      .map(game => ({
        id: game.id,
        date: game.date,
        time: game.time,
        field: game.field,
        level: game.level,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        matchup: `${game.awayTeam} @ ${game.homeTeam}`,
        assignmentStatus: assignmentService.getStatus(game),
        assignmentStatusLabel:
          typeof getAssignmentStatusLabel === "function"
            ? getAssignmentStatusLabel(game)
            : assignmentService.getStatus(game)
      }));
  }

  return {
    getCurrentAccount,
    getMySchedule,
    getClaimableGames,
  };
})();