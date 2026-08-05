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
      availability: [],
      locations: [],
      fields: [],
      games: [],
      assignments: [],
      crewMembers: [],
      initialSession: false,
      deniedTable: "",
      failedRpc: "",
      deniedReferencedCrew: false,
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
        let operation = "select";
        let payload = null;
        let selectedIds = [];
        async function listResult() {
          calls.push({ operation: "select", table });
          if (settings.deniedTable === table || (table === "crew_members" && settings.deniedReferencedCrew && selectedIds.length)) return { data: null, error: { message: "RLS denied" } };
          const rows = {
            availability: settings.availability,
            locations: settings.locations,
            fields: settings.fields,
            games: settings.games,
            game_assignments: settings.assignments,
            crew_members: settings.crewMembers.filter(member => !selectedIds.length || selectedIds.map(String).includes(String(member.id)))
          };
          return { data: rows[table] || [], error: null };
        }
        const query = {
          select(columns) { calls.push({ operation: "selectColumns", table, columns }); return query; },
          eq() { return query; },
          update(value) { operation = "update"; payload = value; return query; },
          upsert(value) { operation = "upsert"; payload = value; return query; },
          delete() { operation = "delete"; return query; },
          in(column, ids) { selectedIds = ids || []; return query; },
          order(column) { calls.push({ operation: "order", table, column }); return query; },
          then(resolve, reject) { return listResult().then(resolve, reject); },
          async single() {
            calls.push({ operation, table, payload });
            if (table === "profiles" && operation === "update") {
              settings.profile = { ...settings.profile, ...payload };
              return { data: settings.profile, error: null };
            }
            if (table === "availability") {
              const row = { id: payload.id || `availability-${settings.availability.length + 1}`, ...payload };
              settings.availability = settings.availability.filter(item => item.id !== row.id);
              settings.availability.push(row);
              return { data: row, error: null };
            }
            return { data: null, error: null };
          },
          async maybeSingle() {
            calls.push({ operation: "select", table });
            if (settings.deniedTable === table) return { data: null, error: { message: "RLS denied" } };
            if (table === "profiles") return { data: settings.profile, error: null };
            if (table === "crew_members") {
              return { data: settings.crewId ? { id: settings.crewId, organization_id: settings.profile.organization_id, profile_id: settings.profile.id, first_name: settings.profile.first_name, last_name: settings.profile.last_name, email: settings.profile.email, phone: settings.profile.phone, active: true, eligible_levels: ["12U"], preferences: {} } : null, error: null };
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
          if (settings.failedRpc === name) return { data: null, error: { message: "Transactional write failed" } };
          if (name === "upsert_own_availability") {
            const row = { id: args.p_availability_id || `availability-${settings.availability.length + 1}`, organization_id: settings.profile.organization_id, crew_member_id: settings.crewId, availability_date: args.p_availability_date, status: args.p_status, starts_at: args.p_starts_at, ends_at: args.p_ends_at };
            settings.availability = settings.availability.filter(item => item.id !== row.id && !(item.crew_member_id === row.crew_member_id && item.availability_date === row.availability_date && item.starts_at === row.starts_at && item.ends_at === row.ends_at));
            settings.availability.push(row);
            return { data: row, error: null };
          }
          if (name === "set_own_availability_range") {
            const start = new Date(`${args.p_start_date}T00:00:00Z`);
            const end = new Date(`${args.p_end_date}T00:00:00Z`);
            let count = 0;
            for (let date = start; date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
              const value = date.toISOString().slice(0, 10);
              settings.availability = settings.availability.filter(item => !(item.crew_member_id === settings.crewId && item.availability_date === value && !item.starts_at));
              settings.availability.push({ id: `range-${value}`, organization_id: settings.profile.organization_id, crew_member_id: settings.crewId, availability_date: value, status: args.p_status, starts_at: null, ends_at: null });
              count += 1;
            }
            return { data: count, error: null };
          }
          if (name === "copy_own_availability_week") return { data: 0, error: null };
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

      window.__supabaseFixture = { calls, client, settings };
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
