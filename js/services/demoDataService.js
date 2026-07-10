// js/services/demoDataService.js

const demoDataService = (() => {
  let loaded = false;
  let originalCrew = null;
  let originalGames = null;

  const DEMO_CREW = [
    {
      id: "demo-crew-1",
      firstName: "Ethan",
      lastName: "Parker",
      email: "ethan@demo.test",
      levels: ["8U", "10U"],
      active: true,
      demoData: true
    },
    {
      id: "demo-crew-2",
      firstName: "Noah",
      lastName: "Brooks",
      email: "noah@demo.test",
      levels: ["8U", "10U", "12U"],
      active: true,
      demoData: true
    },
    {
      id: "demo-crew-3",
      firstName: "Caleb",
      lastName: "Turner",
      email: "caleb@demo.test",
      levels: ["10U", "12U"],
      active: true,
      demoData: true
    },
    {
      id: "demo-crew-4",
      firstName: "Logan",
      lastName: "Mitchell",
      email: "logan@demo.test",
      levels: ["10U", "12U", "14U"],
      active: true,
      demoData: true
    }
  ];

  function clone(value) {
    return structuredClone(value);
  }

  function createDate(offsetDays) {
    const date = new Date();

    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + offsetDays);

    return date.toISOString().split("T")[0];
  }

  function isLoaded() {
    return loaded;
  }

  function getSummary() {
    return {
      loaded,
      crew: crewService.getAll().length,
      games: gameService.getAll().length,
      accounts:
        typeof accountService !== "undefined"
          ? accountService.getAll().length
          : 0
    };
  }

  function createDemoGames() {
    return demoGameData.getAll().map(definition => {
      const game = {
        id: definition.id,
        date: createDate(definition.dateOffset),
        time: definition.time,
        field: definition.field,
        level: definition.level,
        awayTeam: definition.awayTeam,
        homeTeam: definition.homeTeam,
        gameType: definition.gameType,
        demoData: true
      };

      assignmentService.normalizeGame(game);

      return game;
    });
  }

  function loadLeague() {
    if (loaded) {
      return {
        success: true,
        message: "Demo league already loaded.",
        data: getSummary()
      };
    }

    originalCrew = clone(crewService.getAll());
    originalGames = clone(gameService.getAll());

    crew = clone(DEMO_CREW);
    games = createDemoGames();

    saveCrew();
    saveGames();

    loaded = true;

    return {
      success: true,
      message: "Demo league loaded.",
      data: getSummary()
    };
  }

  function resetLeague() {
    if (originalCrew !== null) {
      crew = clone(originalCrew);
      saveCrew();
    }

    if (originalGames !== null) {
      games = clone(originalGames);
      saveGames();
    }

    originalCrew = null;
    originalGames = null;
    loaded = false;

    return {
      success: true,
      message: "Original data restored.",
      data: getSummary()
    };
  }

  return {
    isLoaded,
    getSummary,
    loadLeague,
    resetLeague
  };
})();
