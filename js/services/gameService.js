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

const gameService = {
  getAll() {
    return Array.isArray(games) ? games : [];
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

    Object.assign(game, updates);
    normalizeGameLifecycleStatus(game);
    this.save();

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

    normalizeGameLifecycleStatus(
      updatedGame
    );

    games[index] = updatedGame;
    this.save();

    return {
      success: true,
      game: updatedGame
    };
  }
};
