const seasonService = (() => {
  const getRepository = () => repositoryProvider.get("seasons");
  let sharedSnapshot = [];
  let loaded = false;

  const isSharedMode = () =>
    typeof supabaseClientService !== "undefined" && supabaseClientService.isConfigured();

  const clean = value => String(value || "").trim();

  function normalizeSeason(row = {}) {
    return {
      id: row.id || row.legacy_season_id || `season-${Date.now()}`,
      organizationId: row.organization_id || row.organizationId || "local",
      name: clean(row.name),
      startsOn: row.starts_on || row.startsOn || "",
      endsOn: row.ends_on || row.endsOn || "",
      active: Boolean(row.active)
    };
  }

  function sortSeasons(rows = []) {
    return [...rows].sort((left, right) => {
      if (left.active !== right.active) return left.active ? -1 : 1;
      return String(right.startsOn || "").localeCompare(String(left.startsOn || "")) ||
        String(left.name || "").localeCompare(String(right.name || ""));
    });
  }

  function getSeasons() {
    if (isSharedMode()) return structuredClone(sortSeasons(sharedSnapshot));
    const rows = getRepository().read();
    return structuredClone(sortSeasons(Array.isArray(rows) ? rows.map(normalizeSeason) : []));
  }

  function getActiveSeason() {
    return getSeasons().find(season => season.active) || null;
  }

  function isLoaded() {
    return loaded || !isSharedMode();
  }

  async function loadSeasons() {
    if (!isSharedMode()) {
      loaded = true;
      return { success: true, message: "Seasons loaded.", data: getSeasons() };
    }
    const { data, error } = await supabaseSharedRepository.getSeasons();
    if (error) return { success: false, message: error.message || "Seasons could not be loaded.", data: [] };
    sharedSnapshot = (data || []).map(normalizeSeason);
    loaded = true;
    return { success: true, message: "Seasons loaded.", data: getSeasons() };
  }

  function validate({ name, startsOn, endsOn }) {
    if (!clean(name)) return "Enter a season name.";
    if (!startsOn) return "Choose a season start date.";
    if (!endsOn) return "Choose a season end date.";
    if (endsOn < startsOn) return "The season end date cannot be before the start date.";
    return "";
  }

  async function createSeason(values = {}) {
    const season = {
      name: clean(values.name),
      startsOn: values.startsOn || "",
      endsOn: values.endsOn || "",
      active: Boolean(values.active)
    };
    const validation = validate(season);
    if (validation) return { success: false, message: validation };

    if (isSharedMode()) {
      const { data, error } = await supabaseSharedRepository.createSeason(season);
      if (error) return { success: false, message: error.message || "Season could not be created." };
      await loadSeasons();
      return { success: true, message: season.active ? "Season created and activated." : "Season created.", data: normalizeSeason(data) };
    }

    const rows = getSeasons();
    if (rows.some(row => row.name.toLowerCase() === season.name.toLowerCase())) {
      return { success: false, message: "A season with that name already exists." };
    }
    if (season.active) rows.forEach(row => { row.active = false; });
    const created = normalizeSeason({ ...season, id: `season-${Date.now()}` });
    rows.push(created);
    getRepository().write(rows);
    return { success: true, message: season.active ? "Season created and activated." : "Season created.", data: created };
  }

  async function activateSeason(seasonId) {
    const target = getSeasons().find(season => String(season.id) === String(seasonId));
    if (!target) return { success: false, message: "Season not found." };
    if (target.active) return { success: true, message: `${target.name} is already active.`, data: target };

    if (isSharedMode()) {
      const { data, error } = await supabaseSharedRepository.activateSeason(seasonId);
      if (error) return { success: false, message: error.message || "Season could not be activated." };
      await loadSeasons();
      return { success: true, message: `${target.name} is now the active season.`, data: normalizeSeason(data) };
    }

    const rows = getSeasons().map(season => ({ ...season, active: String(season.id) === String(seasonId) }));
    getRepository().write(rows);
    return { success: true, message: `${target.name} is now the active season.`, data: rows.find(season => season.active) };
  }

  function clear() {
    sharedSnapshot = [];
    loaded = false;
  }

  return { getSeasons, getActiveSeason, isLoaded, loadSeasons, createSeason, activateSeason, clear };
})();
