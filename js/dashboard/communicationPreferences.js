// js/dashboard/communicationPreferences.js

function renderCommunicationPreferencesCard() {
  const summary =
    dashboardService
      .getCommunicationPreferencesSummary();

  return `
    <section
      class="dashboard-card"
      data-testid="dashboard-communication-preferences"
    >
      <div class="dashboard-card-header">
        <div>
          <h3>Communication Preferences</h3>

          <span class="muted">
            In-app notification controls
          </span>
        </div>

        <span
          class="status-badge"
          data-testid="dashboard-communication-disabled-count"
        >
          ${summary.disabledCount}
        </span>
      </div>

      <p
        class="muted"
        data-testid="dashboard-communication-summary"
      >
        ${summary.enabledCount} enabled,
        ${summary.disabledCount} disabled.
      </p>

      <button
        type="button"
        class="secondary-button"
        data-testid="dashboard-open-communication-preferences"
        onclick='navigateTo(
          "profile",
          {
            section: "communication"
          }
        )'
      >
        Manage Preferences
      </button>
    </section>
  `;
}
