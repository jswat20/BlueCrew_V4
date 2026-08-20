const supabaseClientService = (() => {
  let clientPromise = null;
  let clientFactory = null;

  function getConfig() {
    const config = window.BLUECREW_SUPABASE_CONFIG || {};
    return {
      url: String(config.url || "").trim(),
      publishableKey: String(config.publishableKey || "").trim()
    };
  }

  function getRuntimeMode() {
    return String(window.BLUECREW_RUNTIME_CONFIG?.mode || window.BLUECREW_SUPABASE_CONFIG?.mode || "hosted").trim().toLowerCase();
  }

  function validateConfig(config = getConfig()) {
    const mode = getRuntimeMode();
    if (mode === "local") return { mode, configured: false, valid: true, message: "" };
    if (mode !== "hosted") return { mode, configured: false, valid: false, message: "The Slate runtime mode is invalid." };
    if (!config.url && !config.publishableKey) {
      return { mode, configured: false, valid: false, message: "The Slate could not connect to its hosted configuration." };
    }

    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(config.url)) {
      return { mode, configured: true, valid: false, message: "Supabase project URL is invalid." };
    }

    if (
      !config.publishableKey ||
      /service[_-]?role|sb_secret_/i.test(config.publishableKey) ||
      !/^[A-Za-z0-9._-]+$/.test(config.publishableKey)
    ) {
      return { mode, configured: true, valid: false, message: "Supabase publishable key is invalid." };
    }

    return { mode, configured: true, valid: true, message: "" };
  }

  function isConfigured() {
    const validation = validateConfig();
    return validation.configured && validation.valid;
  }

  function hasConfigurationError() {
    const validation = validateConfig();
    return validation.mode === "hosted" && (!validation.configured || !validation.valid);
  }

  function hasDependencyError() {
    const validation = validateConfig();
    if (validation.mode !== "hosted" || !validation.configured || !validation.valid) return false;
    const configuredFactory = clientFactory || window.BLUECREW_SUPABASE_CLIENT_FACTORY;
    return !configuredFactory && typeof window.supabase?.createClient !== "function";
  }

  async function getClient() {
    const config = getConfig();
    const validation = validateConfig(config);

    if (!validation.configured) {
      throw new Error("Supabase is not configured.");
    }

    if (!validation.valid) {
      throw new Error(validation.message);
    }

    if (!clientPromise) {
      clientPromise = (async () => {
        const configuredFactory = clientFactory || window.BLUECREW_SUPABASE_CLIENT_FACTORY;
        if (configuredFactory) {
          return configuredFactory(config);
        }

        const createClient = window.supabase?.createClient;
        if (typeof createClient !== "function") {
          throw new Error("The Slate could not load its hosted application dependency.");
        }
        return createClient(config.url, config.publishableKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        });
      })();
    }

    return clientPromise;
  }

  function useClientFactory(factory) {
    if (factory !== null && typeof factory !== "function") {
      throw new Error("Supabase client factory must be a function or null.");
    }
    clientFactory = factory;
    clientPromise = null;
  }

  function reset() {
    clientFactory = null;
    clientPromise = null;
  }

  return {
    getConfig,
    getRuntimeMode,
    validateConfig,
    isConfigured,
    hasConfigurationError,
    hasDependencyError,
    getClient,
    useClientFactory,
    reset
  };
})();
