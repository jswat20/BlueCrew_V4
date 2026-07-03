// activityService.js

const activityService = (() => {
  const STORAGE_KEY = "bluecrew_activity";

  function getAll() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  }

  function save(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  function log(type, message) {
    const items = getAll();

    items.unshift({
      id: crypto.randomUUID(),
      type,
      message,
      createdAt: new Date().toISOString()
    });

    save(items.slice(0, 50));
  }

  function getRecent(limit = 10) {
    return getAll().slice(0, limit);
  }

  return {
    log,
    getRecent
  };
})();