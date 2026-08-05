import { test as base, expect } from "@playwright/test";

const defaultProfile = {
  id: "profile-umpire-1",
  auth_user_id: "auth-umpire-1",
  organization_id: "organization-1",
  first_name: "Linked",
  last_name: "Umpire",
  email: "linked@example.com",
  phone: "5550101000",
  role: "umpire",
  status: "approved",
  communication_preferences: {}
};

export const test = base.extend({
  supabaseScenario: [{}, { option: true }],

  supabaseAuthApp: async ({ page, supabaseScenario }, use) => {
    const scenario = {
      profile: defaultProfile,
      crewId: "crew-umpire-1",
      initialSession: false,
      ...supabaseScenario
    };

    await page.addInitScript((settings) => {
      window.BLUECREW_SUPABASE_CONFIG = Object.freeze({
        url: "https://fixture.supabase.co",
        publishableKey: "sb_publishable_fixture"
      });

      const calls = [];
      const user = { id: settings.profile.auth_user_id, email: settings.profile.email };

      function queryFor(table) {
        const query = {
          select() { return query; },
          eq() { return query; },
          async maybeSingle() {
            calls.push({ operation: "select", table });
            if (table === "profiles") return { data: settings.profile, error: null };
            if (table === "crew_members") {
              return { data: settings.crewId ? { id: settings.crewId } : null, error: null };
            }
            return { data: null, error: null };
          }
        };
        return query;
      }

      const client = {
        auth: {
          async getSession() {
            calls.push({ operation: "getSession" });
            return {
              data: { session: settings.initialSession ? { user } : null },
              error: null
            };
          },
          async signInWithPassword(credentials) {
            calls.push({ operation: "signInWithPassword", credentials });
            return { data: { user, session: { user } }, error: null };
          },
          async signUp(credentials) {
            calls.push({ operation: "signUp", credentials });
            return { data: { user, session: { user } }, error: null };
          },
          async signOut() {
            calls.push({ operation: "signOut" });
            return { error: null };
          },
          onAuthStateChange(callback) {
            calls.push({ operation: "onAuthStateChange" });
            window.__bluecrewAuthCallback = callback;
            return { data: { subscription: { unsubscribe() {} } } };
          }
        },
        from(table) {
          return queryFor(table);
        },
        async rpc(name, args) {
          calls.push({ operation: "rpc", name, args });
          if (name === "provision_pending_umpire") {
            return { data: { ...settings.profile, status: "pending" }, error: null };
          }
          if (name === "approve_umpire_profile") {
            return { data: { ...settings.profile, status: "approved" }, error: null };
          }
          if (name === "create_umpire_invitation") {
            return { data: "invitation-1", error: null };
          }
          return { data: null, error: { message: `Unexpected RPC: ${name}` } };
        }
      };

      window.__supabaseFixture = { calls, client };
      window.BLUECREW_SUPABASE_CLIENT_FACTORY = () => client;
    }, scenario);

    await page.goto("/");
    await use({
      page,
      calls: () => page.evaluate(() => window.__supabaseFixture.calls)
    });
  }
});

export { expect };
