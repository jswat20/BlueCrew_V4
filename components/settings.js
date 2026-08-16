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
  return `
    <section class="settings-page presentation-page" data-testid="settings-page">
      <header class="presentation-page-header settings-page-header"><div><h2>Settings</h2><p>Manage season setup, scheduling reference data, and locations.</p></div></header>
    <div class="card-grid settings-card-grid">
      ${renderSeasonSettingsCard()}
      ${renderLocationSettingsCard()}
      ${renderSettingsCard("Levels", settings.levels)}
      ${renderSettingsCard("Teams", settings.teams)}
      ${renderSettingsCard("Time Slots", settings.timeSlots.slice(0, 12))}
    </div>${renderSeasonEntryDialog()}${renderLocationEntryDialog()}</section>
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

function renderLocationEntryDialog() {
  return `<dialog data-testid="location-entry-dialog"><form data-testid="location-entry-form"><h3 data-testid="location-entry-title">Add Location</h3><input type="hidden" data-testid="location-entry-complex"><label>Name<input data-testid="location-entry-name" required></label><div class="form-actions"><button type="submit" class="button button-primary">Save</button><button type="button" class="button button-secondary" data-testid="location-entry-cancel">Cancel</button></div><p role="alert" data-testid="location-entry-error"></p></form></dialog>`;
}

function renderLocationSettingsCard() {
  return `
    <section class="card presentation-card settings-card settings-location-card" data-testid="settings-locations">
      <div class="page-section-header presentation-card-header-blue"><div><h3>Location Complexes & Fields</h3><p>Fields belong to a specific game complex.</p></div><button type="button" class="button button-secondary button-compact" data-testid="add-location-complex" onclick="addLocationComplexFromSettings()">Add Complex</button></div>
      <div class="settings-location-list">
        ${locationService.getLocations().filter(location => location.name !== locationService.LEGACY_COMPLEX).map(location => `
          <section><header><strong>${location.name}</strong><button type="button" class="button button-link button-compact" onclick="addLocationFieldFromSettings('${location.name.replaceAll("'", "\\'")}')">Add Field</button></header><div class="settings-list">${location.fields.map(field => `<span class="settings-pill">${field}</span>`).join("")}</div></section>
        `).join("")}
      </div>
    </section>
  `;
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

function addLocationComplexFromSettings() {
  openLocationEntryDialog("Add Complex", "");
}

function addLocationFieldFromSettings(complexName) {
  openLocationEntryDialog(`Add Field for ${complexName}`, complexName);
}

function openLocationEntryDialog(title, complexName) {
  const dialog = document.querySelector('[data-testid="location-entry-dialog"]');
  document.querySelector('[data-testid="location-entry-title"]').textContent = title;
  document.querySelector('[data-testid="location-entry-complex"]').value = complexName;
  document.querySelector('[data-testid="location-entry-name"]').value = "";
  document.querySelector('[data-testid="location-entry-error"]').textContent = "";
  dialog.showModal();
}

async function submitLocationEntry(event) {
  event.preventDefault();
  const complexName = document.querySelector('[data-testid="location-entry-complex"]').value;
  const name = document.querySelector('[data-testid="location-entry-name"]').value;
  const result = complexName ? await locationService.addField(complexName, name) : await locationService.addComplex(name);
  result.success ? toastService.success(result.message) : toastService.error(result.message);
  if (!result.success) return document.querySelector('[data-testid="location-entry-error"]').textContent = result.message;
  if (result.success) renderPage("settings");
}

function setupSettingsPage() {
  document.querySelector('[data-testid="season-entry-form"]')?.addEventListener("submit", submitSeasonEntry);
  document.querySelector('[data-testid="season-entry-cancel"]')?.addEventListener("click", event => event.currentTarget.closest("dialog").close());
  document.querySelector('[data-testid="season-entry-close"]')?.addEventListener("click", event => event.currentTarget.closest("dialog").close());
  document.querySelector('[data-testid="location-entry-form"]')?.addEventListener("submit", submitLocationEntry);
  document.querySelector('[data-testid="location-entry-cancel"]')?.addEventListener("click", event => event.currentTarget.closest("dialog").close());
  loadSeasonSettings();
}
