// js/services/gameTypeService.js

const gameTypeService = (() => {

  const TYPES = {
    single: {
      label: "Single Umpire",
      crewSize: 1
    },

    twoMan: {
      label: "Two-Man Crew",
      crewSize: 2
    },

    threeMan: {
      label: "Three-Man Crew",
      crewSize: 3
    },

    fourMan: {
      label: "Four-Man Crew",
      crewSize: 4
    },

    tournament: {
      label: "Tournament",
      crewSize: 4
    },

    evaluation: {
      label: "Evaluation",
      crewSize: 2
    },

    scrimmage: {
      label: "Scrimmage",
      crewSize: 1
    }
  };

  function get(type = "single") {
    return TYPES[type] || TYPES.single;
  }

  function getAll() {
    return Object.entries(TYPES).map(([id, config]) => ({
      id,
      ...config
    }));
  }
function getCrewSize(game) {
  if (!game) return 1;

  const type = get(game.gameType || game.type || "single");

  return Number(type.crewSize) || 1;
}

function getCrewSize(game) {
  if (!game) return 1;

  const typeId =
    game.gameType ||
    game.type ||
    "single";

  const type = get(typeId);

  return Number(type.crewSize) || 1;
}

  return {
  get,
  getAll,
  getCrewSize
};

})();