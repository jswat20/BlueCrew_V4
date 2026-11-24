function escapeWorkspaceHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function workspaceModuleLabel(moduleCode) {
  return moduleCode === "league" ? "League" : moduleCode === "tournament" ? "Tournament" : moduleCode === "facility" ? "Facilities" : "Officials";
}

const slateWorkspaceModules = [
  ["league", "League Management"],
  ["umpire", "Officials Management"],
  ["tournament", "Tournament Management"],
  ["facility", "Facility Scheduling"]
];

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
    ${loginService.getCurrentAccount()?.role === "administrator" && slateWorkspaceModules.some(([code]) => !active.enabledModules.includes(code))
      ? `<details class="workspace-module-adder"><summary>Add module</summary><form data-testid="workspace-module-form"><select name="module" aria-label="Module to enable">${slateWorkspaceModules.filter(([code]) => !active.enabledModules.includes(code)).map(([code,label]) => `<option value="${code}">${label}</option>`).join("")}</select><button type="submit" class="button button-secondary">Enable</button><span role="status" data-module-message></span></form></details>`
      : ""}
  </div>`;
  host.querySelector("[data-testid='workspace-switcher-select']")?.addEventListener("change", event => switchWorkspaceFromUi(event.target.value));
  host.querySelector("[data-testid='workspace-module-form']")?.addEventListener("submit", enableWorkspaceModuleFromUi);
}

function renderWorkspaceOnboarding() {
  return `<section class="panel workspace-launcher" data-testid="workspace-onboarding-page">
    <h2>Create your Slate workspace</h2>
    <p>Choose the capabilities this customer workspace needs. You can add another module later.</p>
    <form data-testid="workspace-onboarding-form">
      <div class="form-group"><label>Workspace name<input name="name" required maxlength="120" autocomplete="organization"></label></div>
      <div class="form-group"><label>Workspace URL name<input name="slug" required maxlength="80" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="lake-shore-softball"></label><small>Lowercase letters, numbers, and hyphens.</small></div>
      <div class="form-group"><label>Timezone<select name="timezone"><option value="America/New_York">Eastern Time</option><option value="America/Chicago">Central Time</option><option value="America/Denver">Mountain Time</option><option value="America/Los_Angeles">Pacific Time</option></select></label></div>
      <fieldset><legend>Modules</legend>${slateWorkspaceModules.map(([code,label],index) => `<label><input type="checkbox" name="modules" value="${code}" ${index===0?"checked":""}> ${label}</label>`).join("")}</fieldset>
      <button type="submit" class="button button-primary" data-testid="workspace-onboarding-submit">Create workspace</button>
      <button type="button" class="button button-link" data-testid="workspace-onboarding-logout">Log out</button>
      <p role="alert" data-testid="workspace-onboarding-error"></p>
    </form>
  </section>`;
}

function setupWorkspaceOnboarding() {
  const form = document.querySelector("[data-testid='workspace-onboarding-form']");
  const name = form?.elements?.name;
  const slug = form?.elements?.slug;
  name?.addEventListener("input", () => {
    if (slug.dataset.edited === "true") return;
    slug.value = name.value.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
  });
  slug?.addEventListener("input", () => { slug.dataset.edited = "true"; });
  form?.addEventListener("submit", createWorkspaceFromUi);
  document.querySelector("[data-testid='workspace-onboarding-logout']")?.addEventListener("click", logoutFromNavigation);
}

async function createWorkspaceFromUi(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector("[data-testid='workspace-onboarding-submit']");
  const error = form.querySelector("[data-testid='workspace-onboarding-error']");
  const enabledModules = [...form.querySelectorAll("input[name='modules']:checked")].map(input => input.value);
  submit.disabled = true;
  error.textContent = "";
  const result = await workspaceService.createCustomerWorkspace({
    name: form.elements.name.value.trim(), slug: form.elements.slug.value.trim(),
    timezone: form.elements.timezone.value, enabledModules
  });
  submit.disabled = false;
  if (!result.success) { error.textContent = result.message; return; }
  const restored = await supabaseAuthService.restoreSession();
  if (!restored.success || !restored.data?.role) { error.textContent = restored.message || "Workspace created, but the session could not be opened."; return; }
  refreshNavigationAuthorization?.();
  window.history.replaceState({ blueCrewPage: "dashboard", context: {} }, "", window.location.href);
  renderPage("dashboard");
  toastService?.success?.("Workspace created. You are its administrator.");
}

async function enableWorkspaceModuleFromUi(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = form.querySelector("[data-module-message]");
  const result = await workspaceService.enableModule(form.elements.module.value);
  if (!result.success) { message.textContent = result.message; return; }
  await supabaseAuthService.restoreSession();
  renderWorkspaceSwitcher();
  refreshNavigationAuthorization?.();
  toastService?.success?.("Module enabled.");
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
  const previousPage = document.body.dataset.page || "dashboard";
  // Fail closed while the server validates the new tenant and the client
  // replaces every workspace-scoped snapshot. The previous page must not
  // remain visible during that asynchronous boundary.
  renderSessionRestoringState?.();
  const result = await supabaseAuthService.switchWorkspace(organizationId);
  if (!result.success) {
    renderPage(previousPage === "session-restoring" ? "dashboard" : previousPage);
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
