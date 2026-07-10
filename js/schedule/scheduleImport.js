// js/schedule/scheduleImport.js

function openScheduleImport() {
  closeScheduleImport();

  const overlay = document.createElement("div");
  overlay.id = "schedule-import-overlay";

  overlay.innerHTML = `
    <div
      class="assign-drawer-backdrop"
      onclick="closeScheduleImport()">
    </div>

    <aside
      class="assign-drawer"
      data-testid="schedule-import">

      <div class="assign-drawer-header">
        <h2>Import Schedule</h2>

        <button onclick="closeScheduleImport()">
          ×
        </button>
      </div>

      <label>Choose CSV File</label>

      <input
        type="file"
        accept=".csv"
        data-testid="schedule-import-file"
        onchange="readScheduleImportFile(event)" />

      <div
        id="schedule-import-preview"
        data-testid="schedule-import-preview">
      </div>

      <div class="assign-drawer-actions">
        <button
          class="secondary"
          data-testid="schedule-import-close"
          onclick="closeScheduleImport()">
          Close
        </button>
      </div>

    </aside>
  `;

  document.body.appendChild(overlay);
}

function closeScheduleImport() {
  document
    .getElementById("schedule-import-overlay")
    ?.remove();
}

async function readScheduleImportFile(event) {
  const file = event.target.files?.[0];

  if (!file) return;

  const csvText = await file.text();

  const preview =
    scheduleImportService.preview(csvText);

  renderScheduleImportPreview(preview);
}

function renderScheduleImportPreview(preview) {
  const container =
    document.getElementById("schedule-import-preview");

  if (!container) return;

  container.innerHTML = `
    <hr>

    <p><strong>Rows:</strong> ${preview.totalRows}</p>
    <p><strong>Valid:</strong> ${preview.validRows}</p>
    <p><strong>Invalid:</strong> ${preview.invalidRows}</p>

    <h3>Errors</h3>

    ${
      preview.errors.length
        ? preview.errors.map(error => `
            <div class="import-error">
              <strong>Row ${error.row}</strong><br>
              ${error.message}
            </div>
          `).join("")
        : "<p>No errors.</p>"
    }

    <h3>Preview</h3>

    ${
      preview.games.length
        ? preview.games.map(game => `
            <div class="import-preview-row">
              ${game.awayTeam} @ ${game.homeTeam}
            </div>
          `).join("")
        : "<p>No valid games.</p>"
    }
  `;
}