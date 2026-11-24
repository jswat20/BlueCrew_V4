const workspaceService = (() => {
  let workspaces = [];
  let activeWorkspace = null;

  function normalize(row = {}) {
    return {
      organizationId: row.organization_id || "",
      organizationName: row.organization_name || "Workspace",
      organizationSlug: row.organization_slug || "",
      timezone: row.organization_timezone || "America/New_York",
      membershipId: row.membership_id || "",
      profileId: row.profile_id || "",
      status: row.membership_status || "",
      role: row.role_code || "",
      enabledModules: Array.isArray(row.enabled_modules) ? [...row.enabled_modules] : [],
      active: Boolean(row.is_active)
    };
  }

  async function loadAuthorized() {
    const result = await supabaseSharedRepository.getAuthorizedWorkspaces();
    if (result.error) return { success: false, message: result.error.message, data: [] };
    workspaces = (result.data || []).map(normalize);
    activeWorkspace = workspaces.find(item => item.active) || null;
    return { success: true, message: "Workspace access loaded.", data: snapshot() };
  }

  async function ensureActive() {
    const loaded = await loadAuthorized();
    if (!loaded.success) return loaded;
    if (activeWorkspace) return { success: true, ready: true, data: snapshot() };
    if (workspaces.length === 1) return select(workspaces[0].organizationId);
    return {
      success: true,
      ready: false,
      selectionRequired: workspaces.length > 1,
      onboardingRequired: workspaces.length === 0,
      message: workspaces.length ? "Choose a workspace to continue." : "No approved workspace membership was found.",
      data: snapshot()
    };
  }

  async function createCustomerWorkspace(input) {
    const result = await supabaseSharedRepository.createCustomerWorkspace(input);
    if (result.error) return { success: false, message: friendlyOnboardingError(result.error.message), data: null };
    const loaded = await loadAuthorized();
    if (!loaded.success) return loaded;
    return { success: true, ready: true, message: "Workspace created.", data: result.data };
  }

  async function enableModule(moduleCode) {
    const result = await supabaseSharedRepository.enableWorkspaceModule(moduleCode);
    if (result.error) return { success: false, message: friendlyOnboardingError(result.error.message), data: null };
    await loadAuthorized();
    return { success: true, message: "Module enabled.", data: result.data };
  }

  function friendlyOnboardingError(message = "") {
    const messages = {
      verified_email_required: "Verify your email before creating a workspace.",
      workspace_identity_invalid: "Enter a valid workspace name and URL name.",
      workspace_timezone_invalid: "Select a valid timezone.",
      workspace_modules_invalid: "Select at least one valid module.",
      workspace_slug_unavailable: "That workspace URL name is already in use.",
      workspace_creation_limit_reached: "This account has reached its workspace creation limit.",
      workspace_creation_rate_limited: "Too many workspaces were created recently. Try again later.",
      workspace_administrator_required: "Only a workspace administrator can enable modules."
    };
    return messages[message] || message || "Workspace onboarding failed.";
  }

  async function select(organizationId) {
    const requested = workspaces.find(item => String(item.organizationId) === String(organizationId));
    if (!requested) return { success: false, message: "Workspace access is not authorized.", data: snapshot() };
    const result = await supabaseSharedRepository.selectActiveWorkspace(requested.organizationId);
    if (result.error) return { success: false, message: result.error.message, data: snapshot() };
    workspaces = workspaces.map(item => ({ ...item, active: item.organizationId === requested.organizationId }));
    activeWorkspace = workspaces.find(item => item.active) || null;
    return { success: true, ready: true, message: "Workspace selected.", profile: result.data, data: snapshot() };
  }

  async function clearServerSelection() {
    const result = await supabaseSharedRepository.clearActiveWorkspace();
    clear();
    return result;
  }

  function clear() {
    workspaces = [];
    activeWorkspace = null;
    renderWorkspaceSwitcher?.();
  }

  function snapshot() {
    return { workspaces: workspaces.map(item => ({ ...item, enabledModules: [...item.enabledModules] })), activeWorkspace: activeWorkspace ? { ...activeWorkspace, enabledModules: [...activeWorkspace.enabledModules] } : null };
  }

  function hasModule(moduleCode) {
    return Boolean(activeWorkspace?.enabledModules.includes(moduleCode));
  }

  return { loadAuthorized, ensureActive, select, createCustomerWorkspace, enableModule, clearServerSelection, clear, snapshot, hasModule };
})();
