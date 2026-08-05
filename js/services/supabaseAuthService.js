const supabaseAuthService = (() => {
  let currentAccount = null;
  let authSubscription = null;

  function mutationResult(success, message, data = null) {
    return { success, message, data };
  }

  function mapProfile(profile, crewId = null) {
    if (!profile) return null;
    return {
      id: profile.id,
      authUserId: profile.auth_user_id,
      organizationId: profile.organization_id,
      firstName: profile.first_name || "",
      lastName: profile.last_name || "",
      email: profile.email || "",
      phone: profile.phone || "",
      homePhone: profile.home_phone || "",
      address: profile.address || "",
      contactPreference: profile.contact_preference || "text",
      birthdate: profile.birthdate || "",
      emergencyContact: profile.emergency_contact || "",
      emergencyContactPhone: profile.emergency_contact_phone || "",
      officialHistory: profile.official_history || [],
      yearsOfServiceOverride: profile.years_of_service_override ?? null,
      adminNotes: profile.admin_notes || "",
      communicationPreferences: profile.communication_preferences || {},
      role: profile.role,
      status: profile.status,
      crewId,
      crewCode: profile.crew_code || "",
      crewCodeIssuedAt: profile.crew_code_issued_at || null,
      approvedAt: profile.approved_at || null,
      rejectedAt: profile.rejected_at || null,
      lastLogin: profile.last_login_at || null,
      createdAt: profile.created_at
    };
  }

  async function loadAccountForUser(user) {
    if (!user?.id) return null;
    const client = await supabaseClientService.getClient();
    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("*")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) return null;

    const { data: crewMember, error: crewError } = await client
      .from("crew_members")
      .select("id")
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (crewError) throw crewError;
    return mapProfile(profile, crewMember?.id || null);
  }

  function applyIdentity(account) {
    currentAccount = account;
    if (account && typeof authService !== "undefined") {
      authService.useAuthenticatedAccount(account);
    } else if (typeof authService !== "undefined" && authService.clearAuthenticatedAccount) {
      authService.clearAuthenticatedAccount();
    }
    return account;
  }

  async function restoreSession() {
    const client = await supabaseClientService.getClient();
    const { data, error } = await client.auth.getSession();
    if (error) return mutationResult(false, error.message);
    if (!data.session?.user) {
      applyIdentity(null);
      return mutationResult(true, "No active session.");
    }

    try {
      const account = await loadAccountForUser(data.session.user);
      if (!account || account.status !== "approved") {
        applyIdentity(null);
        return mutationResult(false, "Account not found or awaiting approval.", account);
      }
      applyIdentity(account);
      return mutationResult(true, "Session restored.", account);
    } catch (error) {
      applyIdentity(null);
      return mutationResult(false, error.message || "Could not restore the session.");
    }
  }

  async function login(email, password) {
    const client = await supabaseClientService.getClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) return mutationResult(false, error.message);

    try {
      const account = await loadAccountForUser(data.user);
      if (!account || account.status !== "approved") {
        await client.auth.signOut();
        applyIdentity(null);
        return mutationResult(false, "Account not found or awaiting approval.");
      }
      applyIdentity(account);
      return mutationResult(true, "Login successful.", account);
    } catch (loadError) {
      await client.auth.signOut();
      applyIdentity(null);
      return mutationResult(false, loadError.message || "Could not load the account profile.");
    }
  }

  async function signUpAndProvision({ email, password, invitationCode, firstName, lastName, phone = "" }) {
    const client = await supabaseClientService.getClient();
    const { data: existingSessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) return mutationResult(false, sessionError.message);

    if (existingSessionData.session?.user) {
      return completeVerifiedRegistration({ invitationCode, firstName, lastName, phone });
    }

    const { data, error } = await client.auth.signUp({ email, password });
    if (error) return mutationResult(false, error.message);

    if (!data.session) {
      return mutationResult(
        true,
        "Check your email to verify the account, then return to complete registration.",
        { verificationRequired: true }
      );
    }

    const { data: profile, error: provisionError } = await client.rpc(
      "provision_pending_umpire",
      {
        p_invitation_code: invitationCode,
        p_first_name: firstName,
        p_last_name: lastName,
        p_phone: phone
      }
    );

    if (provisionError) return mutationResult(false, provisionError.message);
    await client.auth.signOut();
    applyIdentity(null);
    return mutationResult(true, "Account created and pending approval.", mapProfile(profile));
  }

  async function completeVerifiedRegistration({ invitationCode, firstName, lastName, phone = "" }) {
    const client = await supabaseClientService.getClient();
    const { data: profile, error } = await client.rpc("provision_pending_umpire", {
      p_invitation_code: invitationCode,
      p_first_name: firstName,
      p_last_name: lastName,
      p_phone: phone
    });
    if (error) return mutationResult(false, error.message);
    await client.auth.signOut();
    applyIdentity(null);
    return mutationResult(true, "Account created and pending approval.", mapProfile(profile));
  }

  async function logout() {
    const client = await supabaseClientService.getClient();
    const { error } = await client.auth.signOut();
    applyIdentity(null);
    return error
      ? mutationResult(false, error.message)
      : mutationResult(true, "Logged out.");
  }

  async function startSessionListener() {
    if (authSubscription) return;
    const client = await supabaseClientService.getClient();
    const { data } = client.auth.onAuthStateChange((event, session) => {
      setTimeout(async () => {
        if (event === "SIGNED_OUT" || !session?.user) {
          applyIdentity(null);
          return;
        }
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
          const account = await loadAccountForUser(session.user);
          if (account?.status === "approved") applyIdentity(account);
        }
      }, 0);
    });
    authSubscription = data.subscription;
  }

  function getCurrentAccount() {
    return currentAccount;
  }

  function getCurrentSession() {
    if (!currentAccount) return null;
    return {
      accountId: currentAccount.id,
      authUserId: currentAccount.authUserId,
      role: currentAccount.role,
      organizationId: currentAccount.organizationId,
      crewId: currentAccount.crewId || null
    };
  }

  function clearForTests() {
    authSubscription?.unsubscribe?.();
    authSubscription = null;
    currentAccount = null;
  }

  return {
    login,
    logout,
    restoreSession,
    startSessionListener,
    signUpAndProvision,
    completeVerifiedRegistration,
    loadAccountForUser,
    getCurrentAccount,
    getCurrentSession,
    clearForTests
  };
})();
