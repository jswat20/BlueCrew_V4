// js/services/recommendationService.js

const DATE_AVAILABILITY_PENALTIES = Object.freeze({
  available: 0,
  maybe: -20,
  unavailable: -60
});

function evaluateCrew(crewId, game, position = "Plate") {
  if (
    typeof availabilityService !== "undefined" &&
    typeof availabilityService.evaluate === "function"
  ) {
    return availabilityService.evaluate(
      crewId,
      game,
      position
    );
  }

  return {
    eligible: true,
    available: true,
    active: true,
    conflict: false,
    workload: 0,
    score: 100,
    reasons: []
  };
}

function getDateAvailability(crewId, game) {
  if (
    !game?.date ||
    typeof availabilityService === "undefined" ||
    typeof availabilityService.getAvailability !== "function"
  ) {
    return "available";
  }

  return (
    availabilityService.getAvailability(
      crewId,
      game.date
    ) || "available"
  );
}

function applyDateAvailability(
  score,
  reasons,
  dateAvailability
) {
  const penalty =
    DATE_AVAILABILITY_PENALTIES[dateAvailability] ?? 0;

  switch (dateAvailability) {
    case "maybe":
      reasons.push(
        "Crew member marked Maybe for this date."
      );
      break;

    case "unavailable":
      reasons.push(
        "Crew member marked Unavailable for this date."
      );
      break;
  }

  return score + penalty;
}

const recommendationService = {
  hasSameTimeConflict(game, crewId) {
    return gameService.getAll().some(otherGame => {
      return (
        String(otherGame.id) !== String(game.id) &&
        otherGame.date === game.date &&
        otherGame.time === game.time &&
        String(otherGame.crewId) === String(crewId)
      );
    });
  },

  isCrewEligibleForGame(crewId, game) {
    const member = crewService.getById(crewId);

    if (!member) return false;

    if (!member.levels || member.levels.length === 0) {
      return true;
    }

    return member.levels.includes(game.level);
  },

  scoreCrewForGame(member, game) {
    const crewId = member.id;

    const evaluation =
      evaluateCrew(crewId, game);

    /*
     * Legacy game-specific availability remains supported.
     *
     * This is separate from date-based availability and must
     * retain its existing behavior for backward compatibility.
     */
    const availability =
      crewService.getAvailability(game.id, crewId);

    const dateAvailability =
      getDateAvailability(crewId, game);

    let score = evaluation.score;

    const reasons = Array.isArray(evaluation.reasons)
      ? [...evaluation.reasons]
      : [];

    switch (availability) {
      case "available":
        score += 30;
        reasons.push("Marked Available");
        break;

      case "unavailable":
        score -= 500;
        reasons.push("Unavailable");
        break;

      default:
        reasons.push("No availability response");
    }

    score = applyDateAvailability(
      score,
      reasons,
      dateAvailability
    );

    return {
      crewId,
      member,
      name: crewService.getName(member),

      score,

      /*
       * Existing legacy result field.
       */
      availability,

      /*
       * New advisory date-based availability field.
       */
      dateAvailability,

      eligible: evaluation.eligible,
      available: evaluation.available,
      active: evaluation.active,
      conflict: evaluation.conflict,

      workloadCount: evaluation.workload,

      reasons
    };
  },

  rankRecommendations(recommendations) {
    return recommendations.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return a.name.localeCompare(b.name);
    });
  },

  getRecommendedCrewForGame(game) {
    return this.rankRecommendations(
      crewService
        .getAll()
        .map(member =>
          this.scoreCrewForGame(member, game)
        )
    );
  },

  getBestCrewForGame(game) {
    return (
      this.getRecommendedCrewForGame(game)[0] ||
      null
    );
  }
};