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
      seasons: [],
      games: [],
      assignments: [],
      claims: [],
      notifications: [],
      crewMembers: [],
      pendingProfiles: [],
      manageableAccounts: null,
      activities: [],
      communicationEvents: [],
      communicationDeliveries: [],
      organizationProfiles: [],
      activityActors: [],
      identityDiagnostics: [],
      linkableProfiles: [],
      organization: null,
      initialSession: false,
      signUpRequiresConfirmation: false,
      profileMissingUntilProvision: false,
      deniedTable: "",
      failedMutationTable: "",
      failedRpc: "",
      profilePhotoObjects: {},
      deniedReferencedCrew: false,
      ...supabaseScenario
    };

    const installFixture = (settings) => {
      window.BLUECREW_RUNTIME_CONFIG = Object.freeze({ mode: "hosted" });
      window.BLUECREW_SUPABASE_CONFIG = Object.freeze({
        url: "https://fixture.supabase.co",
        publishableKey: "sb_publishable_fixture"
      });

      const calls = [];
      const user = { id: settings.profile.auth_user_id, email: settings.profile.email, user_metadata: {} };

      function queryFor(table) {
        let operation = "select";
        let payload = null;
        let selectedIds = [];
        const equality = {};
        async function listResult() {
          if (operation === "delete") {
            calls.push({ operation, table, ids: [...selectedIds] });
            if (settings.failedMutationTable === table) return { data: null, error: { message: "RLS denied" } };
            if (table === "notifications") {
              const manager = ["administrator", "assigner"].includes(settings.profile.role);
              const selected = new Set(selectedIds.map(String));
              settings.notifications = settings.notifications.filter(notification => {
                if (!selected.has(String(notification.id))) return true;
                if (String(notification.organization_id) !== String(settings.profile.organization_id)) return true;
                if (manager) return false;
                return String(notification.recipient_profile_id || "") !== String(settings.profile.id);
              });
            }
            return { data: null, error: null };
          }
          calls.push({ operation: "select", table });
          if (settings.deniedTable === table || (table === "crew_members" && settings.deniedReferencedCrew && selectedIds.length)) return { data: null, error: { message: "RLS denied" } };
          const rows = {
            availability: settings.availability,
            locations: settings.locations,
            fields: settings.fields,
            seasons: settings.seasons,
            games: settings.games,
            game_assignments: settings.assignments,
            assignment_claims: settings.claims,
            activities: settings.activities,
            notifications: settings.notifications,
            crew_members: settings.crewMembers.filter(member => !selectedIds.length || selectedIds.map(id => String(id).toLowerCase()).includes(String(member.id).toLowerCase()))
            ,profiles: [settings.profile, ...settings.pendingProfiles, ...settings.organizationProfiles, ...settings.activityActors].filter((row, index, all) => row && all.findIndex(candidate => String(candidate?.id) === String(row.id)) === index).filter(row => String(row.organization_id) === String(settings.profile.organization_id) && (!selectedIds.length || selectedIds.map(String).includes(String(row.id))) && Object.entries(equality).every(([column, value]) => String(row[column]) === String(value)))
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
          eq(column, value) { equality[column] = value; return query; },
          insert(value) { operation = "insert"; payload = value; return query; },
          update(value) { operation = "update"; payload = value; return query; },
          upsert(value) { operation = "upsert"; payload = value; return query; },
          delete() { operation = "delete"; return query; },
          in(column, ids) { selectedIds = ids || []; return query; },
          limit() { return query; },
          order(column) { calls.push({ operation: "order", table, column }); return query; },
          then(resolve, reject) { return listResult().then(resolve, reject); },
          async single() {
            calls.push({ operation, table, payload });
            if (settings.deniedTable === table) return { data: null, error: { message: "RLS denied" } };
            if (settings.failedMutationTable === table && operation !== "select") return { data: null, error: { message: "RLS denied" } };
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
            if (table === "crew_members" && operation === "insert") {
              const row = { id: `crew-${settings.crewMembers.length + 1}`, organization_id: settings.profile.organization_id, profile_id: null, legacy_crew_id: null, ...payload };
              settings.crewMembers.push(row);
              return { data: row, error: null };
            }
            if (table === "crew_members" && operation === "update") {
              const index = settings.crewMembers.findIndex(item => String(item.id) === String(equality.id));
              if (index < 0) return { data: null, error: { message: "Crew member not found" } };
              settings.crewMembers[index] = { ...settings.crewMembers[index], ...payload };
              return { data: settings.crewMembers[index], error: null };
            }
            return { data: null, error: null };
          },
          async maybeSingle() {
            calls.push({ operation: "select", table });
            if (settings.deniedTable === table) return { data: null, error: { message: "RLS denied" } };
            if (table === "profiles") return { data: settings.profileMissingUntilProvision ? null : settings.profile, error: null };
            if (table === "organizations") return { data: settings.organization || { id: settings.profile.organization_id, name: "Fixture Organization", slug: "fixture-organization", timezone: "America/New_York", settings: {} }, error: null };
            if (table === "crew_members") {
              const configuredCrew = settings.crewMembers.find(member => String(member.id) === String(settings.crewId));
              return { data: settings.crewId ? configuredCrew || { id: settings.crewId, organization_id: settings.profile.organization_id, profile_id: settings.profile.id, first_name: settings.profile.first_name, last_name: settings.profile.last_name, email: settings.profile.email, phone: settings.profile.phone, active: true, eligible_levels: ["12U"], preferences: {} } : null, error: null };
            }
            return { data: null, error: null };
          }
        };
        return query;
      }

      const client = {
        storage: {
          from(bucket) {
            const authorized = path => bucket === "profile-photos" && path === `${user.id}/profile`;
            const authorizedRead = path => authorized(path) || (
              bucket === "profile-photos"
              && ["administrator", "assigner"].includes(settings.profile.role)
              && [settings.profile, ...settings.pendingProfiles, ...settings.organizationProfiles]
                .some(profile => profile.organization_id === settings.profile.organization_id && path === `${profile.auth_user_id}/profile`)
            );
            return {
              async upload(path, file, options) {
                calls.push({ operation: "storage.upload", bucket, path, type: file?.type, size: file?.size, options });
                if (!authorized(path)) return { data: null, error: { message: "Storage policy denied" } };
                settings.profilePhotoObjects[path] = { type: file.type, size: file.size };
                return { data: { path }, error: null };
              },
              async remove(paths) {
                calls.push({ operation: "storage.remove", bucket, paths });
                if ((paths || []).some(path => !authorized(path))) return { data: null, error: { message: "Storage policy denied" } };
                for (const path of paths || []) delete settings.profilePhotoObjects[path];
                return { data: paths || [], error: null };
              },
              async createSignedUrl(path) {
                calls.push({ operation: "storage.createSignedUrl", bucket, path });
                if (!authorizedRead(path)) return { data: null, error: { message: "Storage policy denied" } };
                return { data: { signedUrl: `https://fixture.supabase.co/storage/v1/object/sign/${bucket}/${path}?token=fixture` }, error: null };
              }
            };
          }
        },
        functions: {
          async invoke(name, options) {
            calls.push({ operation: "functions.invoke", name, options });
            if (settings.failedFunction === name) return { data: null, error: { message: "Function failed" } };
            return { data: { message: "If an account exists for that email, a password reset link has been sent." }, error: null };
          }
        },
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
            if (settings.signInError || credentials.password === "wrong-password") return { data: { user: null, session: null }, error: { message: settings.signInError || "Invalid login credentials" } };
            return { data: { user, session: { user } }, error: null };
          },
          async resetPasswordForEmail(email, options) {
            calls.push({ operation: "resetPasswordForEmail", email, options });
            return settings.resetPasswordError ? { data: null, error: { message: settings.resetPasswordError, status: settings.resetPasswordErrorStatus || 500 } } : { data: {}, error: null };
          },
          async updateUser(attributes) {
            calls.push({ operation: "updateUser", attributes });
            return settings.updateUserError ? { data: null, error: { message: settings.updateUserError } } : { data: { user: { ...user } }, error: null };
          },
          async signUp(credentials) {
            calls.push({ operation: "signUp", credentials });
            user.user_metadata = { ...(credentials.options?.data || {}) };
            return { data: { user, session: settings.signUpRequiresConfirmation ? null : { user } }, error: null };
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
          if (name === "create_season") {
            if (settings.profile.role !== "administrator") return { data: null, error: { message: "administrator_required" } };
            if (args.p_active) settings.seasons.forEach(season => { season.active = false; });
            const row = {
              id: `season-${settings.seasons.length + 1}`,
              organization_id: settings.profile.organization_id,
              legacy_season_id: null,
              name: args.p_name,
              starts_on: args.p_starts_on,
              ends_on: args.p_ends_on,
              active: Boolean(args.p_active),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            settings.seasons.push(row);
            return { data: row, error: null };
          }
          if (name === "activate_season") {
            if (settings.profile.role !== "administrator") return { data: null, error: { message: "administrator_required" } };
            const target = settings.seasons.find(season => String(season.id) === String(args.p_season_id));
            if (!target) return { data: null, error: { message: "season_not_found" } };
            settings.seasons.forEach(season => { season.active = String(season.id) === String(target.id); });
            target.updated_at = new Date().toISOString();
            return { data: target, error: null };
          }
          if (name === "list_crew_identity_diagnostics") return { data: settings.identityDiagnostics, error: null };
          if (name === "list_linkable_umpire_profiles") return { data: settings.linkableProfiles, error: null };
          if (name === "list_manageable_accounts") {
            const rows = (settings.manageableAccounts || [settings.profile, ...settings.pendingProfiles])
              .filter(profile => profile.organization_id === settings.profile.organization_id);
            return { data: rows.map(profile => {
              const crew = settings.crewMembers.find(item => String(item.profile_id) === String(profile.id));
              return {
                ...profile,
                email: profile.login_email || profile.email,
                login_email: profile.login_email || profile.email,
                contact_email: crew?.email || null,
                crew_member_id: crew?.id || null,
                identity_status: profile.role === "umpire" ? (crew ? "linked" : "unlinked") : "not_applicable"
              };
            }), error: null };
          }
          if (name === "manage_crew_login_identity") {
            const crew = settings.crewMembers.find(item => String(item.id) === String(args.p_crew_member_id));
            if (!crew) return { data: null, error: { message: "crew_member_not_found" } };
            if (args.p_action === "unlink") crew.profile_id = null;
            else crew.profile_id = args.p_target_profile_id;
            return { data: null, error: null };
          }
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
            const game = assignment && settings.games.find(item => String(item.id) === String(assignment.game_id));
            const claimant = settings.crewMembers.find(item => String(item.id) === String(settings.crewId)) ||
              (settings.crewId ? { active: true, eligible_levels: ["12U"] } : null);
            if (!claimant?.active || !claimant.eligible_levels?.includes(game?.level)) {
              return { data: null, error: { message: "claim_level_ineligible" } };
            }
            if (settings.claims.some(claim => String(claim.assignment_id) === String(assignment?.id) && claim.status === "pending")) {
              return { data: null, error: { message: "assignment_position_reserved" } };
            }
            if (settings.claims.some(claim => {
              const claimedAssignment = settings.assignments.find(item => String(item.id) === String(claim.assignment_id));
              return claim.status === "pending" && String(claim.claimant_crew_member_id) === String(settings.crewId) && String(claimedAssignment?.game_id) === String(game?.id);
            })) {
              return { data: null, error: { message: "claimant_already_has_pending_game_claim" } };
            }
            const assignedGames = settings.assignments
              .filter(item => String(item.assigned_crew_member_id) === String(settings.crewId) && ["assigned", "locked"].includes(item.status))
              .map(item => settings.games.find(candidate => String(candidate.id) === String(item.game_id)))
              .filter(Boolean);
            if (assignedGames.some(item => item.id !== game?.id && item.game_date === game?.game_date && item.game_time === game?.game_time)) {
              return { data: null, error: { message: "claim_schedule_conflict" } };
            }
            if (new Set(assignedGames.filter(item => item.id !== game?.id && item.game_date === game?.game_date).map(item => item.id)).size >= 2) {
              return { data: null, error: { message: "claim_daily_limit_reached" } };
            }
            if (!assignment || !["open_for_claim", "needs_assignment"].includes(assignment.status) || assignment.assigned_crew_member_id || assignment.locked) {
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
          if (name === "provision_pending_umpire" || name === "provision_public_pending_umpire") {
            settings.profileMissingUntilProvision = false;
            if (!args.p_birthdate) return { data: null, error: { message: "date_of_birth_required" } };
            const today = new Date();
            const birthdate = new Date(`${args.p_birthdate}T12:00:00`);
            let age = today.getFullYear() - birthdate.getFullYear();
            if (today.getMonth() < birthdate.getMonth() || (today.getMonth() === birthdate.getMonth() && today.getDate() < birthdate.getDate())) age -= 1;
            if (age < 13) return { data: null, error: { message: "minimum_age_13_required" } };
            settings.profile = { ...settings.profile, first_name: args.p_first_name, last_name: args.p_last_name, phone: args.p_phone, birthdate: args.p_birthdate, status: "pending" };
            if (name === "provision_public_pending_umpire") {
              for (const administrator of settings.organizationProfiles.filter(candidate =>
                candidate.organization_id === settings.profile.organization_id &&
                candidate.role === "administrator" && candidate.status === "approved" && candidate.email
              )) {
                const businessKey = `account-pending-approval:${settings.profile.id}:${administrator.id}`;
                if (!settings.communicationEvents.some(event => event.business_idempotency_key === businessKey)) {
                  const event = {
                    id: `communication-${settings.communicationEvents.length + 1}`,
                    organization_id: settings.profile.organization_id,
                    event_type: "account-pending-approval",
                    recipient_profile_id: administrator.id,
                    subject_entity_id: settings.profile.id,
                    business_idempotency_key: businessKey,
                    metadata: {
                      pendingName: `${settings.profile.first_name} ${settings.profile.last_name}`.trim(),
                      pendingEmail: settings.profile.email,
                      actionPath: "accounts"
                    }
                  };
                  settings.communicationEvents.push(event);
                  settings.communicationDeliveries.push({
                    communication_event_id: event.id,
                    recipient_profile_id: administrator.id,
                    channel: "email",
                    status: "pending",
                    idempotency_key: `${settings.profile.organization_id}:${businessKey}:${administrator.id}:email`
                  });
                }
              }
            }
            return { data: { ...settings.profile, status: "pending" }, error: null };
          }
          if (name === "update_crew_member" || name === "update_crew_member_with_personnel") {
            const crew = settings.crewMembers.find(item => String(item.id) === String(args.p_crew_member_id));
            if (!crew || String(crew.organization_id) !== String(settings.profile.organization_id)) return { data: null, error: { message: "crew_member_not_found" } };
            const linkedProfile = [settings.profile, ...settings.pendingProfiles, ...settings.organizationProfiles].find(item => String(item.id) === String(crew.profile_id));
            if (crew.profile_id && !linkedProfile) return { data: null, error: { message: "linked_profile_not_found" } };
            if (linkedProfile) linkedProfile.phone = args.p_primary_phone;
            else crew.phone = args.p_primary_phone;
            if (linkedProfile && name === "update_crew_member_with_personnel") {
              linkedProfile.birthdate = args.p_birthdate || null;
              linkedProfile.official_history = args.p_service_history || [];
            }
            Object.assign(crew, { first_name: args.p_first_name, last_name: args.p_last_name, email: args.p_contact_email, active: args.p_active, eligible_levels: args.p_eligible_levels, preferences: args.p_preferences, notes: args.p_notes });
            return { data: { ...crew }, error: null };
          }
          if (name === "create_crew_member") {
            const row = {
              id: `crew-${settings.crewMembers.length + 1}`,
              organization_id: settings.profile.organization_id,
              profile_id: null,
              legacy_crew_id: null,
              first_name: args.p_first_name,
              last_name: args.p_last_name,
              email: args.p_email,
              phone: args.p_phone,
              active: args.p_active,
              eligible_levels: args.p_eligible_levels,
              preferences: args.p_preferences,
              notes: args.p_notes
            };
            settings.crewMembers.push(row);
            return { data: row, error: null };
          }
          if (name === "create_location_complex") {
            const row = { id: `location-${settings.locations.length + 1}`, organization_id: settings.profile.organization_id, name: args.p_name, active: true };
            settings.locations.push(row);
            return { data: row, error: null };
          }
          if (name === "create_location_field") {
            const row = { id: `field-${settings.fields.length + 1}`, organization_id: settings.profile.organization_id, location_id: args.p_location_id, name: args.p_name, active: true };
            settings.fields.push(row);
            return { data: row, error: null };
          }
          if (name === "approve_umpire_profile" || name === "approve_pending_umpire") {
            const target = settings.pendingProfiles.find(row => String(row.id) === String(args.p_target_profile_id));
            if (!target) {
              const approved = settings.pendingProfiles.find(row => String(row.id) === String(args.p_target_profile_id) && row.status === "approved");
              return approved ? { data: { ...approved }, error: null } : { data: null, error: { message: "pending_profile_not_found" } };
            }
            if (target.status === "approved") return { data: { ...target }, error: null };
            const matches = settings.crewMembers.filter(row => String(row.organization_id) === String(target.organization_id) && String(row.email || "").trim() && String(row.email).trim().toLowerCase() === String(target.email).trim().toLowerCase());
            if (matches.length > 1) return { data: null, error: { message: "crew_email_match_ambiguous" } };
            let crew = matches[0];
            if (crew?.profile_id && String(crew.profile_id) !== String(target.id)) return { data: null, error: { message: "crew_email_match_already_linked" } };
            if (crew?.active === false) return { data: null, error: { message: "crew_email_match_inactive" } };
            if (!crew) {
              crew = { id: `crew-${settings.crewMembers.length + 1}`, organization_id: target.organization_id, profile_id: target.id, legacy_crew_id: null, first_name: target.first_name, last_name: target.last_name, email: target.email, phone: target.phone, active: true, eligible_levels: [], preferences: {}, notes: "" };
              settings.crewMembers.push(crew);
            }
            target.status = "approved"; crew.profile_id = target.id;
            settings.notifications.push({ id: `notification-${settings.notifications.length + 1}`, organization_id: settings.profile.organization_id, type: "account-approved", audience: "account", recipient_profile_id: target.id, title: "Account Approved", message: "Approved", created_at: new Date().toISOString() });
            settings.communicationEvents.push({ event_type: "account-approved", recipient_profile_id: target.id });
            settings.activities.push({ action: "account_approved", metadata: { profileId: target.id, crewMemberId: crew.id } });
            return { data: { ...target }, error: null };
          }
          if (name === "update_game_operational_details") {
            const game = settings.games.find(item => String(item.id) === String(args.p_game_id));
            if (!game) return { data: null, error: { message: "game_update_not_found" } };
            const before = [game.game_date, game.game_time, game.location_id, game.field_id, game.lifecycle_status];
            if (args.p_game_date) game.game_date = args.p_game_date;
            if (args.p_game_time) game.game_time = args.p_game_time;
            if (args.p_location_id) game.location_id = args.p_location_id;
            if (args.p_field_id) game.field_id = args.p_field_id;
            if (args.p_lifecycle_status) game.lifecycle_status = args.p_lifecycle_status;
            const after = [game.game_date, game.game_time, game.location_id, game.field_id, game.lifecycle_status];
            if (before.some((value, index) => String(value ?? "") !== String(after[index] ?? ""))) {
              game.updated_at = new Date().toISOString();
            }
            return { data: game, error: null };
          }
          if (name === "import_schedule_games") {
            const invalid = (args.p_games || []).some(item => {
              const positions = item.positions || ["Plate"];
              return new Set(positions).size !== positions.length || positions.some(position => !["Plate","Base","U3","U4","Observer","Mentor"].includes(position));
            });
            if (invalid) return { data: null, error: { message: "schedule_import_invalid_positions" } };
            for (const item of args.p_games || []) {
              const row = { id: `imported-${settings.games.length + 1}`, organization_id: settings.profile.organization_id, season_id: "season-1", location_id: settings.locations.find(location => location.name === item.location)?.id, field_id: settings.fields.find(field => field.name === item.field)?.id, game_date: item.date, game_time: item.time, timezone: item.timezone, home_team: item.homeTeam, away_team: item.awayTeam, level: item.level, game_type: item.gameType, lifecycle_status: item.lifecycleStatus, review: {}, report: {}, source_metadata: {} };
              settings.games.push(row);
              const positions = item.positions || ["Plate"];
              positions.forEach(position => settings.assignments.push({ id: `assignment-${row.id}-${position}`, organization_id: row.organization_id, game_id: row.id, position, status: item.assignmentStatus, assigned_crew_member_id: null, locked: false }));
            }
            return { data: { importedCount: args.p_games.length, skippedCount: 0, errorCount: 0 }, error: null };
          }
          if (name === "reject_umpire_profile") {
            if (settings.profile.role !== "administrator") return { data: null, error: { message: "account_rejection_unauthorized" } };
            const target = settings.pendingProfiles.find(row => String(row.id) === String(args.p_target_profile_id));
            if (!target) return { data: null, error: { message: "Pending profile not found" } };
            target.status = "rejected";
            settings.notifications.push({ id: `notification-${settings.notifications.length + 1}`, organization_id: settings.profile.organization_id, type: "account-rejected", audience: "account", recipient_profile_id: target.id, title: "Account Rejected", message: "Rejected", created_at: new Date().toISOString() });
            settings.communicationEvents.push({ event_type: "account-rejected", recipient_profile_id: target.id });
            settings.activities.push({ action: "account_rejected", metadata: { profileId: target.id } });
            return { data: { ...target }, error: null };
          }
          if (name === "remove_game_assignment_crew") {
            if (!["administrator","assigner"].includes(settings.profile.role)) return { data: null, error: { message: "assignment_removal_unauthorized" } };
            const assignment = settings.assignments.find(row => String(row.id) === String(args.p_assignment_id));
            const game = assignment && settings.games.find(row => String(row.id) === String(assignment.game_id));
            if (!assignment || !game) return { data: null, error: { message: "assignment_removal_not_found" } };
            if (assignment.locked || assignment.status === "locked") return { data: null, error: { message: "assignment_removal_locked" } };
            if (["completed","submitted","approved","cancelled"].includes(game.lifecycle_status)) return { data: null, error: { message: "assignment_removal_finalized" } };
            const removed = assignment.assigned_crew_member_id;
            const approvedClaim = settings.claims.find(row => String(row.assignment_id) === String(assignment.id) && row.status === "approved");
            if (approvedClaim) { approvedClaim.status = "withdrawn"; approvedClaim.decision_by_profile_id = settings.profile.id; approvedClaim.decision_reason = "Administrative assignment removal"; approvedClaim.decided_at = new Date().toISOString(); }
            assignment.assigned_crew_member_id = null; assignment.status = "needs_assignment"; assignment.locked = false;
            const crew = settings.crewMembers.find(row => String(row.id) === String(removed));
            if (crew?.profile_id) settings.notifications.push({ id: `notification-${settings.notifications.length + 1}`, organization_id: settings.profile.organization_id, type: "assignment-removed", audience: "account", recipient_profile_id: crew.profile_id, title: "Assignment Removed", message: "Removed", created_at: new Date().toISOString() });
            settings.activities.push({ action: "assignment_removed", metadata: { gameId: game.id, assignmentId: assignment.id } });
            return { data: { ...assignment }, error: null };
          }
          if (name === "assign_game_assignment_crew") {
            if (!["administrator", "assigner"].includes(settings.profile.role)) return { data: null, error: { message: "assignment_direct_forbidden" } };
            const assignment = settings.assignments.find(row => String(row.id) === String(args.p_assignment_id));
            const game = assignment && settings.games.find(row => String(row.id) === String(assignment.game_id));
            const crew = settings.crewMembers.find(row => String(row.id) === String(args.p_crew_member_id) && String(row.organization_id) === String(settings.profile.organization_id) && row.active !== false);
            if (!assignment || !game) return { data: null, error: { message: "assignment_direct_not_found" } };
            if (!crew) return { data: null, error: { message: "assignment_direct_crew_not_found" } };
            if (assignment.locked || assignment.status === "locked") return { data: null, error: { message: "assignment_direct_locked" } };
            if (["completed", "submitted", "approved", "cancelled"].includes(game.lifecycle_status)) return { data: null, error: { message: "assignment_direct_finalized" } };
            if (String(assignment.assigned_crew_member_id || "") === String(crew.id) && assignment.status === "assigned") return { data: { ...assignment }, error: null };
            if (assignment.assigned_crew_member_id) return { data: null, error: { message: "assignment_direct_already_assigned" } };
            assignment.assigned_crew_member_id = crew.id;
            assignment.status = "assigned";
            assignment.locked = false;
            assignment.declined_at = null;
            assignment.decline_reason = null;
            settings.activities.push({ action: "assignment_assigned", metadata: { gameId: game.id, assignmentId: assignment.id, crewMemberId: crew.id } });
            if (crew.profile_id) settings.notifications.push({ id: `notification-${settings.notifications.length + 1}`, organization_id: settings.profile.organization_id, type: "assignment-created", audience: "account", recipient_profile_id: crew.profile_id, title: "Assignment Created", message: "Assigned", created_at: new Date().toISOString() });
            return { data: { ...assignment }, error: null };
          }
          if (name === "decline_own_game_assignment") {
            if (settings.profile.role !== "umpire" || !settings.crewId) return { data: null, error: { message: "assignment_decline_identity_required" } };
            const reason = String(args.p_reason || "").trim();
            if (!reason) return { data: null, error: { message: "assignment_decline_reason_required" } };
            const assignment = settings.assignments.find(row => String(row.id) === String(args.p_assignment_id));
            const game = assignment && settings.games.find(row => String(row.id) === String(assignment.game_id));
            if (!assignment || !game || String(assignment.assigned_crew_member_id) !== String(settings.crewId) || !["assigned", "locked"].includes(assignment.status)) return { data: null, error: { message: "assignment_decline_not_assigned" } };
            if (["completed", "submitted", "approved", "cancelled"].includes(game.lifecycle_status)) return { data: null, error: { message: "assignment_decline_finalized" } };
            assignment.assigned_crew_member_id = null;
            assignment.status = settings.claims.some(row => String(row.assignment_id) === String(assignment.id)) ? "open_for_claim" : "needs_assignment";
            assignment.locked = false;
            assignment.declined_at = new Date().toISOString();
            assignment.decline_reason = reason;
            settings.activities.push({ action: "assignment_declined", metadata: { gameId: game.id, assignmentId: assignment.id, reason } });
            settings.notifications.push({ id: `notification-${settings.notifications.length + 1}`, organization_id: settings.profile.organization_id, type: "assignment-declined", audience: "admin", recipient_profile_id: null, title: "Assignment Declined", message: reason, created_at: new Date().toISOString() });
            return { data: { ...assignment }, error: null };
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
