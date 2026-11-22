function escapeSettingsHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatSeasonDate(value) {
  if (!value) return "Date not set";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function renderSettings() {
  const isHosted = typeof supabaseClientService !== "undefined" && supabaseClientService.isConfigured();
  return `
    <section class="settings-page presentation-page" data-testid="settings-page">
      <header class="presentation-page-header settings-page-header"><div><h2>Settings</h2><p>Manage season setup, scheduling reference data, and locations.</p></div></header>
    <div class="card-grid settings-card-grid">
      ${renderSeasonSettingsCard()}
      ${renderLocationSettingsCard()}
      ${isHosted ? renderCompetitionCatalogCard() : `${renderSettingsCard("Levels", settings.levels)}${renderSettingsCard("Teams", settings.teams)}`}
      ${renderSettingsCard("Time Slots", settings.timeSlots.slice(0, 12))}
    </div>${renderSeasonEntryDialog()}${renderFacilityDialogs()}${renderCompetitionCatalogDialogs()}</section>
  `;
}

function renderSettingsCard(title, items) {
  return `
    <section class="card presentation-card settings-card">
      <div class="page-section-header presentation-card-header-blue">
        <div><h3>${title}</h3><p>${title === "Time Slots" ? "Current pilot scheduling windows." : `Configured ${title.toLowerCase()} for this organization.`}</p></div>
        <button type="button" class="button button-secondary button-compact">Add</button>
      </div>

      <div class="settings-list">
        ${items.map(item => `<span class="settings-pill">${item}</span>`).join("")}
      </div>
    </section>
  `;
}

function renderSeasonSettingsCard() {
  const isHosted = typeof supabaseClientService !== "undefined" && supabaseClientService.isConfigured();
  const seasonsReady = typeof seasonService !== "undefined" && seasonService.isLoaded();
  const seasons = seasonsReady ? seasonService.getSeasons() : [];

  return `
    <section class="card presentation-card settings-card settings-season-card" data-testid="settings-seasons">
      <div class="page-section-header presentation-card-header-blue">
        <div><h3>Seasons</h3><p>The active season is used automatically by schedule imports.</p></div>
        <button type="button" class="button button-secondary button-compact" data-testid="add-season" onclick="openSeasonEntryDialog()">Create Season</button>
      </div>
      <div class="settings-season-list" data-testid="settings-season-list">
        ${isHosted && !seasonsReady
          ? '<p class="settings-muted" data-testid="seasons-loading">Loading seasons…</p>'
          : seasons.length
            ? seasons.map(renderSeasonSettingsRow).join("")
            : '<div class="settings-empty" data-testid="seasons-empty"><strong>No seasons yet.</strong><span>Create the first season before importing a schedule.</span></div>'}
      </div>
    </section>
  `;
}

function renderSeasonSettingsRow(season) {
  const safeId = escapeSettingsHtml(season.id);
  const safeName = escapeSettingsHtml(season.name);
  return `
    <article class="settings-season-row${season.active ? " is-active" : ""}" data-testid="season-row" data-season-id="${safeId}">
      <div class="settings-season-main">
        <div class="settings-season-title-row">
          <strong>${safeName}</strong>
          ${season.active ? '<span class="status-badge status-badge-success" data-testid="active-season-badge">Active</span>' : ""}
        </div>
        <span>${formatSeasonDate(season.startsOn)} – ${formatSeasonDate(season.endsOn)}</span>
      </div>
      ${season.active
        ? '<span class="settings-season-import-note">Used for new schedule imports</span>'
        : `<button type="button" class="button button-secondary button-compact" data-testid="activate-season" onclick="activateSeasonFromSettings('${String(season.id).replaceAll("'", "\\'")}')">Make Active</button>`}
    </article>
  `;
}

function renderSeasonEntryDialog() {
  return `
    <dialog class="settings-dialog" data-testid="season-entry-dialog">
      <form data-testid="season-entry-form">
        <div class="settings-dialog-header">
          <div><h3>Create Season</h3><p>Create the operating season that new schedule imports will use.</p></div>
          <button type="button" class="dialog-close-button" aria-label="Close create season dialog" data-testid="season-entry-close">×</button>
        </div>
        <label>Season Name<input data-testid="season-entry-name" name="seasonName" autocomplete="off" placeholder="LSYB Fall 2026" required></label>
        <div class="settings-date-grid">
          <label>Start Date<input type="date" data-testid="season-entry-start" name="startsOn" required></label>
          <label>End Date<input type="date" data-testid="season-entry-end" name="endsOn" required></label>
        </div>
        <label class="checkbox-row settings-season-active-choice"><input type="checkbox" data-testid="season-entry-active"> Make this the active season for new schedule imports</label>
        <p class="settings-season-warning" data-testid="season-entry-active-warning" hidden></p>
        <div class="form-actions"><button type="submit" class="button button-primary" data-testid="season-entry-save">Create Season</button><button type="button" class="button button-secondary" data-testid="season-entry-cancel">Cancel</button></div>
        <p role="alert" data-testid="season-entry-error"></p>
      </form>
    </dialog>`;
}

function renderLocationSettingsCard() {
  const catalog = typeof facilityService !== "undefined" ? facilityService.snapshot() : { facilities: [], fields: [], availability: [], closures: [], reservations: [], loaded: false };
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  return `
    <section class="card presentation-card settings-card settings-location-card facility-manager" data-testid="settings-locations">
      <div class="page-section-header presentation-card-header-blue"><div><h3>Facilities & Reservations</h3><p>Manage fields, operating windows, closures, and conflict-safe bookings.</p></div><button type="button" class="button button-secondary button-compact" data-testid="add-facility" onclick="openFacilityDialog()">Add Facility</button></div>
      <div class="facility-toolbar"><button class="button button-secondary button-compact" type="button" data-testid="add-reservation" onclick="openReservationDialog()">New Reservation</button><button class="button button-secondary button-compact" type="button" data-testid="add-closure" onclick="openClosureDialog()">Maintenance / Blackout</button></div>
      <div class="settings-location-list" data-testid="facility-list">
        ${!catalog.loaded ? '<p class="settings-muted">Loading facilities…</p>' : catalog.facilities.length ? catalog.facilities.map(facility => `
          <section class="facility-card" data-testid="facility-card"><header><div><strong>${escapeSettingsHtml(facility.name)}</strong><span>${escapeSettingsHtml(facility.address || "No address")} · ${escapeSettingsHtml(facility.timezone)} · ${escapeSettingsHtml(facility.status)}</span></div><div><button type="button" class="button button-link button-compact" onclick="openFacilityDialog('${facility.id}')">Edit</button><button type="button" class="button button-link button-compact" onclick="openFieldDialog('${facility.id}')">Add Field</button></div></header>
          <div class="facility-field-grid">${catalog.fields.filter(field => field.location_id === facility.id).map(field => `<article data-testid="facility-field"><div><strong>${escapeSettingsHtml(field.name)}</strong><span>${escapeSettingsHtml(field.status)}${field.supported_sports?.length ? ` · ${escapeSettingsHtml(field.supported_sports.join(", "))}` : ""}</span></div><div class="facility-field-actions"><button type="button" class="button button-link button-compact" onclick="openFieldDialog('${facility.id}','${field.id}')">Edit</button><button type="button" class="button button-link button-compact" onclick="openAvailabilityDialog('${field.id}')">Add Hours</button></div><div class="facility-hours">${catalog.availability.filter(rule => rule.field_id === field.id).map(rule => `<span>${days[rule.day_of_week]} ${String(rule.starts_at_local).slice(0,5)}–${String(rule.ends_at_local).slice(0,5)}</span>`).join("") || '<span>No availability configured</span>'}</div></article>`).join("") || '<p class="settings-muted">No fields yet.</p>'}</div>
          </section>`).join("") : '<div class="settings-empty"><strong>No facilities yet.</strong><span>Add the first facility and its fields.</span></div>'}
      </div>
      <div class="facility-timeline" data-testid="reservation-timeline"><h4>Reservation Timeline</h4>${catalog.reservations.length ? catalog.reservations.map(item => { const field = catalog.fields.find(value => value.id === item.field_id); const facility = catalog.facilities.find(value => value.id === field?.location_id); return `<article class="reservation-row ${item.status === "cancelled" ? "is-cancelled" : ""}" data-testid="reservation-row"><time>${new Date(item.starts_at).toLocaleString()} – ${new Date(item.ends_at).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}</time><div><strong>${escapeSettingsHtml(item.title)}</strong><span>${escapeSettingsHtml(facility?.name || "Facility")} · ${escapeSettingsHtml(field?.name || "Field")} · ${escapeSettingsHtml(item.reservation_type.replaceAll("_"," "))}</span></div>${item.status === "active" ? `<div><button class="button button-link button-compact" type="button" onclick="openReservationDialog('${item.id}')">Edit</button><button class="button button-link button-compact" type="button" onclick="cancelReservationFromSettings('${item.id}')">Cancel</button></div>` : '<span class="status-badge">Cancelled</span>'}</article>`; }).join("") : '<p class="settings-muted">No reservations yet.</p>'}</div>
    </section>
  `;
}

function renderFacilityDialogs() {
  const sports = '<label>Supported sports<input name="supportedSports" placeholder="baseball, softball"></label>';
  const status = '<label>Status<select name="status"><option value="operational">Operational</option><option value="limited">Limited</option><option value="closed">Closed</option></select></label>';
  const shell = (testid, title, body) => `<dialog class="settings-dialog" data-testid="${testid}"><form data-facility-form="${testid}"><h3>${title}</h3>${body}<div class="form-actions"><button class="button button-primary" type="submit">Save</button><button class="button button-secondary" type="button" data-dialog-cancel>Cancel</button></div><p role="alert" data-form-error></p></form></dialog>`;
  return shell("facility-dialog","Facility",`<input type="hidden" name="id"><label>Name<input name="name" required></label><label>Address<input name="address"></label><label>Timezone<input name="timezone" value="America/New_York" required></label>${sports}${status}<label>Notes<textarea name="notes"></textarea></label>`)
    + shell("field-dialog","Field",`<input type="hidden" name="id"><input type="hidden" name="facilityId"><label>Name<input name="name" required></label>${sports}${status}<div class="settings-form-grid"><label>Minimum age<input name="minimumAge" type="number" min="3" max="99"></label><label>Maximum age<input name="maximumAge" type="number" min="3" max="99"></label></div><label>Division / age suitability notes<textarea name="divisionNotes"></textarea></label>`)
    + shell("availability-dialog","Field availability",`<input type="hidden" name="fieldId"><label>Day<select name="dayOfWeek">${["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map((day,index)=>`<option value="${index}">${day}</option>`).join("")}</select></label><div class="settings-form-grid"><label>Opens<input name="startsAtLocal" type="time" required></label><label>Closes<input name="endsAtLocal" type="time" required></label></div><div class="settings-form-grid"><label>Effective from<input name="effectiveFrom" type="date"></label><label>Effective until<input name="effectiveUntil" type="date"></label></div>`)
    + shell("closure-dialog","Maintenance or blackout",`<label>Field<select name="fieldId" required></select></label><label>Type<select name="closureType"><option value="maintenance">Maintenance</option><option value="blackout">Blackout</option><option value="weather">Weather</option><option value="administrative">Administrative</option></select></label><label>Title<input name="title" required></label><div class="settings-form-grid"><label>Starts<input name="startsAt" type="datetime-local" required></label><label>Ends<input name="endsAt" type="datetime-local" required></label></div><label>Notes<textarea name="notes"></textarea></label>`)
    + shell("reservation-dialog","Field reservation",`<input type="hidden" name="id"><label>Field<select name="fieldId" required></select></label><label>Type<select name="reservationType"><option value="game">Game</option><option value="practice">Practice</option><option value="tournament">Tournament</option><option value="administrative_hold">Administrative hold</option></select></label><label>Title<input name="title" required></label><div class="settings-form-grid"><label>Starts<input name="startsAt" type="datetime-local" required></label><label>Ends<input name="endsAt" type="datetime-local" required></label></div><label>Notes<textarea name="notes"></textarea></label>`)
    + `<dialog class="settings-dialog" data-testid="reservation-cancel-dialog"><form data-testid="reservation-cancel-form"><h3>Cancel reservation?</h3><input type="hidden" name="id"><p>The slot will become available immediately.</p><div class="form-actions"><button class="button button-primary" type="submit">Cancel Reservation</button><button class="button button-secondary" type="button" data-dialog-cancel>Keep Reservation</button></div><p role="alert" data-form-error></p></form></dialog>`;
}

function renderCompetitionCatalogCard() {
  const ready = typeof leagueStructureService !== "undefined" && leagueStructureService.isLoaded();
  const catalog = ready ? leagueStructureService.snapshot() : { programs: [], leagues: [], divisions: [], teams: [] };
  return `
    <section class="card presentation-card settings-card settings-competition-card" data-testid="settings-competition-catalog">
      <div class="page-section-header presentation-card-header-blue">
        <div><h3>Sports, Divisions & Teams</h3><p>Organization-scoped competition structure for league schedules and tournaments.</p></div>
        <button type="button" class="button button-secondary button-compact" data-testid="add-competition-program" onclick="openCompetitionProgramDialog()">Add Sport Program</button>
      </div>
      <div class="settings-competition-list" data-testid="settings-competition-list">
        ${!ready
          ? '<p class="settings-muted" data-testid="competition-catalog-loading">Loading competition catalog…</p>'
          : catalog.leagues.length
            ? catalog.leagues.map(league => renderCompetitionLeague(catalog, league)).join("")
            : '<div class="settings-empty" data-testid="competition-catalog-empty"><strong>No sport programs yet.</strong><span>Add baseball or softball, then create divisions and teams for the active season.</span></div>'}
      </div>
    </section>`;
}

function renderCompetitionLeague(catalog, league) {
  const program = catalog.programs.find(item => String(item.id) === String(league.organization_sport_id));
  const divisions = catalog.divisions.filter(item => String(item.league_id) === String(league.id));
  return `<section class="settings-competition-league" data-testid="competition-league" data-league-id="${escapeSettingsHtml(league.id)}">
    <header><div><strong>${escapeSettingsHtml(program?.display_name || "Sport Program")}</strong><span>${escapeSettingsHtml(league.name)}</span></div><button type="button" class="button button-link button-compact" data-testid="add-competition-division" onclick="openCompetitionDivisionDialog('${escapeSettingsHtml(league.id)}')">Add Division</button></header>
    <div class="settings-competition-divisions">${divisions.length ? divisions.map(division => renderCompetitionDivision(catalog, division)).join("") : '<p class="settings-muted">No divisions configured.</p>'}</div>
  </section>`;
}

function renderCompetitionDivision(catalog, division) {
  const teams = catalog.teams.filter(item => String(item.division_id) === String(division.id));
  return `<article class="settings-competition-division" data-testid="competition-division" data-division-id="${escapeSettingsHtml(division.id)}">
    <div><strong>${escapeSettingsHtml(division.name)}</strong><span class="settings-pill">${escapeSettingsHtml(division.code)}</span></div>
    <div class="settings-list">${teams.length ? teams.map(team => `<span class="settings-pill" data-testid="competition-team">${escapeSettingsHtml(team.name)}</span>`).join("") : '<span class="settings-muted">No teams yet.</span>'}</div>
    <button type="button" class="button button-link button-compact" data-testid="add-competition-team" onclick="openCompetitionTeamDialog('${escapeSettingsHtml(division.id)}')">Add Team</button>
  </article>`;
}

function renderCompetitionCatalogDialogs() {
  return `
    <dialog class="settings-dialog" data-testid="competition-program-dialog"><form data-testid="competition-program-form"><h3>Add Sport Program</h3><label>Sport<select data-testid="competition-program-sport" required></select></label><label>Program Name<input data-testid="competition-program-name" placeholder="Lake Shore Softball" required></label><label>League Name<input data-testid="competition-program-league" placeholder="Lake Shore Softball League" required></label><div class="form-actions"><button class="button button-primary" type="submit">Create Program</button><button class="button button-secondary" type="button" data-dialog-cancel>Cancel</button></div><p role="alert" data-testid="competition-program-error"></p></form></dialog>
    <dialog class="settings-dialog" data-testid="competition-division-dialog"><form data-testid="competition-division-form"><h3>Add Division</h3><input type="hidden" data-testid="competition-division-league"><label>Season<select data-testid="competition-division-season" required></select></label><label>Division Name<input data-testid="competition-division-name" placeholder="12U" required></label><label>Code<input data-testid="competition-division-code" placeholder="12U" required></label><div class="settings-date-grid"><label>Minimum Age<input type="number" min="3" max="99" data-testid="competition-division-min-age"></label><label>Maximum Age<input type="number" min="3" max="99" data-testid="competition-division-max-age"></label></div><div class="form-actions"><button class="button button-primary" type="submit">Create Division</button><button class="button button-secondary" type="button" data-dialog-cancel>Cancel</button></div><p role="alert" data-testid="competition-division-error"></p></form></dialog>
    <dialog class="settings-dialog" data-testid="competition-team-dialog"><form data-testid="competition-team-form"><h3>Add Team</h3><input type="hidden" data-testid="competition-team-division"><label>Team Name<input data-testid="competition-team-name" required></label><label>Short Name<input data-testid="competition-team-short-name"></label><div class="form-actions"><button class="button button-primary" type="submit">Create Team</button><button class="button button-secondary" type="button" data-dialog-cancel>Cancel</button></div><p role="alert" data-testid="competition-team-error"></p></form></dialog>`;
}

function refreshCompetitionCatalogCard() {
  const current = document.querySelector('[data-testid="settings-competition-catalog"]');
  if (current) current.outerHTML = renderCompetitionCatalogCard();
}

async function loadCompetitionCatalog() {
  if (typeof leagueStructureService === "undefined") return;
  const result = await leagueStructureService.loadCatalog();
  if (!result.success) {
    const list = document.querySelector('[data-testid="settings-competition-list"]');
    if (list) list.innerHTML = `<div class="settings-empty settings-error"><strong>Competition catalog could not be loaded.</strong><span>${escapeSettingsHtml(result.message)}</span></div>`;
    return;
  }
  refreshCompetitionCatalogCard();
}

function openCompetitionProgramDialog() {
  const dialog = document.querySelector('[data-testid="competition-program-dialog"]');
  const catalog = leagueStructureService.snapshot();
  const select = dialog?.querySelector('[data-testid="competition-program-sport"]');
  if (select) select.innerHTML = catalog.sports.map(sport => `<option value="${escapeSettingsHtml(sport.code)}">${escapeSettingsHtml(sport.name)}</option>`).join("");
  dialog?.querySelector("form")?.reset();
  dialog?.showModal();
}

function openCompetitionDivisionDialog(leagueId) {
  const dialog = document.querySelector('[data-testid="competition-division-dialog"]');
  const seasons = seasonService.getSeasons();
  const seasonSelect = dialog?.querySelector('[data-testid="competition-division-season"]');
  if (seasonSelect) seasonSelect.innerHTML = seasons.map(season => `<option value="${escapeSettingsHtml(season.id)}" ${season.active ? "selected" : ""}>${escapeSettingsHtml(season.name)}</option>`).join("");
  dialog?.querySelector("form")?.reset();
  const leagueInput = dialog?.querySelector('[data-testid="competition-division-league"]');
  if (leagueInput) leagueInput.value = leagueId;
  dialog?.showModal();
}

function openCompetitionTeamDialog(divisionId) {
  const dialog = document.querySelector('[data-testid="competition-team-dialog"]');
  dialog?.querySelector("form")?.reset();
  const divisionInput = dialog?.querySelector('[data-testid="competition-team-division"]');
  if (divisionInput) divisionInput.value = divisionId;
  dialog?.showModal();
}

async function submitCompetitionProgram(event) {
  event.preventDefault();
  const result = await leagueStructureService.createProgram({
    sportCode: document.querySelector('[data-testid="competition-program-sport"]')?.value,
    displayName: document.querySelector('[data-testid="competition-program-name"]')?.value,
    leagueName: document.querySelector('[data-testid="competition-program-league"]')?.value
  });
  const error = document.querySelector('[data-testid="competition-program-error"]');
  if (!result.success) { if (error) error.textContent = result.message; return toastService.error(result.message); }
  document.querySelector('[data-testid="competition-program-dialog"]')?.close();
  refreshCompetitionCatalogCard();
  toastService.success(result.message);
}

async function submitCompetitionDivision(event) {
  event.preventDefault();
  const result = await leagueStructureService.createDivision({
    leagueId: document.querySelector('[data-testid="competition-division-league"]')?.value,
    seasonId: document.querySelector('[data-testid="competition-division-season"]')?.value,
    name: document.querySelector('[data-testid="competition-division-name"]')?.value,
    code: document.querySelector('[data-testid="competition-division-code"]')?.value,
    minimumAge: document.querySelector('[data-testid="competition-division-min-age"]')?.value,
    maximumAge: document.querySelector('[data-testid="competition-division-max-age"]')?.value
  });
  const error = document.querySelector('[data-testid="competition-division-error"]');
  if (!result.success) { if (error) error.textContent = result.message; return toastService.error(result.message); }
  document.querySelector('[data-testid="competition-division-dialog"]')?.close();
  refreshCompetitionCatalogCard();
  toastService.success(result.message);
}

async function submitCompetitionTeam(event) {
  event.preventDefault();
  const result = await leagueStructureService.createTeam({
    divisionId: document.querySelector('[data-testid="competition-team-division"]')?.value,
    name: document.querySelector('[data-testid="competition-team-name"]')?.value,
    shortName: document.querySelector('[data-testid="competition-team-short-name"]')?.value
  });
  const error = document.querySelector('[data-testid="competition-team-error"]');
  if (!result.success) { if (error) error.textContent = result.message; return toastService.error(result.message); }
  document.querySelector('[data-testid="competition-team-dialog"]')?.close();
  refreshCompetitionCatalogCard();
  toastService.success(result.message);
}

function refreshSeasonSettingsCard() {
  const current = document.querySelector('[data-testid="settings-seasons"]');
  if (current) current.outerHTML = renderSeasonSettingsCard();
}

async function loadSeasonSettings() {
  if (typeof seasonService === "undefined") return;
  const result = await seasonService.loadSeasons();
  if (!result.success) {
    const list = document.querySelector('[data-testid="settings-season-list"]');
    if (list) list.innerHTML = `<div class="settings-empty settings-error" data-testid="seasons-error"><strong>Seasons could not be loaded.</strong><span>${escapeSettingsHtml(result.message)}</span></div>`;
    return;
  }
  refreshSeasonSettingsCard();
}

function openSeasonEntryDialog() {
  const dialog = document.querySelector('[data-testid="season-entry-dialog"]');
  if (!dialog) return;
  const activeSeason = seasonService.getActiveSeason();
  const form = document.querySelector('[data-testid="season-entry-form"]');
  form?.reset();
  document.querySelector('[data-testid="season-entry-error"]').textContent = "";
  const activeCheckbox = document.querySelector('[data-testid="season-entry-active"]');
  const warning = document.querySelector('[data-testid="season-entry-active-warning"]');
  if (activeCheckbox) activeCheckbox.checked = !activeSeason;
  if (warning) {
    warning.hidden = !activeSeason;
    warning.textContent = activeSeason
      ? `${activeSeason.name} is currently active. Selecting this option will replace it as the season used for new schedule imports.`
      : "";
  }
  dialog.showModal();
}

async function submitSeasonEntry(event) {
  event.preventDefault();
  const saveButton = document.querySelector('[data-testid="season-entry-save"]');
  const errorNode = document.querySelector('[data-testid="season-entry-error"]');
  const active = Boolean(document.querySelector('[data-testid="season-entry-active"]')?.checked);
  const activeSeason = seasonService.getActiveSeason();

  if (active && activeSeason) {
    const approved = window.confirm(`Make this the active season? ${activeSeason.name} will no longer be used for new schedule imports.`);
    if (!approved) return;
  }

  if (saveButton) saveButton.disabled = true;
  if (errorNode) errorNode.textContent = "";
  const result = await seasonService.createSeason({
    name: document.querySelector('[data-testid="season-entry-name"]')?.value,
    startsOn: document.querySelector('[data-testid="season-entry-start"]')?.value,
    endsOn: document.querySelector('[data-testid="season-entry-end"]')?.value,
    active
  });
  if (saveButton) saveButton.disabled = false;
  if (!result.success) {
    if (errorNode) errorNode.textContent = result.message;
    toastService.error(result.message);
    return;
  }
  document.querySelector('[data-testid="season-entry-dialog"]')?.close();
  refreshSeasonSettingsCard();
  toastService.success(result.message);
}

async function activateSeasonFromSettings(seasonId) {
  const target = seasonService.getSeasons().find(season => String(season.id) === String(seasonId));
  if (!target || target.active) return;
  const current = seasonService.getActiveSeason();
  const message = current
    ? `Make ${target.name} the active season? ${current.name} will no longer be used for new schedule imports.`
    : `Make ${target.name} the active season for new schedule imports?`;
  if (!window.confirm(message)) return;
  const result = await seasonService.activateSeason(seasonId);
  result.success ? toastService.success(result.message) : toastService.error(result.message);
  if (result.success) refreshSeasonSettingsCard();
}

function fillForm(form, values = {}) { Object.entries(values).forEach(([key,value]) => { if (form.elements[key]) form.elements[key].value = value ?? ""; }); }
function fieldOptions(selected = "") { const catalog = facilityService.snapshot(); return catalog.fields.map(field => { const facility = catalog.facilities.find(item => item.id === field.location_id); return `<option value="${field.id}" ${field.id === selected ? "selected" : ""}>${escapeSettingsHtml(facility?.name || "Facility")} — ${escapeSettingsHtml(field.name)}</option>`; }).join(""); }
function localInput(value) { if (!value) return ""; const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,16); }
function openFacilityDialog(id = "") { const dialog = document.querySelector('[data-testid="facility-dialog"]'); const form = dialog.querySelector("form"); form.reset(); const item = facilityService.snapshot().facilities.find(value => value.id === id); if (item) fillForm(form,{...item,supportedSports:(item.supported_sports||[]).join(",")}); dialog.showModal(); }
function openFieldDialog(facilityId, id = "") { const dialog = document.querySelector('[data-testid="field-dialog"]'); const form = dialog.querySelector("form"); form.reset(); const item = facilityService.snapshot().fields.find(value => value.id === id); fillForm(form,item ? {id:item.id,facilityId:item.location_id,name:item.name,supportedSports:(item.supported_sports||[]).join(","),status:item.status,minimumAge:item.minimum_age,maximumAge:item.maximum_age,divisionNotes:item.division_notes} : {facilityId}); dialog.showModal(); }
function openAvailabilityDialog(fieldId) { const dialog = document.querySelector('[data-testid="availability-dialog"]'); dialog.querySelector("form").reset(); fillForm(dialog.querySelector("form"),{fieldId}); dialog.showModal(); }
function openClosureDialog() { const dialog = document.querySelector('[data-testid="closure-dialog"]'); const form=dialog.querySelector("form"); form.reset(); form.elements.fieldId.innerHTML=fieldOptions(); dialog.showModal(); }
function openReservationDialog(id = "") { const dialog = document.querySelector('[data-testid="reservation-dialog"]'); const form=dialog.querySelector("form"); form.reset(); const item=facilityService.snapshot().reservations.find(value=>value.id===id); form.elements.fieldId.innerHTML=fieldOptions(item?.field_id); if(item) fillForm(form,{id:item.id,fieldId:item.field_id,reservationType:item.reservation_type,title:item.title,startsAt:localInput(item.starts_at),endsAt:localInput(item.ends_at),notes:item.notes}); dialog.showModal(); }
function cancelReservationFromSettings(id) { const dialog=document.querySelector('[data-testid="reservation-cancel-dialog"]'); const form=dialog.querySelector("form"); form.reset(); fillForm(form,{id}); dialog.showModal(); }
function formObject(form) { return Object.fromEntries(new FormData(form).entries()); }
async function submitFacilityForm(event, action) { event.preventDefault(); const form=event.currentTarget; const result=await action(formObject(form)); const error=form.querySelector("[data-form-error]"); if(!result.success){ error.textContent=result.message; return toastService.error(result.message); } form.closest("dialog").close(); toastService.success(result.message); renderPage("settings"); }
async function submitReservationCancellation(event) { event.preventDefault(); const form=event.currentTarget; const result=await facilityService.cancelReservation(form.elements.id.value); const error=form.querySelector("[data-form-error]"); if(!result.success){ error.textContent=result.message; return toastService.error(result.message); } form.closest("dialog").close(); toastService.success(result.message); renderPage("settings"); }

