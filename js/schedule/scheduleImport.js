// js/schedule/scheduleImport.js

let currentScheduleImportPreview = null;

function openScheduleImport() {
  closeScheduleImport();

  currentScheduleImportPreview = null;

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

        <button
          class="button button-link button-compact"
          aria-label="Close schedule import"
          onclick="closeScheduleImport()">
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
          class="button button-primary"
          data-testid="schedule-import-submit"
          onclick="importSchedulePreview()"
          disabled>
          Import
        </button>

        <button
          class="button button-secondary secondary"
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

  currentScheduleImportPreview = null;
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

  currentScheduleImportPreview = preview;

  container.innerHTML = `
    <hr>

    <div class="import-summary" data-testid="schedule-import-summary">
      <strong>${preview.validRows} Games Ready</strong>
      <span>${preview.invalidRows} Skipped</span>
      <span>${preview.errors.length} Errors</span>
    </div>

    <h3>Errors</h3>

    ${
      preview.errors.length
        ? preview.errors.map(error => `
            <div
              class="import-error presentation-error-state"
              role="alert"
              aria-live="assertive"
            >
              <strong>Row ${error.row}</strong><br>
              ${error.message}
            </div>
          `).join("")
        : "<p>No errors.</p>"
    }

  `;

  updateScheduleImportButton();
}

function updateScheduleImportButton() {
  const importButton =
    document.querySelector(
      '[data-testid="schedule-import-submit"]'
    );

  if (!importButton) return;

  importButton.disabled =
    !currentScheduleImportPreview?.games?.length || Boolean(currentScheduleImportPreview?.errors?.length);
}

async function importSchedulePreview() {
  const games =
    currentScheduleImportPreview?.games || [];

  if (!games.length) return;

  const importButton =
    document.querySelector(
      '[data-testid="schedule-import-submit"]'
    );

  if (importButton) {
    importButton.disabled = true;
  }

  const result = await gameService.importSchedule(games);
  if (!result.success) {
    renderScheduleImportPreview({ ...currentScheduleImportPreview, errors: [{ row: 0, message: result.message }] });
    return;
  }
  const importedCount = result.data?.importedCount ?? games.length;

  closeScheduleImport();

  renderScheduleContent();

  toastService.success(
    `${importedCount} ${
      importedCount === 1 ? "game" : "games"
    } imported.`
  );
}
