// js/services/gameService.js

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

    games[index] = updatedGame;
    this.save();

    return {
      success: true,
      game: updatedGame
    };
  }
};