function setupSettingsPage() {
  document.querySelector('[data-testid="season-entry-form"]')?.addEventListener("submit", submitSeasonEntry);
  document.querySelector('[data-testid="season-entry-cancel"]')?.addEventListener("click", event => event.currentTarget.closest("dialog").close());
  document.querySelector('[data-testid="season-entry-close"]')?.addEventListener("click", event => event.currentTarget.closest("dialog").close());
  document.querySelector('[data-facility-form="facility-dialog"]')?.addEventListener("submit", event => submitFacilityForm(event, facilityService.saveFacility));
  document.querySelector('[data-facility-form="field-dialog"]')?.addEventListener("submit", event => submitFacilityForm(event, facilityService.saveField));
  document.querySelector('[data-facility-form="availability-dialog"]')?.addEventListener("submit", event => submitFacilityForm(event, values => facilityService.addAvailability({...values,dayOfWeek:Number(values.dayOfWeek)})));
  document.querySelector('[data-facility-form="closure-dialog"]')?.addEventListener("submit", event => submitFacilityForm(event, values => facilityService.addClosure({...values,startsAt:new Date(values.startsAt).toISOString(),endsAt:new Date(values.endsAt).toISOString()})));
  document.querySelector('[data-facility-form="reservation-dialog"]')?.addEventListener("submit", event => submitFacilityForm(event, values => facilityService.saveReservation({...values,startsAt:new Date(values.startsAt).toISOString(),endsAt:new Date(values.endsAt).toISOString()})));
  document.querySelector('[data-testid="reservation-cancel-form"]')?.addEventListener("submit", submitReservationCancellation);
  document.querySelector('[data-testid="competition-program-form"]')?.addEventListener("submit", submitCompetitionProgram);
  document.querySelector('[data-testid="competition-division-form"]')?.addEventListener("submit", submitCompetitionDivision);
  document.querySelector('[data-testid="competition-team-form"]')?.addEventListener("submit", submitCompetitionTeam);
  document.querySelectorAll("[data-dialog-cancel]").forEach(button => button.addEventListener("click", event => event.currentTarget.closest("dialog").close()));
  loadSeasonSettings();
  loadCompetitionCatalog();
  facilityService.load().then(result => { if (result.success) { const current=document.querySelector('[data-testid="settings-locations"]'); if(current) current.outerHTML=renderLocationSettingsCard(); } });
}
