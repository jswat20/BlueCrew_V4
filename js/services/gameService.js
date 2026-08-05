// js/services/gameService.js

const GAME_LIFECYCLE_STATUSES = Object.freeze({
  SCHEDULED: "scheduled",
  COMPLETED: "completed",
  SUBMITTED: "submitted",
  RETURNED: "returned",
  APPROVED: "approved",
  POSTPONED: "postponed",
  CANCELLED: "cancelled"
});

const GAME_LIFECYCLE_TRANSITIONS = Object.freeze({
  scheduled: [
    "completed",
    "postponed",
    "cancelled"
  ],
  completed: [
    "submitted"
  ],
  submitted: [
    "returned",
    "approved"
  ],
  returned: [
    "submitted"
  ],
  approved: [],
  postponed: [
    "scheduled",
    "cancelled"
  ],
  cancelled: []
});

function inferGameLifecycleStatus(game) {
  if (!game || typeof game !== "object") {
    return GAME_LIFECYCLE_STATUSES.SCHEDULED;
  }

  if (
    Object.values(
      GAME_LIFECYCLE_STATUSES
    ).includes(game.status)
  ) {
    return game.status;
  }

  const review =
    game.review &&
    typeof game.review === "object"
      ? game.review
      : {};

  if (review.status === "approved") {
    return GAME_LIFECYCLE_STATUSES.APPROVED;
  }

  if (review.status === "returned") {
    return GAME_LIFECYCLE_STATUSES.RETURNED;
  }

  if (
    review.status === "submitted" ||
    review.submittedForReview === true
  ) {
    return GAME_LIFECYCLE_STATUSES.SUBMITTED;
  }

  if (game.completed === true) {
    return GAME_LIFECYCLE_STATUSES.COMPLETED;
  }

  return GAME_LIFECYCLE_STATUSES.SCHEDULED;
}

function normalizeGameLifecycleStatus(game) {
  if (!game || typeof game !== "object") {
    return game;
  }

  game.status =
    inferGameLifecycleStatus(game);

  return game;
}

function getGameRecipientAccount(crewId) {
  return typeof accountService !== "undefined"
    ? accountService.getAll().find(account => account.status === "approved" && String(account.crewId) === String(crewId))
    : null;
}

function notifyEligibleCrewOfNewGame(game) {
  if (typeof notificationService === "undefined" || typeof crewService === "undefined") return;
  crewService.getAll().filter(member => member.active !== false).filter(member =>
    typeof recommendationService !== "undefined" && typeof recommendationService.isCrewEligibleForGame === "function"
      ? recommendationService.isCrewEligibleForGame(member.id, game)
      : (member.levels || []).includes(game.level)
  ).forEach(member => {
    const account = getGameRecipientAccount(member.id);
    if (!account) return;
    notificationService.create({
      type: "game-available",
      title: "New Eligible Game",
      message: `A new game has been added to the schedule: ${game.awayTeam} @ ${game.homeTeam}, ${game.date} at ${game.time}.`,
      relatedId: game.id,
      audience: "umpire",
      recipientAccountId: account.id,
      destination: { page: "claim-games", context: { highlightId: game.id } }
    });
  });
}

function notifyAssignedCrewOfGameChanges(game, changes) {
  if (!changes.length || typeof notificationService === "undefined" || typeof assignmentService === "undefined") return;
  const labels = { date: "date", time: "time", locationComplex: "location complex", locationField: "location field", level: "level", homeTeam: "home team", awayTeam: "away team", status: "status" };
  const detail = changes.map(change => `${labels[change.field] || change.field} changed from ${change.from || "not set"} to ${change.to || "not set"}`).join("; ");
  const crewIds = [...new Set(assignmentService.getAssignments(game).map(assignment => assignment.crewId).filter(Boolean))];
  crewIds.forEach(crewId => {
    const account = getGameRecipientAccount(crewId);
    if (!account) return;
    notificationService.create({
      type: "assignment-updated",
      title: "Accepted Game Updated",
      message: `${game.awayTeam} @ ${game.homeTeam}: ${detail}.`,
      relatedId: game.id,
      audience: "umpire",
      recipientAccountId: account.id,
      destination: { page: "game-hub", context: { gameId: game.id } }
    });
  });
}

