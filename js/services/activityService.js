// activityService.js

const activityService = (() => {
  const STORAGE_KEY = "bluecrew_activity";

  function getAll() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  }

  function save(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
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
        source.actor || "",

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
    return getAll().slice(0, limit);
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
    getCrewActor,
    getGameMatchup
  };
})();