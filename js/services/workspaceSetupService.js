const workspaceSetupService = (() => {
  let state = { status: "idle", message: "", tasks: [] };
  const preferenceKey = "slate.workspace-setup.dismissed.v1";
  const clean = value => String(value ?? "").trim();

  function activeWorkspace() {
    return workspaceService?.snapshot?.().activeWorkspace || null;
  }

  function preferenceMap() {
    try { return JSON.parse(localStorage.getItem(preferenceKey) || "{}") || {}; }
    catch (_error) { return {}; }
  }

  function isDismissed() {
    const id = activeWorkspace()?.organizationId;
    return Boolean(id && preferenceMap()[id]);
  }

  function setDismissed(value) {
    const id = activeWorkspace()?.organizationId;
    if (!id) return;
    const preferences = preferenceMap();
    if (value) preferences[id] = true;
    else delete preferences[id];
    localStorage.setItem(preferenceKey, JSON.stringify(preferences));
  }

  function gameRows() {
    if (typeof gameService?.getAll === "function") return gameService.getAll();
    return Array.isArray(window.games) ? window.games : [];
  }

  function task(module, id, title, description, complete, destination, action = "") {
    return { module, id, title, description, complete: Boolean(complete), destination, action };
  }

  function buildTasks() {
    const workspace = activeWorkspace();
    if (!workspace) return [];
    const modules = workspace.enabledModules || [];
    const catalog = leagueStructureService?.snapshot?.() || { programs: [], leagues: [], divisions: [], teams: [] };
    const seasons = seasonService?.getSeasons?.() || [];
    const facilities = facilityService?.snapshot?.() || { facilities: [], fields: [], availability: [], reservations: [] };
    const tournament = tournamentManagementService?.snapshot?.() || { tournaments: [], divisions: [], teams: [], pools: [], games: [], results: [], brackets: [] };
    const crew = crewService?.getAdministrativeCrewState?.() || {};
    const crewRows = crewService?.getAll?.() || [];
    const allGames = gameRows();
    const domainGames = domain => allGames.filter(game => clean(game.gameDomain || game.game_domain || "officials") === domain);
    const tasks = [];

    if (modules.includes("league")) tasks.push(
      task("league", "league-program", "Create a sport program", "Name the sport program your organization operates.", catalog.programs.length, "settings", "competition"),
      task("league", "league-season", "Create a league and season", "Define the competition and its operating dates.", catalog.leagues.length && seasons.length, "settings", "competition"),
      task("league", "league-teams", "Add divisions and teams", "Build the participants used by league scheduling.", catalog.divisions.length && catalog.teams.length >= 2, "settings", "competition"),
      task("league", "league-fields", "Add playable fields", "Create at least one complex and field.", facilities.facilities.length && facilities.fields.length, "settings", "facility"),
      task("league", "league-schedule", "Schedule the first league game", "Create one game or generate a schedule proposal.", domainGames("league").length, "schedule", "league-generator")
    );

    if (modules.includes("umpire")) tasks.push(
      task("umpire", "officials-locations", "Add officiating locations", "Add complexes and fields used for assignments.", facilities.facilities.length && facilities.fields.length, "settings", "facility"),
      task("umpire", "officials-roster", "Build the officials roster", "Add or approve the people who can receive assignments.", crewRows.length, "crew"),
      task("umpire", "officials-game", "Create or import an officials game", "Enter a game without league prerequisites.", domainGames("officials").length, "schedule", "officials-game"),
      task("umpire", "officials-assignment", "Make the first assignment", "Staff an officials game from the established roster.", domainGames("officials").some(game => (game.assignments || []).some(assignment => assignment.crewId || assignment.crew_id)), "schedule")
    );

    if (modules.includes("tournament")) tasks.push(
      task("tournament", "tournament-create", "Create a tournament", "Set dates, sport, and tournament identity.", tournament.tournaments.length, "schedule", "tournament-manager"),
      task("tournament", "tournament-teams", "Configure divisions and teams", "Register participants independently of league records.", tournament.divisions.length && tournament.teams.length >= 2, "schedule", "tournament-manager"),
      task("tournament", "tournament-fields", "Add tournament fields", "Create the resources used by pool play and brackets.", facilities.facilities.length && facilities.fields.length, "settings", "facility"),
      task("tournament", "tournament-schedule", "Build a pool-play schedule", "Create pools and publish tournament games.", tournament.pools.length && tournament.games.length, "schedule", "tournament-manager"),
      task("tournament", "tournament-results", "Record results and build a bracket", "Complete the game-day competitive workflow.", tournament.results.length && tournament.brackets.length, "schedule", "tournament-manager")
    );

    if (modules.includes("facility")) tasks.push(
      task("facility", "facility-create", "Create a facility and resource", "Add a complex, field, room, or other schedulable resource.", facilities.facilities.length && facilities.fields.length, "settings", "facility"),
      task("facility", "facility-availability", "Configure availability", "Define when a resource can be booked.", facilities.availability.length, "settings", "facility"),
      task("facility", "facility-reservation", "Create the first reservation", "Book a game, practice, tournament, or administrative hold.", facilities.reservations.some(item => item.status !== "cancelled"), "settings", "reservation")
    );
    return tasks;
  }

  async function load() {
    const workspace = activeWorkspace();
    if (!workspace) {
      state = { status: "error", message: "Choose a workspace to view setup progress.", tasks: [] };
      return snapshot();
    }
    state = { status: "loading", message: "Checking workspace setup…", tasks: [] };
    const operations = [];
    const modules = workspace.enabledModules || [];
    if (modules.includes("league")) operations.push(leagueStructureService.loadCatalog(), seasonService.loadSeasons());
    if (modules.some(code => ["league", "umpire", "tournament", "facility"].includes(code))) operations.push(facilityService.load());
    if (modules.includes("tournament")) operations.push(tournamentManagementService.load());
    if (modules.includes("umpire") && authorizationService?.canManageCrew?.()) operations.push(crewService.loadAdministrativeCrew());
    const results = await Promise.allSettled(operations);
    const failed = results.find(result => result.status === "rejected" || result.value?.success === false);
    state = {
      status: failed ? "partial" : "ready",
      message: failed ? "Some setup progress could not be verified. Unverified steps remain incomplete." : "Setup progress is current.",
      tasks: buildTasks()
    };
    return snapshot();
  }

  function snapshot() {
    const tasks = state.tasks.map(item => ({ ...item }));
    return { ...state, tasks, complete: tasks.filter(item => item.complete).length, total: tasks.length, dismissed: isDismissed() };
  }

  function clear() { state = { status: "idle", message: "", tasks: [] }; }
  return { load, snapshot, clear, isDismissed, setDismissed };
})();
