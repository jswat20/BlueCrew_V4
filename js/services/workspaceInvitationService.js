const workspaceInvitationService = (() => {
  const pendingTokenKey = "slate_workspace_invitation_token";
  let invitations = [];
  let latestIssuedLink = "";
  let loadError = "";

  function captureFromLocation() {
    const match = String(window.location.hash || "").match(/^#invite=([a-f0-9]{64})$/i);
    if (!match) return false;
    window.sessionStorage.setItem(pendingTokenKey, match[1]);
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
    return true;
  }

  function pendingToken() { return window.sessionStorage.getItem(pendingTokenKey) || ""; }
  function hasPending() { return /^[a-f0-9]{64}$/i.test(pendingToken()); }
  function clearPending() { window.sessionStorage.removeItem(pendingTokenKey); }

  function friendly(message = "") {
    const map = {
      invitation_email_invalid: "Enter a valid recipient email address.",
      invitation_expiration_invalid: "Invitation expiration must be between 1 and 168 hours.",
      invitation_role_not_enabled: "That role is not available for the workspace's enabled modules.",
      invitation_self_forbidden: "You cannot invite your own account.",
      invitation_membership_exists: "That account already has a membership in this workspace.",
      invitation_pending_exists: "A pending invitation already exists for that recipient.",
      invitation_rate_limited: "Invitation creation is temporarily rate limited.",
      invitation_not_found: "The invitation was not found in this workspace.",
      invitation_already_accepted: "This invitation has already been accepted.",
      invitation_revoked: "This invitation has been revoked.",
      invitation_expired: "This invitation has expired.",
      invitation_invalid: "This invitation is invalid.",
      invitation_recipient_mismatch: "Sign in with the verified email address that received this invitation.",
      invitation_workspace_unavailable: "The invited workspace is unavailable.",
      verified_email_required: "Verify your email before accepting this invitation.",
      workspace_administrator_required: "Only a workspace administrator can manage invitations."
    };
    return map[message] || message || "The invitation operation failed.";
  }

  async function load() {
    const result = await supabaseSharedRepository.getWorkspaceInvitations();
    loadError = result.error?.message || "";
    invitations = result.error ? [] : (result.data || []);
    return result.error ? { success:false,message:friendly(result.error.message) } : { success:true,data:snapshot() };
  }

  async function issue(input) {
    latestIssuedLink = "";
    const result = await supabaseSharedRepository.issueWorkspaceInvitation(input);
    if (result.error) return { success:false,message:friendly(result.error.message) };
    latestIssuedLink = `${window.location.origin}${window.location.pathname}#invite=${result.data.token}`;
    await load();
    return { success:true,message:"Invitation created.",data:{ invitationId:result.data.invitation_id,link:latestIssuedLink,expiresAt:result.data.expires_at } };
  }

  async function revoke(invitationId) {
    latestIssuedLink = "";
    const result = await supabaseSharedRepository.revokeWorkspaceInvitation(invitationId);
    if (result.error) return { success:false,message:friendly(result.error.message) };
    await load();
    return { success:true,message:"Invitation revoked." };
  }

  async function regenerate(invitationId, expiresInHours = 72) {
    latestIssuedLink = "";
    const result = await supabaseSharedRepository.regenerateWorkspaceInvitation(invitationId,expiresInHours);
    if (result.error) return { success:false,message:friendly(result.error.message) };
    latestIssuedLink = `${window.location.origin}${window.location.pathname}#invite=${result.data.token}`;
    await load();
    return { success:true,message:"Invitation link regenerated.",data:{ invitationId:result.data.invitation_id,link:latestIssuedLink,expiresAt:result.data.expires_at } };
  }

  async function preview() {
    if (!hasPending()) return { success:false,message:"No invitation link is available." };
    const result = await supabaseSharedRepository.previewWorkspaceInvitation(pendingToken());
    if (result.error) return { success:false,message:friendly(result.error.message) };
    if (!result.data?.valid) return { success:false,message:friendly(result.data?.code),data:result.data };
    return { success:true,data:result.data };
  }

  async function accept() {
    if (!hasPending()) return { success:false,message:"No invitation link is available." };
    const result = await supabaseSharedRepository.acceptWorkspaceInvitation(pendingToken());
    if (result.error) return { success:false,message:friendly(result.error.message) };
    if (!result.data?.accepted) return { success:false,message:friendly(result.data?.code),data:result.data };
    clearPending();
    return { success:true,message:"Workspace invitation accepted.",data:result.data };
  }

  function clearIssuedSecret() { latestIssuedLink = ""; }
  function snapshot() { return { invitations:invitations.map(row=>({...row})),latestIssuedLink,loadError }; }

  captureFromLocation();
  return { captureFromLocation,pendingToken,hasPending,clearPending,load,issue,revoke,regenerate,preview,accept,clearIssuedSecret,snapshot,friendly };
})();
