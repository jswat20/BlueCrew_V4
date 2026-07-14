// components/admin.js

function renderAdmin() {
  const demoSummary =
    typeof demoDataService !== "undefined"
      ? demoDataService.getSummary()
      : {
          loaded: false,
          crew: 0,
          games: 0,
          accounts: 0
        };

  return `
    <div
      class="card-grid"
      data-testid="admin-tools">

      <section class="card">
        <h3>Developer Tools</h3>

        <p class="placeholder">
          Load realistic development data or restore the
          data that existed before the demo league was loaded.
        </p>

        <div
          class="admin-tool-status"
          data-testid="demo-league-status">

          ${
            demoSummary.loaded
              ? `
                <strong>Demo league loaded</strong>
                <p>
                  ${demoSummary.games} games,
                  ${demoSummary.crew} umpires,
                  ${demoSummary.accounts} accounts
                </p>
              `
              : `
                <strong>Demo league not loaded</strong>
                <p>Your current data is unchanged.</p>
              `
          }
        </div>

        <div class="admin-tool-actions">
          <button
            type="button"
            class="primary-btn"
            data-testid="load-demo-league"
            ${demoSummary.loaded ? "disabled" : ""}
            onclick="handleLoadDemoLeague()">
            Load Demo League
          </button>

          <button
            type="button"
            data-testid="restore-pre-demo-data"
            ${demoSummary.loaded ? "" : "disabled"}
            onclick="handleRestoreDemoLeague()">
            Restore Previous Data
          </button>

          <button
            type="button"
            data-testid="run-data-migration"
            onclick="handleRunDataMigration()">
            Run Data Migration
          </button>

          <button
            type="button"
            data-testid="rebuild-data-ids"
            onclick="handleRebuildDataIds()">
            Rebuild Missing IDs
          </button>

          <button
            type="button"
            class="danger-btn"
            data-testid="reset-all-local-data"
            onclick="handleResetAllLocalData()">
            Reset All Local Data
          </button>
        </div>
      </section>
    </div>
  `;
}

function handleLoadDemoLeague() {
  const confirmed = window.confirm(
    "Load the demo league? Your current data will be saved and can be restored."
  );

  if (!confirmed) return;

  const result = demoDataService.loadLeague();

  renderPage("admin");

  if (typeof updateNotificationBadge === "function") {
    updateNotificationBadge();
  }

  window.alert(result.message);
}

function handleRestoreDemoLeague() {
  const confirmed = window.confirm(
    "Restore the data that existed before the demo league was loaded?"
  );

  if (!confirmed) return;

  const result = demoDataService.resetLeague();

  renderPage("admin");

  if (typeof updateNotificationBadge === "function") {
    updateNotificationBadge();
  }

  window.alert(result.message);
}

function handleRunDataMigration() {
  migrationService.migrateGames();
  saveGames();

  renderPage("admin");
  window.alert("Data migration completed.");
}

function handleRebuildDataIds() {
  ensureDataIds();

  renderPage("admin");
  window.alert("Missing data IDs were rebuilt.");
}

function handleResetAllLocalData() {
  const confirmed = window.confirm(
    "Reset all locally stored The Slate data? This cannot be undone."
  );

  if (!confirmed) return;

  resetAllData();
}
