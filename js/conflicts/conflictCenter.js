// js/conflicts/conflictCenter.js

let activeFilter = "all";

function renderConflictCenter({
  containerId = "conflict-center",
  date,
  handlers = {}
}) {
  const container =
    document.getElementById(containerId);

  if (!container) return;

  if (!date) {
    container.innerHTML =
      renderConflictEmptyState(
        "Select a date to view issues."
      );
    return;
  }

  const issues =
    normalizeConflictIssues(
      conflictService.getDailyIssues(date)
    );

  const visibleIssues =
    filterIssues(issues, activeFilter);

  container.innerHTML = `
    <section class="conflict-center-panel">

      <div class="conflict-center-header">

        <div>

          <p class="section-kicker">
            Operations
          </p>

          <h2>
            Conflict Center
          </h2>

        </div>

        <div class="conflict-center-count">

          ${issues.length}

          <span>
            ${issues.length === 1 ? "Issue" : "Issues"}
          </span>

        </div>

      </div>

      ${renderConflictFilters(
        activeFilter,
        issues
      )}

      <div class="conflict-list">

        ${
          visibleIssues.length
            ? visibleIssues
                .map(issue =>
                  renderConflictCard(
                    issue,
                    handlers
                  )
                )
                .join("")
            : renderConflictEmptyState(
                "No issues found for this day."
              )
        }

      </div>

    </section>
  `;

  bindConflictFilters(
    container,
    nextFilter => {

      activeFilter = nextFilter;

      renderConflictCenter({
        containerId,
        date,
        handlers
      });

    }
  );

  bindConflictCardActions(
    container,
    handlers
  );

  injectConflictCenterStyles();
}

function normalizeConflictIssues(rawIssues) {

  if (Array.isArray(rawIssues)) {
    return rawIssues;
  }

  if (!rawIssues) {
    return [];
  }

  return [

    ...(rawIssues.openGames || []),

    ...(rawIssues.doubleBookings || []),

    ...(rawIssues.eligibilityIssues || []),

    ...(rawIssues.overloadedCrew || []),

    ...(rawIssues.inactiveAssignments || [])

  ];

}

function renderConflictEmptyState(message) {
  return `
    <div class="conflict-empty-state">
      ${message}
    </div>
  `;
}
function injectConflictCenterStyles() {
  if (document.getElementById("conflict-center-styles")) return;

  const style = document.createElement("style");
  style.id = "conflict-center-styles";

  style.textContent = `
    .conflict-center-panel {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 18px;
      padding: 18px;
      box-shadow: 0 10px 25px rgba(15, 23, 42, 0.06);
      margin-bottom: 20px;
    }

    .conflict-center-header {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: center;
      margin-bottom: 16px;
    }

    .conflict-center-count {
      min-width: 74px;
      height: 74px;
      border-radius: 18px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      font-weight: 900;
      color: #0f172a;
    }

    .conflict-center-count span {
      font-size: 11px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .conflict-list {
      display: grid;
      gap: 10px;
    }

    .conflict-empty-state {
      border: 1px dashed #cbd5e1;
      background: #f8fafc;
      color: #64748b;
      border-radius: 14px;
      padding: 18px;
      text-align: center;
      font-weight: 700;
    }
  `;

  document.head.appendChild(style);
}