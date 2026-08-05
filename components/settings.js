function renderSettings() {
  return `
    <div class="card-grid">
      ${renderLocationSettingsCard()}
      ${renderSettingsCard("Levels", settings.levels)}
      ${renderSettingsCard("Teams", settings.teams)}
      ${renderSettingsCard("Time Slots", settings.timeSlots.slice(0, 12))}
    </div>
  `;
}

function renderSettingsCard(title, items) {
  return `
    <div class="card">
      <div class="page-section-header">
        <h3>${title}</h3>
        <button class="small-btn">Add</button>
      </div>

      <div class="settings-list">
        ${items.map(item => `<span class="settings-pill">${item}</span>`).join("")}
      </div>
    </div>
  `;
}

function renderLocationSettingsCard() {
  return `
    <div class="card settings-location-card" data-testid="settings-locations">
      <div class="page-section-header"><div><h3>Location Complexes & Fields</h3><p class="muted">Fields belong to a specific game complex.</p></div><button type="button" class="small-btn" data-testid="add-location-complex" onclick="addLocationComplexFromSettings()">Add Complex</button></div>
      <div class="settings-location-list">
        ${locationService.getLocations().filter(location => location.name !== locationService.LEGACY_COMPLEX).map(location => `
          <section><header><strong>${location.name}</strong><button type="button" class="button button-link button-compact" onclick="addLocationFieldFromSettings('${location.name.replaceAll("'", "\\'")}')">Add Field</button></header><div class="settings-list">${location.fields.map(field => `<span class="settings-pill">${field}</span>`).join("")}</div></section>
        `).join("")}
      </div>
    </div>
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
