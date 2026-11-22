const leagueStructureService = (() => {
  let catalog = { sports: [], programs: [], leagues: [], divisions: [], teams: [] };
  let loaded = false;

  const clean = value => String(value ?? "").trim();
  const isSharedMode = () =>
    typeof supabaseClientService !== "undefined" && supabaseClientService.isConfigured();

  function snapshot() {
    return structuredClone(catalog);
  }

  function isLoaded() {
    return loaded;
  }

  async function loadCatalog() {
    if (!isSharedMode()) {
      catalog = {
        sports: [{ code: "baseball", name: "Baseball", active: true }, { code: "softball", name: "Softball", active: true }],
        programs: [], leagues: [], divisions: [], teams: []
      };
      loaded = true;
      return { success: true, message: "Competition catalog loaded.", data: snapshot() };
    }

    const results = await Promise.all([
      supabaseSharedRepository.getSports(),
      supabaseSharedRepository.getOrganizationSports(),
      supabaseSharedRepository.getLeagues(),
      supabaseSharedRepository.getDivisions(),
      supabaseSharedRepository.getTeams()
    ]);
    const failed = results.find(result => result.error);
    if (failed) return { success: false, message: failed.error.message || "Competition catalog could not be loaded." };
    catalog = {
      sports: results[0].data || [],
      programs: results[1].data || [],
      leagues: results[2].data || [],
      divisions: results[3].data || [],
      teams: results[4].data || []
    };
    loaded = true;
    return { success: true, message: "Competition catalog loaded.", data: snapshot() };
  }

  async function createProgram(values = {}) {
    const program = {
      sportCode: clean(values.sportCode).toLowerCase(),
      displayName: clean(values.displayName),
      leagueName: clean(values.leagueName)
    };
    if (!program.sportCode || !catalog.sports.some(sport => sport.code === program.sportCode)) {
      return { success: false, message: "Choose a supported sport." };
    }
    if (!program.displayName) return { success: false, message: "Enter the organization sport name." };
    if (!program.leagueName) return { success: false, message: "Enter the league name." };
    if (!isSharedMode()) return { success: false, message: "Competition setup requires the hosted staging environment." };
    const { error } = await supabaseSharedRepository.createCompetitionProgram(program);
    if (error) return { success: false, message: error.message || "Sport program could not be created." };
    await loadCatalog();
    return { success: true, message: "Sport program and league created.", data: snapshot() };
  }

  async function createDivision(values = {}) {
    const division = {
      leagueId: clean(values.leagueId),
      seasonId: clean(values.seasonId),
      name: clean(values.name),
      code: clean(values.code).toUpperCase(),
      minimumAge: values.minimumAge === "" || values.minimumAge == null ? null : Number(values.minimumAge),
      maximumAge: values.maximumAge === "" || values.maximumAge == null ? null : Number(values.maximumAge)
    };
    if (!catalog.leagues.some(league => String(league.id) === division.leagueId)) return { success: false, message: "Choose a league." };
    if (!division.seasonId) return { success: false, message: "Choose a season." };
    if (!division.name || !division.code) return { success: false, message: "Enter the division name and code." };
    if (division.minimumAge !== null && (!Number.isInteger(division.minimumAge) || division.minimumAge < 3)) return { success: false, message: "Minimum age must be 3 or greater." };
    if (division.maximumAge !== null && (!Number.isInteger(division.maximumAge) || division.maximumAge < 3)) return { success: false, message: "Maximum age must be 3 or greater." };
    if (division.minimumAge !== null && division.maximumAge !== null && division.maximumAge < division.minimumAge) return { success: false, message: "Maximum age cannot be less than minimum age." };
    const { error } = await supabaseSharedRepository.createCompetitionDivision(division);
    if (error) return { success: false, message: error.message || "Division could not be created." };
    await loadCatalog();
    return { success: true, message: "Division created.", data: snapshot() };
  }

  async function createTeam(values = {}) {
    const team = { divisionId: clean(values.divisionId), name: clean(values.name), shortName: clean(values.shortName) };
    if (!catalog.divisions.some(division => String(division.id) === team.divisionId)) return { success: false, message: "Choose a division." };
    if (!team.name) return { success: false, message: "Enter the team name." };
    const { error } = await supabaseSharedRepository.createCompetitionTeam(team);
    if (error) return { success: false, message: error.message || "Team could not be created." };
    await loadCatalog();
    return { success: true, message: "Team created.", data: snapshot() };
  }

  function clear() {
    catalog = { sports: [], programs: [], leagues: [], divisions: [], teams: [] };
    loaded = false;
  }

  return { snapshot, isLoaded, loadCatalog, createProgram, createDivision, createTeam, clear };
})();
