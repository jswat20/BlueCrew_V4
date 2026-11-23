function escapeWorkspaceHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function workspaceModuleLabel(moduleCode) {
  return moduleCode === "league" ? "League" : moduleCode === "tournament" ? "Tournament" : moduleCode === "facility" ? "Facilities" : "Officials";
}

function renderWorkspaceSwitcher() {
  const host = document.querySelector("[data-testid='workspace-switcher-host']");
  if (!host || typeof workspaceService === "undefined") return;
  const state = workspaceService.snapshot();
  const active = state.activeWorkspace;
  if (!active || !loginService?.isLoggedIn?.()) { host.innerHTML = ""; host.hidden = true; return; }
  host.hidden = false;
  host.innerHTML = `<div class="workspace-switcher" data-testid="workspace-switcher">
    <span class="workspace-switcher-label">Active workspace</span>
    ${state.workspaces.length > 1
      ? `<select data-testid="workspace-switcher-select" aria-label="Active workspace">${state.workspaces.map(item => `<option value="${escapeWorkspaceHtml(item.organizationId)}" ${item.active ? "selected" : ""}>${escapeWorkspaceHtml(item.organizationName)}</option>`).join("")}</select>`
      : `<strong data-testid="active-workspace-name">${escapeWorkspaceHtml(active.organizationName)}</strong>`}
    <span class="workspace-switcher-modules" data-testid="active-workspace-modules">${active.enabledModules.map(workspaceModuleLabel).join(" · ")}</span>
  </div>`;
  host.querySelector("[data-testid='workspace-switcher-select']")?.addEventListener("change", event => switchWorkspaceFromUi(event.target.value));
}

function renderWorkspaceSelection() {
  const state = workspaceService.snapshot();
  return `<section class="panel workspace-launcher" data-testid="workspace-selection-page">
    <h2>Choose a workspace</h2><p>Your role and available modules are independent in each customer workspace.</p>
    <div class="workspace-launcher-list">${state.workspaces.map(item => `<button type="button" class="button button-secondary workspace-launcher-option" data-testid="workspace-option" data-workspace-id="${escapeWorkspaceHtml(item.organizationId)}"><strong>${escapeWorkspaceHtml(item.organizationName)}</strong><span>${escapeWorkspaceHtml(item.role)}</span><small>${item.enabledModules.map(workspaceModuleLabel).join(" · ")}</small></button>`).join("")}</div>
    <p role="alert" data-testid="workspace-selection-error"></p>
  </section>`;
}

function setupWorkspaceSelection() {
  document.querySelectorAll("[data-testid='workspace-option']").forEach(button => button.addEventListener("click", () => switchWorkspaceFromUi(button.dataset.workspaceId)));
}

async function switchWorkspaceFromUi(organizationId) {
  const result = await supabaseAuthService.switchWorkspace(organizationId);
  if (!result.success) {
    const error = document.querySelector("[data-testid='workspace-selection-error']");
    if (error) error.textContent = result.message;
    toastService?.error?.(result.message);
    renderWorkspaceSwitcher();
    return result;
  }
  renderWorkspaceSwitcher();
  refreshNavigationAuthorization?.();
  window.history.replaceState({ blueCrewPage: "dashboard", context: {} }, "", window.location.href);
  renderPage("dashboard");
  toastService?.success?.(`Switched to ${workspaceService.snapshot().activeWorkspace?.organizationName || "workspace"}.`);
  return result;
}
