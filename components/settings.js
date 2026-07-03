function renderSettings() {
  return `
    <div class="card-grid">
      ${renderSettingsCard("Fields", settings.fields)}
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