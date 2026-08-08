// activityService.js

const activityService = (() => {
  const STORAGE_KEY = "bluecrew_activity";
  const getRepository = () => repositoryProvider.get("activity");
  let hostedActivities = null;

  function getAll() {
    if (supabaseClientService?.isConfigured?.()) return Array.isArray(hostedActivities) ? hostedActivities : [];
    return getRepository().read() || [];
  }

  function save(items) {
    getRepository().write(items);
  }

  function log(typeOrActivity, message) {
    const items = getAll();

    const source =
      typeOrActivity &&
      typeof typeOrActivity === "object" &&
      !Array.isArray(typeOrActivity)
        ? typeOrActivity
        : {
            type: typeOrActivity,
            message
          };

    const identity = source.systemGenerated === true ? { profileId: "", role: "", name: "" } : getCurrentActorDetails();
    const activity = {
      id:
        source.id ||
        crypto.randomUUID(),

      type:
        source.type ||
        "general",

      action:
        source.action || "",

      actor:
        source.actorName || identity.name || source.actor || "",

      actorProfileId: source.actorProfileId || identity.profileId || "",

      actorRole: source.actorRole || identity.role || "",

      subject:
        source.subject || "",

      object:
        source.object ||
        source.matchup ||
        "",

      count:
        Number.isFinite(
          Number(source.count)
        )
          ? Number(source.count)
          : null,

      gameId:
        source.gameId || "",

      accountId:
        source.accountId || "",

      crewId:
        source.crewId || "",

      matchup:
        source.matchup ||
        source.object ||
        "",

      message:
        source.message || "",

      metadata:
        source.metadata &&
        typeof source.metadata ===
          "object" &&
        !Array.isArray(
          source.metadata
        )
          ? structuredClone(
              source.metadata
            )
          : {},

      createdAt:
        source.createdAt ||
        new Date().toISOString()
    };

    items.unshift(activity);

    save(items.slice(0, 50));

    return activity;
  }

  function getRecent(limit = 10) {
    return [...getAll()].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))).slice(0, limit);
  }

  function getCurrentActor() {
    if (
      typeof loginService === "undefined" ||
      typeof loginService.getCurrentAccount !==
        "function"
    ) {
      return "";
    }

    const account =
      loginService.getCurrentAccount();

    if (!account) {
      return "";
    }

    return (
      account.name ||
      `${account.firstName || ""} ${
        account.lastName || ""
      }`.trim() ||
      account.email ||
      ""
    );
  }

  function getCurrentActorDetails() {
    const account = typeof loginService !== "undefined" ? loginService.getCurrentAccount?.() : null;
    if (!account) return { profileId: "", role: "", name: "" };
    return {
      profileId: account.profileId || account.id || "",
      role: authService?.getCurrentUser?.()?.role || account.role || "",
      name: authenticatedIdentityService?.displayName?.(account) || getCurrentActor()
    };
  }

  function formatActor(activity = {}) {
    const name = String(activity.actorName || activity.actor || "").trim();
    const role = String(activity.actorRole || "").toLowerCase();
    const label = role === "administrator" || role === "admin" ? "Admin" : role === "assigner" ? "Assigner" : role === "umpire" ? "Umpire" : "";
    return name ? `${label ? `${label} - ` : ""}${name}` : "System";
  }

  async function hydrateAuthenticatedActivities() {
    if (!supabaseClientService?.isConfigured?.()) { hostedActivities = null; return getAll(); }
    const result = await supabaseSharedRepository.getRecentActivities();
    if (result.error) throw result.error;
    const profiles = new Map((result.profiles || []).map(profile => [String(profile.id), profile]));
    hostedActivities = (result.activities || []).map(row => {
      const profile = profiles.get(String(row.actor_profile_id || ""));
      return {
        id: row.id,
        type: row.type,
        action: row.action,
        actorProfileId: row.actor_profile_id || "",
        actorRole: profile?.role || row.metadata?.actorRole || "",
        actor: `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || profile?.email || row.metadata?.actorName || "",
        subject: row.subject || "",
        object: row.object || "",
        message: row.message || "",
        gameId: row.metadata?.gameId || row.related_legacy_id || "",
        accountId: row.metadata?.profileId || "",
        crewId: row.metadata?.crewMemberId || row.metadata?.crewId || "",
        matchup: row.metadata?.matchup || row.object || "",
        metadata: row.metadata || {},
        createdAt: row.created_at || ""
      };
    }).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)) || String(b.id).localeCompare(String(a.id)));
    return hostedActivities;
  }

  function clearAuthenticatedActivities() { hostedActivities = null; }

  function getCrewActor(crewId) {
    if (
      !crewId ||
      typeof crewService === "undefined" ||
      typeof crewService.getById !== "function"
    ) {
      return "";
    }

    const member =
      crewService.getById(crewId);

    return (
      member?.name ||
      `${member?.firstName || ""} ${
        member?.lastName || ""
      }`.trim() ||
      ""
    );
  }

  function getGameMatchup(game) {
    if (!game) {
      return "";
    }

    return (
      game.matchup ||
      `${game.awayTeam || "Away"} @ ${
        game.homeTeam || "Home"
      }`
    );
  }

  function getSince(
    since,
    limit = 20
  ) {
    const timestamp =
      since
        ? new Date(since).getTime()
        : Number.NaN;

    const items =
      Number.isNaN(timestamp)
        ? getAll()
        : getAll().filter(item => {
            const createdAt =
              new Date(
                item.createdAt
              ).getTime();

            return (
              !Number.isNaN(createdAt) &&
              createdAt >= timestamp
            );
          });

    return items.slice(
      0,
      Math.max(0, Number(limit) || 0)
    );
  }

  return {
    log,
    getRecent,
    getSince,
    getCurrentActor,
    getCurrentActorDetails,
    formatActor,
    hydrateAuthenticatedActivities,
    clearAuthenticatedActivities,
    getCrewActor,
    getGameMatchup
  };
})();
