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
      .map(mapGame);
  }

  function getClaimableGames() {
    const account = getCurrentAccount();

    if (!account || !account.crewId) {
      return [];
    }

    return assignmentService
      .getClaimableGames()
      .sort(sortByDateTime)
      .map(mapGame);
  }

  function claimGame(gameId) {
    const account = getCurrentAccount();

    if (!account || !account.crewId) {
      return {
        success: false,
        message: "No logged in umpire."
      };
    }

    return assignmentService.claimGame(
      gameId,
      account.crewId
    );
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

  function mapGame(game) {
    return {
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
    };
  }

  function sortByDateTime(a, b) {
    return `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);
  }

  return {
    getCurrentAccount,
    getMySchedule,
    getClaimableGames,
    claimGame
  };
})();