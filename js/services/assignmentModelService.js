// js/services/assignmentModelService.js

const assignmentModelService = (() => {
  const DEFAULT_POSITION = "Plate";

  function createAssignment(gameId, position = DEFAULT_POSITION, crewId = "") {
    return {
      id: generateAssignmentId(gameId, position),
      gameId,
      position,
      crewId: crewId || "",
      status: crewId ? "assigned" : "needs_assignment",
      locked: false,
      claimedBy: ""
    };
  }

  function createDefaultAssignmentsForGame(game) {
    if (!game) return [];

    if (Array.isArray(game.assignments) && game.assignments.length > 0) {
      return game.assignments;
    }

    return [
      createAssignment(
        game.id,
        DEFAULT_POSITION,
        game.crewId || game.umpireId || ""
      )
    ];
  }

  function normalizeGameAssignments(game) {
    if (!game) return game;

    const assignments = createDefaultAssignmentsForGame(game);

    return {
      ...game,
      assignments
    };
  }

  function normalizeGames(games = []) {
    return games.map(normalizeGameAssignments);
  }

  function generateAssignmentId(gameId, position) {
    const safePosition = String(position || DEFAULT_POSITION)
      .toLowerCase()
      .replace(/\s+/g, "-");

    return `${gameId}-${safePosition}`;
  }

  function getPrimaryAssignment(game) {
    const normalized = normalizeGameAssignments(game);
    return normalized.assignments[0] || null;
  }

  return {
    DEFAULT_POSITION,
    createAssignment,
    createDefaultAssignmentsForGame,
    normalizeGameAssignments,
    normalizeGames,
    getPrimaryAssignment
  };
})();