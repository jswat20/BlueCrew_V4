
// components/dashboard/index.js

function renderDashboard() {
  return `
    <div
      class="operations-dashboard"
      data-testid="operations-dashboard"
    >
      ${renderDashboardWelcome()}
      ${renderWorkspaceSetupGuide()}

      <div class="dashboard-entry-grid">
        <div class="dashboard-entry-main">
          ${renderDashboardDailyBrief()}
          ${renderDashboardTodayGames()}
        </div>

        <div class="dashboard-entry-activity">
          ${
            typeof renderRecentAssignmentActivity ===
              "function"
              ? renderRecentAssignmentActivity()
              : ""
          }
        </div>
      </div>
    </div>
  `;
}

function setupGuideEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function setupModuleName(code) {
  return ({ league: "League Management", umpire: "Officials Management", tournament: "Tournament Management", facility: "Facility Scheduling" })[code] || code;
}

function renderWorkspaceSetupGuide() {
  if (!authService?.isAdmin?.() || !workspaceService?.snapshot?.().activeWorkspace) return "";
  const setup = workspaceSetupService.snapshot();
  if (setup.dismissed) return `<section class="workspace-setup-revisit" data-testid="workspace-setup-revisit"><span>Workspace setup guide hidden</span><button type="button" class="button button-secondary" onclick="showWorkspaceSetupGuide()">Show setup guide</button></section>`;
  if (["idle", "loading"].includes(setup.status)) return `<section class="workspace-setup-card" data-testid="workspace-setup-guide" aria-busy="true"><p>Checking workspace setup…</p></section>`;
  const percent = setup.total ? Math.round((setup.complete / setup.total) * 100) : 100;
  const groups = [...new Set(setup.tasks.map(item => item.module))].map(module => {
    const tasks = setup.tasks.filter(item => item.module === module);
    return `<section class="workspace-setup-module" aria-labelledby="setup-${module}-heading"><h3 id="setup-${module}-heading">${setupModuleName(module)}</h3><ol>${tasks.map(item => `<li class="workspace-setup-task ${item.complete ? "is-complete" : ""}" data-testid="setup-task-${item.id}"><span class="workspace-setup-status" aria-hidden="true">${item.complete ? "✓" : "○"}</span><div><strong>${setupGuideEscape(item.title)}</strong><p>${setupGuideEscape(item.description)}</p></div><button type="button" class="button button-secondary" onclick="openWorkspaceSetupTask('${item.id}')">${item.complete ? "Review" : "Start"}<span class="sr-only"> ${setupGuideEscape(item.title)}</span></button></li>`).join("")}</ol></section>`;
  }).join("");
  return `<section class="workspace-setup-card" data-testid="workspace-setup-guide" aria-labelledby="workspace-setup-heading"><header><div><p class="workspace-setup-eyebrow">Getting started</p><h2 id="workspace-setup-heading">Configure ${setupGuideEscape(workspaceService.snapshot().activeWorkspace.organizationName)}</h2><p>${setup.complete} of ${setup.total} steps complete</p></div><button type="button" class="button button-link" onclick="hideWorkspaceSetupGuide()">Hide guide</button></header><div class="workspace-setup-progress" role="progressbar" aria-label="Workspace setup progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><span style="width:${percent}%"></span></div>${setup.status === "partial" ? `<p class="workspace-setup-warning" role="status">${setupGuideEscape(setup.message)}</p>` : ""}<div class="workspace-setup-groups">${groups}</div></section>`;
}

async function setupWorkspaceSetupGuide() {
  await workspaceSetupService.load();
  if (document.body.dataset.page !== "dashboard") return;
  const current = document.querySelector('[data-testid="workspace-setup-guide"], [data-testid="workspace-setup-revisit"]');
  if (current) current.outerHTML = renderWorkspaceSetupGuide();
}

function hideWorkspaceSetupGuide() { workspaceSetupService.setDismissed(true); renderPage("dashboard"); }
function showWorkspaceSetupGuide() { workspaceSetupService.setDismissed(false); renderPage("dashboard"); }

function openWorkspaceSetupTask(id) {
  const item = workspaceSetupService.snapshot().tasks.find(task => task.id === id);
  if (!item) return;
  navigateTo(item.destination);
  window.setTimeout(() => {
    if (item.action === "league-generator") openLeagueScheduleGenerator?.();
    if (item.action === "tournament-manager") openTournamentManager?.();
    if (item.action === "officials-game") openGameEditor?.();
    if (item.action === "facility") openFacilityDialog?.();
    if (item.action === "reservation") openReservationDialog?.();
    if (item.action === "competition") document.querySelector('[data-testid="settings-competition-catalog"]')?.scrollIntoView({ block: "start" });
  }, 0);
}
