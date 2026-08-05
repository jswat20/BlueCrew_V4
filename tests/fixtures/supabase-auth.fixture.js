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

  supabaseAuthApp: async ({ page, browser, supabaseScenario }, use) => {
    const scenario = {
      profile: defaultProfile,
      crewId: "crew-umpire-1",
      availability: [],
      locations: [],
      fields: [],
      games: [],
      assignments: [],
      claims: [],
      notifications: [],
      crewMembers: [],
      initialSession: false,
      deniedTable: "",
      failedRpc: "",
      deniedReferencedCrew: false,
      ...supabaseScenario
    };

    const installFixture = (settings) => {
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
            assignment_claims: settings.claims,
            notifications: settings.notifications,
            crew_members: settings.crewMembers.filter(member => !selectedIds.length || selectedIds.map(String).includes(String(member.id)))
          };
          if (table === "notifications") {
            rows.notifications = settings.notifications.filter(notification =>
              String(notification.organization_id) === String(settings.profile.organization_id) &&
              (String(notification.recipient_profile_id || "") === String(settings.profile.id) ||
                (!notification.recipient_profile_id &&
                  ((notification.audience === "admin" && settings.profile.role === "administrator") ||
                    (notification.audience === "umpire" && settings.profile.role === "umpire"))))
            );
          }
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
          if (name === "mark_notification_read") {
            const notification = settings.notifications.find(item => String(item.id) === String(args.p_notification_id) && String(item.recipient_profile_id) === String(settings.profile.id));
            if (notification && !notification.read_at) notification.read_at = new Date().toISOString();
            return { data: null, error: null };
          }
          if (name === "mark_all_notifications_read") {
            settings.notifications.forEach(notification => {
              if (String(notification.recipient_profile_id) === String(settings.profile.id) && !notification.read_at) notification.read_at = new Date().toISOString();
            });
            return { data: null, error: null };
          }
          if (name === "submit_assignment_claim") {
            const assignment = settings.assignments.find(item => String(item.id) === String(args.p_assignment_id));
            if (!assignment || assignment.status !== "open_for_claim" || assignment.locked) {
              return { data: null, error: { message: "assignment_already_claimed" } };
            }
            const claim = {
              id: `claim-${settings.claims.length + 1}`,
              organization_id: settings.profile.organization_id,
              assignment_id: assignment.id,
              claimant_crew_member_id: settings.crewId,
              status: "pending",
              claimed_at: new Date().toISOString(),
              decided_at: null
            };
            settings.claims.push(claim);
            assignment.status = "pending_approval";
            return { data: claim, error: null };
          }
          if (name === "decide_assignment_claim") {
            const assignment = settings.assignments.find(item => String(item.id) === String(args.p_assignment_id));
            const claim = settings.claims.find(item => String(item.assignment_id) === String(args.p_assignment_id) && item.status === "pending");
            if (!assignment || assignment.status !== "pending_approval" || !claim) {
              return { data: null, error: { message: "claim_no_longer_pending" } };
            }
            claim.status = args.p_decision;
            claim.decided_at = new Date().toISOString();
            if (args.p_decision === "approved") {
              assignment.status = "assigned";
              assignment.assigned_crew_member_id = claim.claimant_crew_member_id;
            } else {
              assignment.status = "open_for_claim";
              assignment.assigned_crew_member_id = null;
            }
            return { data: assignment, error: null };
          }
          if (name === "save_own_game_completion") {
            const game = settings.games.find(
              item =>
                String(item.id) ===
                String(args.p_game_id)
            );
            const assignment = settings.assignments.find(
              item =>
                String(item.game_id) ===
                  String(args.p_game_id) &&
                String(item.assigned_crew_member_id) ===
                  String(settings.crewId) &&
                ["assigned", "locked"].includes(item.status)
            );

            if (!game) {
              return {
                data: null,
                error: {
                  message:
                    "game_completion_not_found"
                }
              };
            }

            if (!assignment) {
              return {
                data: null,
                error: {
                  message:
                    "game_completion_not_assigned"
                }
              };
            }

            if (game.lifecycle_status === "cancelled") {
              return {
                data: null,
                error: {
                  message:
                    "game_completion_cancelled"
                }
              };
            }

            if (
              game.lifecycle_status === "approved" ||
              game.review?.status === "approved" ||
              game.review?.finalized === true
            ) {
              return {
                data: null,
                error: {
                  message:
                    "game_completion_finalized"
                }
              };
            }

            if (
              !["scheduled", "returned"].includes(
                game.lifecycle_status
              )
            ) {
              return {
                data: null,
                error: {
                  message:
                    "game_completion_not_editable"
                }
              };
            }

            if (
              !Number.isInteger(args.p_away_score) ||
              args.p_away_score < 0 ||
              !Number.isInteger(args.p_home_score) ||
              args.p_home_score < 0
            ) {
              return {
                data: null,
                error: {
                  message:
                    "game_completion_invalid_score"
                }
              };
            }

            const completionTime =
              game.report?.completion?.completionTime ||
              new Date().toISOString();

            game.report = {
              ...(game.report || {}),
              notes:
                String(args.p_notes || "").trim(),
              completion: {
                completed: true,
                completionTime,
                completedByProfileId:
                  settings.profile.id,
                completedByCrewMemberId:
                  settings.crewId,
                completionStatus: "completed",
                awayScore: args.p_away_score,
                homeScore: args.p_home_score,
                notes:
                  String(args.p_notes || "").trim()
              }
            };

            if (
              game.lifecycle_status !== "returned"
            ) {
              game.lifecycle_status = "completed";
            }

            return {
              data: { ...game },
              error: null
            };
          }
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
    };

    await page.addInitScript(installFixture, scenario);

    await page.goto("/");
    await use({
      page,
      calls: () => page.evaluate(() => window.__supabaseFixture.calls),
      openContext: async (overrides = {}) => {
        const context = await browser.newContext();
        const contextPage = await context.newPage();
        await contextPage.addInitScript(installFixture, { ...scenario, ...overrides });
        await contextPage.goto("/");
        return { context, page: contextPage };
      }
    });
  }
});

export { expect };
