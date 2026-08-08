function renderSettings() {
  return `
    <section class="settings-page presentation-page" data-testid="settings-page">
      <header class="presentation-page-header settings-page-header"><div><h2>Settings</h2><p>Manage pilot scheduling reference data and locations.</p></div></header>
    <div class="card-grid settings-card-grid">
      ${renderLocationSettingsCard()}
      ${renderSettingsCard("Levels", settings.levels)}
      ${renderSettingsCard("Teams", settings.teams)}
      ${renderSettingsCard("Time Slots", settings.timeSlots.slice(0, 12))}
    </div></section>
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

function addLocationComplexFromSettings() {
  const name = window.prompt("Location complex name");
  if (name === null) return;
  const result = locationService.addComplex(name);
  result.success ? toastService.success(result.message) : toastService.error(result.message);
  if (result.success) renderPage("settings");
}

function addLocationFieldFromSettings(complexName) {
  const name = window.prompt(`Field name for ${complexName}`);
  if (name === null) return;
  const result = locationService.addField(complexName, name);
  result.success ? toastService.success(result.message) : toastService.error(result.message);
  if (result.success) renderPage("settings");
}
