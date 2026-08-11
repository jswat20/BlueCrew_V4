const passwordSecurityService = (() => {
  const MINIMUM_PASSWORD_LENGTH = 12;
  const GENERIC_RESET_MESSAGE = "If an account exists for that email, a password reset link has been sent.";

  function result(success, message, data = null) { return { success, message, data }; }
  function validate(newPassword, confirmation) {
    if (!newPassword) return result(false, "Enter a new password.");
    if (newPassword.length < MINIMUM_PASSWORD_LENGTH) return result(false, `Password must be at least ${MINIMUM_PASSWORD_LENGTH} characters.`);
    if (newPassword !== confirmation) return result(false, "New password and confirmation must match.");
    return result(true, "Password is valid.");
  }
  function recoveryRedirectUrl() {
    const url = new URL(window.location.href);
    url.hash = "";
    url.search = "";
    return url.toString();
  }
  async function requestReset(email) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail) return result(false, "Enter your email address.");
    try {
      const client = await supabaseClientService.getClient();
      const { error } = await client.auth.resetPasswordForEmail(normalizedEmail, { redirectTo: recoveryRedirectUrl() });
      if (error && (!error.status || error.status >= 500)) return result(false, "The reset request could not be sent. Try again.");
      return result(true, GENERIC_RESET_MESSAGE);
    } catch (_) {
      return result(false, "The reset request could not be sent. Try again.");
    }
  }
  async function completeRecovery(newPassword, confirmation) {
    const validation = validate(newPassword, confirmation);
    if (!validation.success) return validation;
    const client = await supabaseClientService.getClient();
    const { error } = await client.auth.updateUser({ password: newPassword });
    if (error) return result(false, error.message || "Password could not be updated.");
    await client.auth.signOut();
    supabaseAuthService.clearRecoveryState();
    return result(true, "Password updated successfully. Log in with your new password.");
  }
  async function changePassword(currentPassword, newPassword, confirmation) {
    if (!currentPassword) return result(false, "Enter your current password.");
    const validation = validate(newPassword, confirmation);
    if (!validation.success) return validation;
    const account = loginService.getCurrentAccount();
    if (!account?.email) return result(false, "Your login email is unavailable.");
    const client = await supabaseClientService.getClient();
    const { error: signInError } = await client.auth.signInWithPassword({ email: account.email, password: currentPassword });
    if (signInError) return result(false, "Current password is incorrect.");
    const { error } = await client.auth.updateUser({ password: newPassword });
    if (error) return result(false, error.message || "Password could not be changed.");
    await supabaseAuthService.logout();
    return result(true, "Password changed successfully. Log in with your new password.");
  }
  async function requestAdministrativeReset(profileId, crewMemberId = "") {
    const actor = loginService.getCurrentAccount();
    if (actor?.role !== "administrator") return result(false, "Administrator access is required.");
    if (!profileId && !crewMemberId) return result(false, "Account not found.");
    try {
      const client = await supabaseClientService.getClient();
      const body = { redirectTo: recoveryRedirectUrl() };
      if (profileId) body.profileId = String(profileId);
      else body.crewMemberId = String(crewMemberId);
      const { data, error } = await client.functions.invoke("send-account-password-reset", { body });
      if (error) return result(false, error.message || "Password reset could not be sent.");
      return result(true, data?.message || GENERIC_RESET_MESSAGE);
    } catch (_) { return result(false, "Password reset could not be sent."); }
  }
  return Object.freeze({ MINIMUM_PASSWORD_LENGTH, GENERIC_RESET_MESSAGE, validate, recoveryRedirectUrl, requestReset, completeRecovery, changePassword, requestAdministrativeReset });
})();
