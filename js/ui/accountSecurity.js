let passwordRecoveryMessage = "";

function renderForgotPassword() {
  return `<section class="panel account-security-page" data-testid="forgot-password-page"><h2>Forgot Password</h2><p>Enter your login email to request a reset link.</p><form data-testid="forgot-password-form" onsubmit="handleForgotPassword(event)"><label for="forgot-password-email">Email</label><input id="forgot-password-email" data-testid="forgot-password-email" type="email" autocomplete="email" required><div class="form-actions"><button class="button button-primary" data-testid="forgot-password-submit" type="submit">Send Reset Link</button><button class="button button-secondary" type="button" onclick="renderPage('login')">Return to Login</button></div></form><div class="form-message" data-testid="forgot-password-message" role="status" aria-live="polite"></div></section>`;
}
async function handleForgotPassword(event) {
  event.preventDefault();
  const button = event.currentTarget.querySelector("[data-testid='forgot-password-submit']");
  const message = document.querySelector("[data-testid='forgot-password-message']");
  button.disabled = true; button.textContent = "Sending...";
  const response = await passwordSecurityService.requestReset(document.querySelector("[data-testid='forgot-password-email']").value);
  message.textContent = response.message; message.className = response.success ? "success-message" : "validation-message";
  button.disabled = false; button.textContent = "Send Reset Link";
}
function renderPasswordRecovery() {
  return `<section class="panel account-security-page" data-testid="password-recovery-page"><h2>Set New Password</h2><p>Create a new password with at least 12 characters.</p><form data-testid="password-recovery-form" onsubmit="handlePasswordRecovery(event)"><label for="recovery-new-password">New Password</label><input id="recovery-new-password" data-testid="recovery-new-password" type="password" autocomplete="new-password" required minlength="12"><label for="recovery-confirm-password">Confirm New Password</label><input id="recovery-confirm-password" data-testid="recovery-confirm-password" type="password" autocomplete="new-password" required minlength="12"><div class="form-actions"><button class="button button-primary" data-testid="recovery-submit" type="submit">Set Password</button><button class="button button-secondary" type="button" onclick="cancelPasswordRecovery()">Cancel</button></div></form><div class="form-message" data-testid="password-recovery-message" role="status" aria-live="polite">${escapeSharedStateHtml(passwordRecoveryMessage)}</div></section>`;
}
async function handlePasswordRecovery(event) {
  event.preventDefault();
  const response = await passwordSecurityService.completeRecovery(document.querySelector("[data-testid='recovery-new-password']").value, document.querySelector("[data-testid='recovery-confirm-password']").value);
  if (!response.success) { const message = document.querySelector("[data-testid='password-recovery-message']"); message.textContent = response.message; message.className = "validation-message"; return; }
  passwordRecoveryMessage = response.message; window.history.replaceState({ blueCrewPage: "login", context: {} }, "", passwordSecurityService.recoveryRedirectUrl()); renderPage("login", { passwordMessage: response.message });
}
async function cancelPasswordRecovery() { await loginService.logoutAuthenticated(); supabaseAuthService.clearRecoveryState(); window.history.replaceState({ blueCrewPage: "login", context: {} }, "", passwordSecurityService.recoveryRedirectUrl()); renderPage("login"); }

function openChangePasswordDialog() {
  let dialog = document.querySelector("[data-testid='change-password-dialog']");
  if (!dialog) { dialog = document.createElement("dialog"); dialog.className = "account-security-dialog"; dialog.dataset.testid = "change-password-dialog"; document.body.appendChild(dialog); }
  dialog.innerHTML = `<form method="dialog" onsubmit="handleChangePassword(event)"><h2>Change Password</h2><label>Current Password<input data-testid="current-password" type="password" autocomplete="current-password" required></label><label>New Password<input data-testid="change-new-password" type="password" autocomplete="new-password" minlength="12" required></label><label>Confirm New Password<input data-testid="change-confirm-password" type="password" autocomplete="new-password" minlength="12" required></label><div data-testid="change-password-message" class="form-message" role="alert"></div><div class="form-actions"><button class="button button-secondary" type="button" onclick="this.closest('dialog').close()">Cancel</button><button class="button button-primary" data-testid="change-password-submit" type="submit">Change Password</button></div></form>`;
  dialog.showModal(); dialog.querySelector("input")?.focus();
}
async function handleChangePassword(event) {
  event.preventDefault(); const form = event.currentTarget; const button = form.querySelector("[data-testid='change-password-submit']"); button.disabled = true;
  const response = await passwordSecurityService.changePassword(form.querySelector("[data-testid='current-password']").value, form.querySelector("[data-testid='change-new-password']").value, form.querySelector("[data-testid='change-confirm-password']").value);
  if (!response.success) { form.querySelector("[data-testid='change-password-message']").textContent = response.message; button.disabled = false; return; }
  form.closest("dialog").close(); window.history.replaceState({ blueCrewPage: "login", context: {} }, "", window.location.href); renderPage("login", { passwordMessage: response.message });
}
async function sendAdministrativePasswordReset(profileId, crewMemberId = "") { const response = await passwordSecurityService.requestAdministrativeReset(profileId, crewMemberId); toastService?.show?.(response.message); return response; }
