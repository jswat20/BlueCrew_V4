const supabaseAuthService = (() => {
  let currentAccount = null;
  let authSubscription = null;
  let hydrationState = { status: "idle", message: "" };

  function mutationResult(success, message, data = null) {
    return { success, message, data };
  }

  function mapProfile(profile, crewId = null) {
    return sharedDomainMappingService.mapProfile(profile, crewId);
  }

  async function loadAccountForUser(user) {
    if (!user?.id) return null;
    hydrationState = { status: "loading", message: "" };
    const profile = await accountService.loadAuthenticatedProfile(user);
    if (!profile) throw new Error("Account profile was not found.");
    if (profile.status !== "approved") {
      crewService?.clearAllSharedCrew?.();
      availabilityService?.clearAuthenticatedAvailability?.();
      notificationService?.clearAuthenticatedNotifications?.();
      clearSchedulingState();
      hydrationState = { status: "ready", message: "" };
      return profile;
    }
    const { data: organization, error: organizationError } = await supabaseSharedRepository.getCurrentOrganization(profile.organizationId);
    if (organizationError) throw organizationError;
    levelTerminologyService.configure(organization?.settings || {});
    organizationContactService.configure(organization?.settings || {}, organization || {});
    const crewMember = await crewService.loadAuthenticatedCrewMember(profile.id);
    accountService.setAuthenticatedCrewId(crewMember?.id || null);
    if (profile.role === "umpire" && !crewMember) throw new Error("Approved umpire has no linked crew member.");
    if (crewMember) await availabilityService.loadAuthenticatedAvailability(crewMember.id);
    if (profile.role === "administrator") {
      await Promise.all([
        accountService.loadPendingAuthenticatedAccounts(),
        crewService.loadAdministrativeCrew()
      ]);
    }
    await notificationService?.hydrateAuthenticatedNotifications?.();
    if (["administrator", "assigner"].includes(profile.role)) {
      try { await activityService?.hydrateAuthenticatedActivities?.(); }
      catch (_) { activityService?.clearAuthenticatedActivities?.(); }
    } else activityService?.clearAuthenticatedActivities?.();
    try {
      const preparedLocations = await locationService.prepareSharedLocations();
      const preparedSchedule = await gameService.prepareSharedGames(preparedLocations);
      locationService.publishSharedLocations(preparedLocations);
      crewService.publishReferencedCrewMembers(preparedSchedule.referencedCrew);
      gameService.publishSharedGames(preparedSchedule);
    } catch (error) {
      clearSchedulingState();
      const account = accountService.getAuthenticatedProfile();
      applyIdentity(account);
      const hydrationError = error instanceof Error
        ? error
        : new Error(error?.message || "Shared schedule data could not be loaded.");
      hydrationState = { status: "error", message: hydrationError.message, authenticated: true };
      hydrationError.isSchedulingHydrationError = true;
      hydrationError.account = account;
      throw hydrationError;
    }
    hydrationState = { status: "ready", message: "" };
    return accountService.getAuthenticatedProfile();
  }

  function clearSharedState() {
    levelTerminologyService?.clear?.();
    organizationContactService?.clear?.();
    accountService?.clearAuthenticatedProfile?.();
    crewService?.clearAllSharedCrew?.();
    availabilityService?.clearAuthenticatedAvailability?.();
    notificationService?.clearAuthenticatedNotifications?.();
    activityService?.clearAuthenticatedActivities?.();
    clearSchedulingState();
    if (typeof uiStateService !== "undefined") uiStateService.clearSelections?.();
  }

  function clearSchedulingState() {
    crewService?.clearReferencedCrewMembers?.();
    locationService?.clearSharedLocations?.();
    gameService?.clearSharedGames?.();
  }

  async function refreshScheduling() {
    try {
      const preparedLocations = await locationService.prepareSharedLocations();
      const preparedSchedule = await gameService.prepareSharedGames(preparedLocations);
      locationService.publishSharedLocations(preparedLocations);
      crewService.publishReferencedCrewMembers(preparedSchedule.referencedCrew);
      gameService.publishSharedGames(preparedSchedule);
      hydrationState = { status: "ready", message: "" };
      return mutationResult(true, "Schedule refreshed.");
    } catch (error) {
      clearSchedulingState();
      hydrationState = { status: "error", message: error?.message || "Shared schedule data could not be loaded.", authenticated: true };
      return mutationResult(false, hydrationState.message);
    }
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

  function refreshAuthenticatedAccount(account) {
    return applyIdentity(account);
  }

  function failHydration(error) {
    clearSharedState();
    applyIdentity(null);
    authenticatedIdentityService?.updateDocumentTitle?.(null);
    hydrationState = { status: "error", message: error?.message || "Shared account data could not be loaded." };
  }

  async function restoreSession() {
    const client = await supabaseClientService.getClient();
    const { data, error } = await client.auth.getSession();
    if (error) return mutationResult(false, error.message);
    if (!data.session?.user) {
      clearSharedState();
      hydrationState = { status: "idle", message: "" };
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
      if (error.isSchedulingHydrationError) {
        return mutationResult(false, error.message || "Could not load shared schedule data.", error.account);
      }
      failHydration(error);
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
      if (loadError.isSchedulingHydrationError) {
        return mutationResult(false, loadError.message || "Could not load shared schedule data.", loadError.account);
      }
      await client.auth.signOut();
      failHydration(loadError);
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
    clearSharedState();
    applyIdentity(null);
    hydrationState = { status: "idle", message: "" };
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
          clearSharedState();
          applyIdentity(null);
          hydrationState = { status: "idle", message: "" };
          return;
        }
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
          try {
            const account = await loadAccountForUser(session.user);
            if (account?.status === "approved") applyIdentity(account);
          } catch (error) {
            if (!error.isSchedulingHydrationError) failHydration(error);
          }
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
    clearSharedState();
    hydrationState = { status: "idle", message: "" };
  }

  return {
    login,
    logout,
    restoreSession,
    startSessionListener,
    signUpAndProvision,
    refreshScheduling,
    completeVerifiedRegistration,
    loadAccountForUser,
    getCurrentAccount,
    getCurrentSession,
    getHydrationState: () => ({ ...hydrationState }),
    refreshAuthenticatedAccount,
    clearForTests
  };
})();
