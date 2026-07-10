// js/services/demoDataService.js

const demoDataService = (() => {
  let loaded = false;
  let originalCrew = null;
  let originalGames = null;
  let originalAccounts = null;

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

  function clearAccounts() {
    accountService
      .getAll()
      .forEach(account => {
        accountService.deleteAccount(account.id);
      });
  }

  function createAccountDefinition(definition) {
    const creationResult = accountService.createAccount({
      id: definition.id,
      firstName: definition.firstName,
      lastName: definition.lastName,
      email: definition.email,
      phone: definition.phone,
      createdAt: definition.createdAt,
      role: definition.role || "umpire"
    });

    if (!creationResult.success) {
      return creationResult;
    }

    const accountId = creationResult.data.id;

    if (definition.status === "approved") {
      const approvalResult =
        accountService.approveAccount(accountId);

      if (!approvalResult.success) {
        return approvalResult;
      }

      if (definition.crewId) {
        return accountService.linkCrew(
          accountId,
          definition.crewId
        );
      }

      return approvalResult;
    }

    if (definition.status === "rejected") {
      return accountService.rejectAccount(accountId);
    }

    if (definition.status === "inactive") {
      return accountService.updateAccount(accountId, {
        status: "inactive",
        crewId: null
      });
    }

    return creationResult;
  }

  function loadDemoAccounts() {
    clearAccounts();

    const definitions = demoAccountData.getAll();

    for (const definition of definitions) {
      const result = createAccountDefinition(definition);

      if (!result.success) {
        return {
          success: false,
          message: result.message,
          data: getSummary()
        };
      }
    }

    return {
      success: true,
      message: "Demo accounts loaded.",
      data: accountService.getAll()
    };
  }

  function restoreAccounts(accounts) {
    clearAccounts();

    for (const account of accounts) {
      const result = accountService.createAccount(account);

      if (!result.success) {
        return result;
      }
    }

    return {
      success: true,
      message: "Original accounts restored.",
      data: accountService.getAll()
    };
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
    originalAccounts = clone(accountService.getAll());

    crew = clone(DEMO_CREW);
    games = createDemoGames();

    saveCrew();
    saveGames();

    const accountResult = loadDemoAccounts();

    if (!accountResult.success) {
      crew = clone(originalCrew);
      games = clone(originalGames);

      saveCrew();
      saveGames();

      restoreAccounts(originalAccounts);

      originalCrew = null;
      originalGames = null;
      originalAccounts = null;

      return {
        success: false,
        message: accountResult.message,
        data: getSummary()
      };
    }

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

    if (originalAccounts !== null) {
      restoreAccounts(originalAccounts);
    }

    originalCrew = null;
    originalGames = null;
    originalAccounts = null;
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