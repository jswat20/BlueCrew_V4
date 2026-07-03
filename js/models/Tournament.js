// js/models/Assignment.js

const Assignment = (() => {

  function create({
    gameId,
    position,
    crewId = "",
    status = "needs_assignment",
    claimedBy = "",
    locked = false
  }) {

    return {
      id: `${gameId}-${position.toLowerCase()}`,
      gameId,
      position,
      crewId,
      status,
      claimedBy,
      locked
    };

  }

  return {
    create
  };

})();