const gameService = {
  getAll() {
    const source = Array.isArray(games) ? games : [];
    if (typeof locationService !== "undefined") {
      source.forEach(game => locationService.normalizeGame(game));
    }
    return source;
  },

  getById(gameId) {
  const game = this.getAll().find(game =>
    String(game.id) === String(gameId)
  );

  if (!game) return null;

if (!Array.isArray(game.assignments)) {

const type = gameTypeService.get(
    game.gameType || "single"
);

game.gameType = game.gameType || "single";
game.crewSize = type.crewSize;

game.assignments =
    crewConfigurationService.createAssignments(
        game.id,
        game.crewSize
    );

    // Maintain compatibility with legacy fields
    if (game.crewId) {
        game.assignments[0].crewId = game.crewId;
        game.assignments[0].status = "assigned";
    }
}
  return game;
},

  getLifecycleStatuses() {
    return {
      ...GAME_LIFECYCLE_STATUSES
    };
  },

  getStatus(gameOrId) {
    const game =
      gameOrId &&
      typeof gameOrId === "object"
        ? gameOrId
        : this.getById(gameOrId);

    if (!game) {
      return null;
    }

    return inferGameLifecycleStatus(game);
  },

  canTransition(gameOrId, nextStatus) {
    const currentStatus =
      this.getStatus(gameOrId);

    if (!currentStatus) {
      return false;
    }

    if (currentStatus === nextStatus) {
      return true;
    }

    const allowedTransitions =
      GAME_LIFECYCLE_TRANSITIONS[
        currentStatus
      ] || [];

    return allowedTransitions.includes(
      nextStatus
    );
  },

  transitionStatus(
    gameId,
    nextStatus,
    updates = {}
  ) {
    const game = this.getById(gameId);

    if (!game) {
      return {
        success: false,
        message: "Game not found."
      };
    }

    if (
      !Object.values(
        GAME_LIFECYCLE_STATUSES
      ).includes(nextStatus)
    ) {
      return {
        success: false,
        message:
          "Invalid game lifecycle status."
      };
    }

    const currentStatus =
      inferGameLifecycleStatus(game);

    if (
      currentStatus !== nextStatus &&
      !this.canTransition(
        game,
        nextStatus
      )
    ) {
      return {
        success: false,
        message:
          `Game cannot transition from ${currentStatus} to ${nextStatus}.`
      };
    }

    Object.assign(
      game,
      updates,
      {
        status: nextStatus
      }
    );

    this.save();

    return {
      success: true,
      game
    };
  },

  getByDate(date) {
    return this.getAll()
      .filter(game => game.date === date)
      .sort(sortGames);
  },

  getOpenGames() {
    return this.getAll().filter(game =>
      !assignmentService.isAssigned(game)
    );
  },

  getAssignedGames() {
    return this.getAll().filter(game =>
      assignmentService.isAssigned(game)
    );
  },

  update(gameId, updates = {}) {
    const game = this.getById(gameId);

    if (!game) {
      return {
        success: false,
        message: "Game not found."
      };
    }

    const trackedFields = ["date", "time", "locationComplex", "locationField", "level", "homeTeam", "awayTeam", "status"];
    const previousValues = Object.fromEntries(
      trackedFields.filter(field => Object.hasOwn(updates, field)).map(field => [field, game[field]])
    );

    Object.assign(game, updates);
    if (typeof locationService !== "undefined") locationService.normalizeGame(game);
    const locationChanges = trackedFields
      .filter(field => Object.hasOwn(updates, field) && String(previousValues[field] ?? "") !== String(game[field] ?? ""))
      .map(field => ({ field, from: previousValues[field] ?? "", to: game[field] ?? "" }));
    normalizeGameLifecycleStatus(game);
    this.save();

    if (
      typeof activityService !== "undefined" &&
      typeof activityService.log === "function"
    ) {
      activityService.log({
        type: "game",
        action: "game_updated",
        actor:
          typeof activityService.getCurrentActor ===
            "function"
            ? activityService.getCurrentActor()
            : "",
        object:
          typeof activityService.getGameMatchup ===
            "function"
            ? activityService.getGameMatchup(game)
            : `${game.awayTeam || "Away"} @ ${
                game.homeTeam || "Home"
              }`,
        gameId: game.id,
        metadata: {
          fields:
            Object.keys(updates || {}),
          changes: locationChanges
        }
      });
    }

    notifyAssignedCrewOfGameChanges(game, locationChanges);

    return {
      success: true,
      game
    };
  },

  delete(gameId) {
    const game = this.getById(gameId);

    if (!game) {
      return {
        success: false,
        message: "Game not found."
      };
    }

    games = this.getAll().filter(game =>
      String(game.id) !== String(gameId)
    );

    this.save();

    if (
      typeof activityService !== "undefined" &&
      typeof activityService.log === "function"
    ) {
      activityService.log({
        type: "game",
        action: "game_deleted",
        actor:
          typeof activityService.getCurrentActor ===
            "function"
            ? activityService.getCurrentActor()
            : "",
        object:
          typeof activityService.getGameMatchup ===
            "function"
            ? activityService.getGameMatchup(game)
            : `${game.awayTeam || "Away"} @ ${
                game.homeTeam || "Home"
              }`,
        gameId: game.id
      });
    }

    return {
      success: true
    };
  },

  save() {
    saveGames();
  },

  getFirstDateOrToday() {
    const dates = this.getAll()
      .map(game => game.date)
      .filter(Boolean)
      .sort();

    return dates.length
      ? dates[0]
      : new Date().toISOString().split("T")[0];
  },

create(game) {

  if (typeof locationService !== "undefined") locationService.normalizeGame(game);

  // Generate an ID if one doesn't already exist.
  if (!game.id) {
    game.id = Date.now();
  }

  // Default game type.
  game.gameType = game.gameType || "single";

  // Let the assignment service build the proper assignment model.
  game.assignments = [];

  normalizeGameLifecycleStatus(game);

  games.push(game);

  if (
    typeof assignmentService !== "undefined" &&
    typeof assignmentService.normalizeGame === "function"
  ) {
    assignmentService.normalizeGame(game);
  }

  this.save();

  if (
    typeof activityService !== "undefined" &&
    typeof activityService.log === "function" &&
    game.suppressActivity !== true
  ) {
    activityService.log({
      type: "game",
      action: "game_created",
      actor:
        typeof activityService.getCurrentActor ===
          "function"
          ? activityService.getCurrentActor()
          : "",
      object:
        typeof activityService.getGameMatchup ===
          "function"
          ? activityService.getGameMatchup(game)
          : `${game.awayTeam || "Away"} @ ${
              game.homeTeam || "Home"
            }`,
      gameId: game.id,
      metadata: {
        date: game.date || "",
        time: game.time || "",
        locationComplex: game.locationComplex || "",
        locationField: game.locationField || "",
        field: game.field || ""
      }
    });
  }

  const shouldNotifyEligibleCrew = game.suppressActivity !== true;
  delete game.suppressActivity;

  if (shouldNotifyEligibleCrew) notifyEligibleCrewOfNewGame(game);

  return {
    success: true,
    message: "Game created.",
    data: game
  };
},
  replace(gameId, updatedGame) {
    const index = games.findIndex(game =>
      String(game.id) === String(gameId)
    );

    if (index === -1) {
      return {
        success: false,
        message: "Game not found."
      };
    }

    if (typeof locationService !== "undefined") locationService.normalizeGame(updatedGame);
    normalizeGameLifecycleStatus(updatedGame);

    games[index] = updatedGame;
    this.save();

    return {
      success: true,
      game: updatedGame
    };
  }
};
