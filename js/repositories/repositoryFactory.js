// js/repositories/repositoryFactory.js

const REPOSITORY_STORAGE_KEYS = Object.freeze({
  accounts: "bluecrew_accounts",
  activity: "bluecrew_activity",
  crew: "bluecrew-crew-v2",
  games: "bluecrew-games-v2",
  legacyDatabase: "bluecrewDatabase_v1",
  legacyGames: "bluecrew_games",
  locations: "bluecrew_location_catalog",
  notifications: "bluecrew_notifications",
  reportPresets: "bluecrew_report_presets",
  session: "bluecrew_session"
});

class LocalStorageRepository {
  constructor(storage, key) {
    this.storage = storage;
    this.key = key;
  }

  read() {
    const value = this.storage.getItem(this.key);
    return value === null ? null : JSON.parse(value);
  }

  write(value) {
    this.storage.setItem(this.key, JSON.stringify(value));
  }

  remove() {
    this.storage.removeItem(this.key);
  }
}

class MemoryRepository {
  constructor(store, key) {
    this.store = store;
    this.key = key;
  }

  read() {
    const value = this.store.get(this.key);
    return value === undefined ? null : JSON.parse(value);
  }

  write(value) {
    this.store.set(this.key, JSON.stringify(value));
  }

  remove() {
    this.store.delete(this.key);
  }
}

function createLocalStorageRepositoryFactory(storage = localStorage) {
  return {
    getRepository(name) {
      const key = REPOSITORY_STORAGE_KEYS[name];
      if (!key) throw new Error(`Unknown repository: ${name}`);
      return new LocalStorageRepository(storage, key);
    }
  };
}

function createMemoryRepositoryFactory(initialValues = {}) {
  const store = new Map();
  Object.entries(initialValues).forEach(([name, value]) => {
    const key = REPOSITORY_STORAGE_KEYS[name];
    if (!key) throw new Error(`Unknown repository: ${name}`);
    store.set(key, JSON.stringify(value));
  });

  return {
    getRepository(name) {
      const key = REPOSITORY_STORAGE_KEYS[name];
      if (!key) throw new Error(`Unknown repository: ${name}`);
      return new MemoryRepository(store, key);
    }
  };
}

const repositoryProvider = (() => {
  let factory = createLocalStorageRepositoryFactory();

  return {
    get(name) {
      return factory.getRepository(name);
    },

    use(nextFactory) {
      if (!nextFactory || typeof nextFactory.getRepository !== "function") {
        throw new Error("Repository factory must provide getRepository(name).");
      }
      factory = nextFactory;
    },

    useLocalStorage(storage = localStorage) {
      factory = createLocalStorageRepositoryFactory(storage);
    },

    useMemory(initialValues = {}) {
      factory = createMemoryRepositoryFactory(initialValues);
    }
  };
})();
