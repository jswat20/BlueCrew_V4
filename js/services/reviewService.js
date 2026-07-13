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

  function isSubmitted(game) {
    const review = getReview(game);

    return (
      review.submittedForReview === true ||
      review.status === "submitted"
    );
  }

  function compareGames(a, b) {
    const aReview = getReview(a);
    const bReview = getReview(b);

    return String(bReview.submittedAt || "")
      .localeCompare(
        String(aReview.submittedAt || "")
      );
  }

  function getSubmittedGames() {
    return gameService
      .getAll()
      .filter(isSubmitted)
      .sort(compareGames);
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
    getSubmittedGames,
    getReviewCounts,
    getReviewSummary
  };
})();
