// js/services/reviewService.js

const reviewService = (() => {
  function getReview(game) {
    return (
      game?.review &&
      typeof game.review === "object"
        ? game.review
        : {}
    );
  }

  function getReviewStatus(gameId) {
    const game = gameService.getById(gameId);

    if (!game) {
      return "draft";
    }

    return getReview(game).status || "draft";
  }

  function hasStatus(game, status) {
    return getReview(game).status === status;
  }

  function isSubmitted(game) {
    return hasStatus(game, "submitted");
  }

  function compareGames(a, b) {
    const aReview = getReview(a);
    const bReview = getReview(b);

    return String(bReview.submittedAt || "")
      .localeCompare(
        String(aReview.submittedAt || "")
      );
  }

  function getGamesByStatus(status) {
    return gameService
      .getAll()
      .filter(game =>
        hasStatus(game, status)
      )
      .sort(compareGames);
  }

  function getSubmittedGames() {
    return getGamesByStatus("submitted");
  }

  function getReturnedGames() {
    return getGamesByStatus("returned");
  }

  function getReturnedGamesForCurrentUmpire() {
    const account =
      typeof loginService !== "undefined" &&
      typeof loginService.getCurrentAccount === "function"
        ? loginService.getCurrentAccount()
        : null;

    if (!account || !account.crewId) {
      return [];
    }

    const crewId = String(account.crewId);

    return getReturnedGames().filter(game => {
      if (String(game.crewId || "") === crewId) {
        return true;
      }

      const assignments =
        typeof assignmentService !== "undefined" &&
        typeof assignmentService.getAssignments === "function"
          ? assignmentService.getAssignments(game)
          : Array.isArray(game.assignments)
            ? game.assignments
            : [];

      return assignments.some(
        assignment =>
          String(assignment.crewId || "") === crewId
      );
    });
  }

  function getApprovedGames() {
    return getGamesByStatus("approved");
  }

  function getReviewCounts() {
    const submitted =
      getSubmittedGames().length;

    return {
      submitted,
      needsReview: submitted
    };
  }

  function getReviewSummary(gameId) {
    const game =
      gameService.getById(gameId);

    if (!game || !isSubmitted(game)) {
      return null;
    }

    const review = getReview(game);

    return {
      gameId: game.id,
      date: game.date || "",
      matchup:
        game.matchup ||
        `${game.awayTeam || ""} @ ${game.homeTeam || ""}`,
      field:
        game.field ||
        game.venue ||
        "",
      completedBy:
        game.completedBy ||
        game.completion?.completedBy ||
        review.submittedBy ||
        "",
      submittedBy:
        review.submittedBy || "",
      submittedAt:
        review.submittedAt || null
    };
  }

  return {
    getReviewStatus,
    getSubmittedGames,
    getReturnedGames,
    getReturnedGamesForCurrentUmpire,
    getApprovedGames,
    getReviewCounts,
    getReviewSummary
  };
})();
