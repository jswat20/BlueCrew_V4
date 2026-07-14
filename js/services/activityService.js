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
      gameId:
        source.gameId || "",
      matchup:
        source.matchup || "",
      message:
        source.message || "",
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

  return {
    log,
    getRecent
  };
})();