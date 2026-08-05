const supabaseClientService = (() => {
  const CLIENT_MODULE_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.1/+esm";
  let clientPromise = null;
  let clientFactory = null;

  function getConfig() {
    const config = window.BLUECREW_SUPABASE_CONFIG || {};
    return {
      url: String(config.url || "").trim(),
      publishableKey: String(config.publishableKey || "").trim()
    };
  }

  function validateConfig(config = getConfig()) {
    if (!config.url && !config.publishableKey) {
      return { configured: false, valid: true, message: "" };
    }

    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(config.url)) {
      return { configured: true, valid: false, message: "Supabase project URL is invalid." };
    }

    if (
      !config.publishableKey ||
      /service[_-]?role|sb_secret_/i.test(config.publishableKey) ||
      !/^[A-Za-z0-9._-]+$/.test(config.publishableKey)
    ) {
      return { configured: true, valid: false, message: "Supabase publishable key is invalid." };
    }

    return { configured: true, valid: true, message: "" };
  }

  function isConfigured() {
    const validation = validateConfig();
    return validation.configured && validation.valid;
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

        const { createClient } = await import(CLIENT_MODULE_URL);
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
    validateConfig,
    isConfigured,
    getClient,
    useClientFactory,
    reset
  };
})();
