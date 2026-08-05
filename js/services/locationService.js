const locationService = (() => {
  const LEGACY_COMPLEX = "Legacy / Unassigned";
  const STORAGE_KEY = "bluecrew_location_catalog";
  const getRepository = () => repositoryProvider.get("locations");
  const clean = value => String(value || "").trim();

  function getConfiguredLocations() {
    try {
      const stored = getRepository().read();
      if (Array.isArray(stored)) return stored;
    } catch (_) {}
    return Array.isArray(settings?.locations) ? settings.locations : [];
  }

  function getLocations() {
    const configured = getConfiguredLocations();
    const locations = configured.map(location => ({
      name: clean(location?.name),
      fields: [...new Set((location?.fields || []).map(clean).filter(Boolean))]
    })).filter(location => location.name);
    const legacyFields = [...new Set(
      (typeof games !== "undefined" && Array.isArray(games) ? games : [])
        .filter(game => !clean(game.locationComplex))
        .map(game => clean(game.locationField || game.field))
        .filter(Boolean)
    )];
    if (legacyFields.length) locations.push({ name: LEGACY_COMPLEX, fields: legacyFields });
    return locations;
  }

  function getComplexes() { return getLocations().map(location => location.name); }
  function getFields(complexName) {
    return getLocations().find(location => location.name === clean(complexName))?.fields || [];
  }
  function normalizeGame(game) {
    if (!game || typeof game !== "object") return game;
    game.locationComplex = clean(game.locationComplex || game.complex);
    game.locationField = clean(game.locationField || game.field);
    game.field = game.locationField;
    if (game.locationComplex) game.venue = game.locationComplex;
    return game;
  }
  function getDisplayName(game) {
    if (!game) return "";
    const complex = clean(game.locationComplex || game.venue);
    const field = clean(game.locationField || game.field);
    return complex && field && complex !== field ? `${complex} — ${field}` : complex || field;
  }
  function isValidPair(complexName, fieldName) {
    const complex = clean(complexName);
    const field = clean(fieldName);
    return Boolean(complex && field && getFields(complex).includes(field));
  }
  function saveConfiguredLocations(locations) {
    getRepository().write(locations);
  }
  function addComplex(name) {
    const cleanName = clean(name);
    if (!cleanName) return { success: false, message: "Enter a complex name." };
    const locations = getConfiguredLocations().map(location => ({ name: clean(location.name), fields: [...(location.fields || [])] }));
    if (locations.some(location => location.name.toLowerCase() === cleanName.toLowerCase())) return { success: false, message: "That complex already exists." };
    locations.push({ name: cleanName, fields: [] });
    saveConfiguredLocations(locations);
    return { success: true, message: "Location complex added." };
  }
  function addField(complexName, fieldName) {
    const cleanComplex = clean(complexName);
    const cleanField = clean(fieldName);
    if (!cleanField) return { success: false, message: "Enter a field name." };
    const locations = getConfiguredLocations().map(location => ({ name: clean(location.name), fields: [...(location.fields || [])] }));
    const location = locations.find(item => item.name === cleanComplex);
    if (!location) return { success: false, message: "Location complex not found." };
    if (location.fields.some(field => clean(field).toLowerCase() === cleanField.toLowerCase())) return { success: false, message: "That field already exists at this complex." };
    location.fields.push(cleanField);
    saveConfiguredLocations(locations);
    return { success: true, message: "Location field added." };
  }
  return { LEGACY_COMPLEX, getLocations, getComplexes, getFields, normalizeGame, getDisplayName, isValidPair, addComplex, addField };
})();
