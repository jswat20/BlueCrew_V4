const stagingAuthEmailService = (() => {
  const STAGING_HOST = "fdjhwxmphdzodxvhrblk.supabase.co";
  const STAGING_ORIGIN = "https://the-slate-v2.pages.dev";

  function isAvailable() {
    const config = supabaseClientService.getConfig();
    return supabaseClientService.getRuntimeMode() === "hosted"
      && new URL(config.url).host === STAGING_HOST
      && window.location.origin === STAGING_ORIGIN
      && accountService?.getAuthenticatedProfile?.()?.role === "administrator";
  }

  async function openLatest(email,actionType) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedAction = String(actionType || "").trim();
    if (!isAvailable()) return { success:false,message:"Staging Auth actions are unavailable." };
    if (!normalizedEmail.endsWith("@slate.invalid")) return { success:false,message:"Use an approved @slate.invalid synthetic identity." };
    if (!["signup","recovery"].includes(normalizedAction)) return { success:false,message:"Select a supported Auth action." };
    const client = await supabaseClientService.getClient();
    const { data,error } = await client.functions.invoke("staging-auth-email-action", {
      body:{ email:normalizedEmail,actionType:normalizedAction }
    });
    if (error || !data?.actionUrl) return { success:false,message:data?.error || error?.message || "No unexpired Auth action is available." };
    const actionUrl = new URL(data.actionUrl);
    if (actionUrl.host !== STAGING_HOST || actionUrl.pathname !== "/auth/v1/verify" || actionUrl.searchParams.get("redirect_to") !== `${STAGING_ORIGIN}/`) {
      return { success:false,message:"The Auth action did not pass staging URL validation." };
    }
    window.location.assign(actionUrl.toString());
    return { success:true,message:"Opening the one-time staging Auth action." };
  }

  return Object.freeze({ isAvailable,openLatest });
})();
