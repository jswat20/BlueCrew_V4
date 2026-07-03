// js/services/crewConfigurationService.js

const crewConfigurationService = (() => {

  const CONFIGURATIONS = {
    1: ["Plate"],

    2: [
      "Plate",
      "Base"
    ],

    3: [
      "Plate",
      "Base",
      "U3"
    ],

    4: [
      "Plate",
      "Base",
      "U3",
      "U4"
    ],

    5: [
      "Plate",
      "Base",
      "U3",
      "U4",
      "Observer"
    ],

    6: [
      "Plate",
      "Base",
      "U3",
      "U4",
      "Observer",
      "Mentor"
    ]
  };

  function getPositions(size = 1) {
    return CONFIGURATIONS[size] || CONFIGURATIONS[1];
  }

  function createAssignments(gameId, crewSize = 1) {
    return getPositions(crewSize).map(position =>
    Assignment.create({
        gameId,
        position
    })
);
  }

function getPositionsForGame(game) {
  const crewSize =
    typeof gameTypeService !== "undefined" &&
    typeof gameTypeService.getCrewSize === "function"
      ? gameTypeService.getCrewSize(game)
      : Number(game?.crewSize) || 1;

  return getPositions(crewSize);
}

  return {
  getPositions,
  getPositionsForGame,
  createAssignments
};

})();