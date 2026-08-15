const locationService = (() => {
  const LEGACY_COMPLEX = "Legacy / Unassigned";
  const STORAGE_KEY = "bluecrew_location_catalog";
  const getRepository = () => repositoryProvider.get("locations");
  const clean = value => String(value || "").trim();
  let sharedLocationsSnapshot = null;
  let sharedLocationRecords = [];
  let sharedFieldRecords = [];
  const isSharedMode = () => typeof supabaseClientService !== "undefined" && supabaseClientService.isConfigured();

  async function prepareSharedLocations() {
    if (!isSharedMode()) return getLocations();
    const [locationResult, fieldResult] = await Promise.all([
      supabaseSharedRepository.getLocations(),
      supabaseSharedRepository.getFields()
    ]);
    if (locationResult.error) throw locationResult.error;
    if (fieldResult.error) throw fieldResult.error;
    const locations = (locationResult.data || []).map(sharedDomainMappingService.mapLocation).filter(Boolean);
    const fields = (fieldResult.data || []).map(sharedDomainMappingService.mapField).filter(Boolean);
    return {
      locationRecords: locations,
      fieldRecords: fields,
      presentation: locations.map(location => ({
      name: location.name,
      fields: fields.filter(field => field.locationId === location.id).map(field => field.name)
      }))
    };
  }

  function publishSharedLocations(prepared) {
    sharedLocationRecords = structuredClone(prepared?.locationRecords || []);
    sharedFieldRecords = structuredClone(prepared?.fieldRecords || []);
    sharedLocationsSnapshot = structuredClone(prepared?.presentation || []);
    return getSharedLocationsSnapshot();
  }

  async function loadSharedLocations() {
    const prepared = await prepareSharedLocations();
    if (isSharedMode()) publishSharedLocations(prepared);
    return getLocations();
  }

  function clearSharedLocations() {
    sharedLocationsSnapshot = null;
    sharedLocationRecords = [];
    sharedFieldRecords = [];
  }

  function getSharedLocationsSnapshot() {
    return sharedLocationsSnapshot ? structuredClone(sharedLocationsSnapshot) : null;
  }

  function getSharedLocationRecord(id) {
    const record = sharedLocationRecords.find(location => String(location.id) === String(id)) || null;
    return record ? structuredClone(record) : null;
  }

  function getSharedFieldRecord(id) {
    const record = sharedFieldRecords.find(field => String(field.id) === String(id)) || null;
    return record ? structuredClone(record) : null;
  }
  function findSharedLocationRecord(name) {
    const record = sharedLocationRecords.find(location => clean(location.name) === clean(name)) || null;
    return record ? structuredClone(record) : null;
  }
  function findSharedFieldRecord(locationId, name) {
    const record = sharedFieldRecords.find(field => String(field.locationId) === String(locationId) && clean(field.name) === clean(name)) || null;
    return record ? structuredClone(record) : null;
  }

  function getConfiguredLocations() {
    if (isSharedMode()) return sharedLocationsSnapshot || [];
    try {
      const stored = getRepository().read();
      if (Array.isArray(stored)) return stored;
    } catch (_) {}
    return Array.isArray(settings?.locations) ? settings.locations : [];
  }

  function getLocations() {
    if (isSharedMode()) return getSharedLocationsSnapshot() || [];
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
  function getFieldDisplayName(game, fallback = "Field TBD") {
    if (!game) return fallback;
    const authoritative = game.fieldId ? getSharedFieldRecord(game.fieldId)?.name : "";
    const field = clean(authoritative || game.locationField || game.field || game.gameInformation?.field);
    if (!field) return fallback;
    const complex = clean(game.locationComplex || game.complex || game.venue || game.gameInformation?.venue);
    let concise = field;
    if (complex && concise.toLowerCase().startsWith(complex.toLowerCase())) {
      concise = clean(concise.slice(complex.length).replace(/^[\s\-\u2013\u2014:|/]+/, ""));
    }
    const designation = concise.match(/\bField\s+[A-Za-z0-9-]+\b/i);
    return designation ? designation[0].replace(/^field/i, "Field") : concise || fallback;
  }
  function isValidPair(complexName, fieldName) {
    const complex = clean(complexName);
    const field = clean(fieldName);
    return Boolean(complex && field && getFields(complex).includes(field));
  }
  function saveConfiguredLocations(locations) {
    if (isSharedMode()) throw new Error("Location mutations are unavailable in Supabase read mode.");
    getRepository().write(locations);
  }
  async function addComplex(name) {
    const cleanName = clean(name);
    if (!cleanName) return { success: false, message: "Enter a complex name." };
    if (isSharedMode()) {
      const { error } = await supabaseSharedRepository.createLocationComplex(cleanName);
      if (error) return { success: false, message: error.message || "Location complex could not be added." };
      await loadSharedLocations();
      return { success: true, message: "Location complex added." };
    }
    const locations = getConfiguredLocations().map(location => ({ name: clean(location.name), fields: [...(location.fields || [])] }));
    if (locations.some(location => location.name.toLowerCase() === cleanName.toLowerCase())) return { success: false, message: "That complex already exists." };
    locations.push({ name: cleanName, fields: [] });
    saveConfiguredLocations(locations);
    return { success: true, message: "Location complex added." };
  }
  async function addField(complexName, fieldName) {
    const cleanComplex = clean(complexName);
    const cleanField = clean(fieldName);
    if (!cleanField) return { success: false, message: "Enter a field name." };
    if (isSharedMode()) {
      const location = findSharedLocationRecord(complexName);
      if (!location?.id) return { success: false, message: "Location complex not found." };
      const { error } = await supabaseSharedRepository.createLocationField(location.id, cleanField);
      if (error) return { success: false, message: error.message || "Location field could not be added." };
      await loadSharedLocations();
      return { success: true, message: "Location field added." };
    }
    const locations = getConfiguredLocations().map(location => ({ name: clean(location.name), fields: [...(location.fields || [])] }));
    const location = locations.find(item => item.name === cleanComplex);
    if (!location) return { success: false, message: "Location complex not found." };
    if (location.fields.some(field => clean(field).toLowerCase() === cleanField.toLowerCase())) return { success: false, message: "That field already exists at this complex." };
    location.fields.push(cleanField);
    saveConfiguredLocations(locations);
    return { success: true, message: "Location field added." };
  }
  return { LEGACY_COMPLEX, getLocations, getComplexes, getFields, normalizeGame, getDisplayName, getFieldDisplayName, isValidPair, addComplex, addField, prepareSharedLocations, publishSharedLocations, loadSharedLocations, clearSharedLocations, getSharedLocationsSnapshot, getSharedLocationRecord, getSharedFieldRecord, findSharedLocationRecord, findSharedFieldRecord };
})();
