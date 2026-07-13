// js/services/recommendationService.js

const DATE_AVAILABILITY_PENALTIES = Object.freeze({
  available: 0,
  maybe: -20,
  unavailable: -60
});

const CREW_PREFERENCE_SCORES = Object.freeze({
  preferredPartner: 20,
  avoidedPartner: -30,
  preferredLevel: 10
});

function evaluateCrew(
  crewId,
  game,
  position = "Plate"
) {
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
    typeof availabilityService.getAvailability !==
      "function"
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
    DATE_AVAILABILITY_PENALTIES[
      dateAvailability
    ] ?? 0;

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

function normalizeAssignedCrewIds(values) {
  if (!Array.isArray(values)) return [];

  return [
    ...new Set(
      values
        .map(value => String(value || "").trim())
        .filter(Boolean)
    )
  ];
}

function evaluatePreferences(
  member,
  game,
  options = {}
) {
  const assignedCrewIds =
    normalizeAssignedCrewIds(
      options.assignedCrewIds
    );

  const preferences =
    typeof crewService.getPreferences === "function"
      ? crewService.getPreferences(member)
      : {
          preferredCrewIds: [],
          avoidedCrewIds: [],
          preferredLevels: []
        };

  const preferredCrewIds = new Set(
    preferences.preferredCrewIds || []
  );

  const avoidedCrewIds = new Set(
    preferences.avoidedCrewIds || []
  );

  const preferenceMatches = [];
  const reasons = [];

  let preferenceScore = 0;

  assignedCrewIds
    .filter(id => id !== String(member.id))
    .forEach(assignedCrewId => {
      if (preferredCrewIds.has(assignedCrewId)) {
        preferenceScore +=
          CREW_PREFERENCE_SCORES.preferredPartner;

        preferenceMatches.push({
          type: "preferred_partner",
          crewId: assignedCrewId,
          score:
            CREW_PREFERENCE_SCORES.preferredPartner
        });

        reasons.push(
          "Preferred partner is already assigned to this game."
        );
      }

      if (avoidedCrewIds.has(assignedCrewId)) {
        preferenceScore +=
          CREW_PREFERENCE_SCORES.avoidedPartner;

        preferenceMatches.push({
          type: "avoided_partner",
          crewId: assignedCrewId,
          score:
            CREW_PREFERENCE_SCORES.avoidedPartner
        });

        reasons.push(
          "An avoided partner is already assigned to this game."
        );
      }
    });

  if (
    game?.level &&
    Array.isArray(preferences.preferredLevels) &&
    preferences.preferredLevels.includes(game.level)
  ) {
    preferenceScore +=
      CREW_PREFERENCE_SCORES.preferredLevel;

    preferenceMatches.push({
      type: "preferred_level",
      level: game.level,
      score:
        CREW_PREFERENCE_SCORES.preferredLevel
    });

    reasons.push(
      "Crew member prefers this game level."
    );
  }

  return {
    preferenceScore,
    preferenceMatches,
    reasons
  };
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

    if (
      !member.levels ||
      member.levels.length === 0
    ) {
      return true;
    }

    return member.levels.includes(game.level);
  },

  scoreCrewForGame(
    member,
    game,
    options = {}
  ) {
    const crewId = member.id;

    const evaluation =
      evaluateCrew(
        crewId,
        game,
        options.position || "Plate"
      );

    /*
     * Legacy game-specific availability remains supported.
     *
     * This is separate from date-based availability and must
     * retain its existing behavior for backward compatibility.
     */
    const availability =
      crewService.getAvailability(
        game.id,
        crewId
      );

    const dateAvailability =
      getDateAvailability(crewId, game);

    let score = evaluation.score;

    const reasons =
      Array.isArray(evaluation.reasons)
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
        reasons.push(
          "No availability response"
        );
    }

    score = applyDateAvailability(
      score,
      reasons,
      dateAvailability
    );

    const preferenceEvaluation =
      evaluatePreferences(
        member,
        game,
        options
      );

    score +=
      preferenceEvaluation.preferenceScore;

    reasons.push(
      ...preferenceEvaluation.reasons
    );

    return {
      crewId,
      member,
      name: crewService.getName(member),

      score,

      preferenceScore:
        preferenceEvaluation.preferenceScore,

      preferenceMatches:
        preferenceEvaluation.preferenceMatches,

      /*
       * Existing legacy result field.
       */
      availability,

      /*
       * Advisory date-based availability field.
       */
      dateAvailability,

      eligible: evaluation.eligible,
      available: evaluation.available,
      active: evaluation.active,
      conflict: evaluation.conflict,

      /*
       * Preferred public field for recommendation consumers.
       */
      workload: evaluation.workload,

      /*
       * Backward-compatible alias for existing callers.
       */
      workloadCount: evaluation.workload,

      reasons
    };
  },

  rankRecommendations(recommendations) {
    if (!Array.isArray(recommendations)) {
      return [];
    }

    return [...recommendations].sort((a, b) => {
      const scoreDifference =
        Number(b?.score || 0) -
        Number(a?.score || 0);

      if (scoreDifference !== 0) {
        return scoreDifference;
      }

      const nameDifference =
        String(a?.name || "").localeCompare(
          String(b?.name || "")
        );

      if (nameDifference !== 0) {
        return nameDifference;
      }

      return String(a?.crewId || "").localeCompare(
        String(b?.crewId || "")
      );
    });
  },

  getRecommendedCrewForGame(
    game,
    options = {}
  ) {
    return this.rankRecommendations(
      crewService
        .getAll()
        .map(member =>
          this.scoreCrewForGame(
            member,
            game,
            options
          )
        )
    );
  },

  getBestCrewForGame(
    game,
    options = {}
  ) {
    return (
      this.getRecommendedCrewForGame(
        game,
        options
      )[0] || null
    );
  }
};