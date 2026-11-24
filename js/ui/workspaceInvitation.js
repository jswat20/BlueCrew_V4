function renderWorkspaceInvitation() {
  return `<section class="panel workspace-launcher" data-testid="workspace-invitation-page">
    <h2>Workspace invitation</h2>
    <div data-testid="workspace-invitation-preview" aria-live="polite"><p>Verifying your invitation…</p></div>
    <div class="form-actions">
      <button type="button" class="button button-primary" data-testid="workspace-invitation-accept" disabled>Accept invitation</button>
      <button type="button" class="button button-secondary" data-testid="workspace-invitation-dismiss">Not now</button>
      <button type="button" class="button button-link" data-testid="workspace-invitation-logout">Log out</button>
    </div>
    <p role="alert" data-testid="workspace-invitation-error"></p>
  </section>`;
}

async function setupWorkspaceInvitation() {
  const preview = document.querySelector("[data-testid='workspace-invitation-preview']");
  const accept = document.querySelector("[data-testid='workspace-invitation-accept']");
  const error = document.querySelector("[data-testid='workspace-invitation-error']");
  const result = await workspaceInvitationService.preview();
  if (!result.success) {
    preview.innerHTML = `<p>${escapeWorkspaceHtml(result.message)}</p>`;
    error.textContent = result.message;
  } else {
    const role = String(result.data.role || "member").replaceAll("_"," ");
    const expiry = new Date(result.data.expires_at).toLocaleString();
    preview.innerHTML = `<h3>${escapeWorkspaceHtml(result.data.organization_name)}</h3><p>You were invited as <strong>${escapeWorkspaceHtml(role)}</strong>.</p><p>Expires ${escapeWorkspaceHtml(expiry)}.</p>`;
    accept.disabled = false;
  }
  accept.addEventListener("click", acceptWorkspaceInvitationFromUi);
  document.querySelector("[data-testid='workspace-invitation-dismiss']")?.addEventListener("click", dismissWorkspaceInvitation);
  document.querySelector("[data-testid='workspace-invitation-logout']")?.addEventListener("click", logoutFromNavigation);
}

async function acceptWorkspaceInvitationFromUi(event) {
  const button = event.currentTarget;
  const error = document.querySelector("[data-testid='workspace-invitation-error']");
  button.disabled = true;
  error.textContent = "";
  const result = await workspaceInvitationService.accept();
  if (!result.success) { error.textContent = result.message; button.disabled = false; return; }
  const restored = await supabaseAuthService.restoreSession();
  if (!restored.success || !restored.data?.role) { error.textContent = restored.message || "Membership was created but could not be opened."; return; }
  refreshNavigationAuthorization?.();
  window.history.replaceState({ blueCrewPage:"dashboard",context:{} },"",window.location.href);
  renderPage("dashboard");
  toastService?.success?.("Workspace invitation accepted.");
}

async function dismissWorkspaceInvitation() {
  workspaceInvitationService.clearPending();
  const restored = await supabaseAuthService.restoreSession();
  if (restored.data?.workspaceSelection) return renderPage("workspace-selection");
  if (restored.data?.workspaceOnboarding) return renderPage("workspace-onboarding");
  renderPage(restored.success && restored.data?.role ? "dashboard" : "login");
}
