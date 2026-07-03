// js/services/availabilityService.js

const availabilityService = (() => {
  const MAX_GAMES_PER_DAY = 2;

  function evaluate(crewId, game, position = "Plate") {
    const crew = crewService.getById(crewId);

    const result = {
      crewId,
      gameId: game?.id || "",
      position,
      active: true,
      eligible: true,
      available: true,
      conflict: false,
      workload: 0,
      score: 100,
      reasons: []
    };

    if (!crew) {
      result.active = false;
      result.eligible = false;
      result.available = false;
      result.score = 0;
      result.reasons.push("Crew member not found.");
      return result;
    }

    if (crew.active === false) {
      result.active = false;
      result.eligible = false;
      result.available = false;
      result.score -= 60;
      result.reasons.push("Crew member is inactive.");
    }

    if (hasConflict(crewId, game)) {
      result.conflict = true;
      result.available = false;
      result.score -= 50;
      result.reasons.push("Already assigned to another game at this time.");
    }

    result.workload = getDailyWorkload(crewId, game);

    if (result.workload >= MAX_GAMES_PER_DAY) {
      result.available = false;
      result.score -= 25;
      result.reasons.push("Maximum games reached for this day.");
    }

    if (!isEligible(crew, game)) {
      result.eligible = false;
      result.available = false;
      result.score -= 35;
      result.reasons.push("Crew member is not eligible for this game level.");
    }

    result.score = Math.max(0, result.score);

    return result;
  }

  function canAssign(crewId, game, position = "Plate") {
    const result = evaluate(crewId, game, position);

    return {
      success: result.available && result.eligible && !result.conflict,
      message:
        result.reasons.length > 0
          ? result.reasons.join(" ")
          : "Crew member can be assigned.",
      data: result
    };
  }

  function isAvailable(crewId, game, position = "Plate") {
    return canAssign(crewId, game, position).success;
  }

  function getAvailabilityScore(crewId, game, position = "Plate") {
    return evaluate(crewId, game, position).score;
  }

  function hasConflict(crewId, game) {
    if (!crewId || !game) return false;

    if (
      typeof conflictService !== "undefined" &&
      conflictService.hasConflict
    ) {
      return conflictService.hasConflict(crewId, game);
    }

    return gameService.getAll().some(otherGame => {
      if (String(otherGame.id) === String(game.id)) return false;

      const sameDate = otherGame.date === game.date;
      const sameTime = otherGame.time === game.time;

      if (!sameDate || !sameTime) return false;

      if (otherGame.crewId === crewId) return true;

      if (Array.isArray(otherGame.assignments)) {
        return otherGame.assignments.some(assignment =>
          assignment.crewId === crewId
        );
      }

      return false;
    });
  }

  function getDailyWorkload(crewId, game) {
    if (!crewId || !game) return 0;

    if (
      typeof workloadService !== "undefined" &&
      workloadService.getDailyWorkload
    ) {
      return workloadService.getDailyWorkload(crewId, game.date);
    }

    return gameService.getAll().filter(otherGame => {
      if (otherGame.date !== game.date) return false;

      if (otherGame.crewId === crewId) return true;

      if (Array.isArray(otherGame.assignments)) {
        return otherGame.assignments.some(assignment =>
          assignment.crewId === crewId
        );
      }

      return false;
    }).length;
  }

  function isEligible(crew, game) {
    if (!crew || !game) return false;

    if (
      typeof recommendationService !== "undefined" &&
      recommendationService.isCrewEligibleForGame
    ) {
      return recommendationService.isCrewEligibleForGame(crew.id, game);
    }

    if (!crew.levels || !game.level) {
      return true;
    }

    return crew.levels.includes(game.level);
  }

  return {
    evaluate,
    canAssign,
    isAvailable,
    getAvailabilityScore
  };
})();