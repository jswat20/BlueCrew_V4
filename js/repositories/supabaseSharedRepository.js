const supabaseSharedRepository = (() => {
  async function client() {
    return supabaseClientService.getClient();
  }

  async function getProfileForAuthUser(authUserId) {
    const db = await client();
    return db.rpc("get_active_profile");
  }

  async function updateProfile(profileId, changes) {
    const db = await client();
    return db.from("profiles").update(changes).eq("id", profileId).select("*").single();
  }

  async function updateProfilePhoto(profileId, photoPath) {
    const db = await client();
    return db.from("profiles").update({ photo_path: photoPath || null }).eq("id", profileId).select("*").single();
  }

  async function getLinkedCrewMember(profileId) {
    const db = await client();
    return db.from("crew_members").select("*").eq("profile_id", profileId).maybeSingle();
  }

  async function getCurrentOrganization(organizationId) {
    const db = await client();
    return db.from("organizations").select("id,name,slug,timezone,settings").eq("id", organizationId).maybeSingle();
  }

  async function getWorkspaceContext() {
    const db = await client();
    return db.rpc("get_workspace_context");
  }

  async function getAuthorizedWorkspaces() {
    const db = await client();
    return db.rpc("get_authorized_workspaces");
  }

  async function selectActiveWorkspace(organizationId) {
    const db = await client();
    return db.rpc("select_active_workspace", { p_organization_id: organizationId });
  }

  async function clearActiveWorkspace() {
    const db = await client();
    return db.rpc("clear_active_workspace");
  }

  async function createCustomerWorkspace({ name, slug, timezone, enabledModules }) {
    const db = await client();
    return db.rpc("create_customer_workspace", {
      p_name: name,
      p_slug: slug,
      p_timezone: timezone,
      p_enabled_modules: enabledModules
    });
  }

  async function enableWorkspaceModule(moduleCode) {
    const db = await client();
    return db.rpc("enable_workspace_module", { p_module_code: moduleCode });
  }

  async function getSeasons() {
    const db = await client();
    return db.from("seasons")
      .select("id,organization_id,legacy_season_id,name,starts_on,ends_on,active,created_at,updated_at")
      .order("starts_on", { ascending: false })
      .order("name")
      .order("id");
  }

  async function createSeason({ name, startsOn, endsOn, active = false }) {
    const db = await client();
    return db.rpc("create_season", {
      p_name: name,
      p_starts_on: startsOn,
      p_ends_on: endsOn,
      p_active: Boolean(active)
    });
  }

  async function activateSeason(seasonId) {
    const db = await client();
    return db.rpc("activate_season", { p_season_id: seasonId });
  }

  async function getSports() {
    const db = await client();
    return db.from("sports").select("code,name,active").eq("active", true).order("name");
  }

  async function getOrganizationSports() {
    const db = await client();
    return db.from("organization_sports")
      .select("id,organization_id,sport_code,display_name,active")
      .order("display_name").order("id");
  }

  async function getLeagues() {
    const db = await client();
    return db.from("leagues")
      .select("id,organization_id,organization_sport_id,name,slug,active")
      .order("name").order("id");
  }

  async function getDivisions() {
    const db = await client();
    return db.from("divisions")
      .select("id,organization_id,league_id,season_id,name,code,minimum_age,maximum_age,sort_order,active")
      .order("sort_order").order("name").order("id");
  }

  async function getTeams() {
    const db = await client();
    return db.from("teams")
      .select("id,organization_id,season_id,division_id,name,short_name,external_id,active")
      .order("name").order("id");
  }

  async function createCompetitionProgram({ sportCode, displayName, leagueName }) {
    const db = await client();
    return db.rpc("create_competition_program", {
      p_sport_code: sportCode,
      p_display_name: displayName,
      p_league_name: leagueName
    });
  }

  async function createCompetitionDivision({ leagueId, seasonId, name, code, minimumAge = null, maximumAge = null }) {
    const db = await client();
    return db.rpc("create_competition_division", {
      p_league_id: leagueId,
      p_season_id: seasonId,
      p_name: name,
      p_code: code,
      p_minimum_age: minimumAge,
      p_maximum_age: maximumAge
    });
  }

  async function createCompetitionTeam({ divisionId, name, shortName = "" }) {
    const db = await client();
    return db.rpc("create_competition_team", {
      p_division_id: divisionId,
      p_name: name,
      p_short_name: shortName
    });
  }

  const ACTIVITY_COLUMNS = "id,organization_id,actor_profile_id,type,action,subject,object,message,related_legacy_id,metadata,created_at";
  const ACTIVITY_ACTOR_COLUMNS = "id,role,first_name,last_name,email";

  async function getRecentActivities() {
    const db = await client();
    const activityResult = await db.from("activities").select(ACTIVITY_COLUMNS).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(50);
    if (activityResult.error) return { activities: null, profiles: null, error: activityResult.error };
    const actorIds = [...new Set((activityResult.data || []).map(row => row.actor_profile_id).filter(Boolean))];
    if (!actorIds.length) return { activities: activityResult.data || [], profiles: [], error: null };
    const profileResult = await db.from("profiles").select(ACTIVITY_ACTOR_COLUMNS).in("id", actorIds);
    return { activities: activityResult.data || [], profiles: profileResult.data || [], error: profileResult.error || null };
  }

  const PENDING_PROFILE_COLUMNS = "id,organization_id,role,requested_role,status,first_name,last_name,email,phone,birthdate,personnel_id,created_at";

  async function getPendingUmpireProfiles() {
    const db = await client();
    return db.from("profiles").select(PENDING_PROFILE_COLUMNS)
      .eq("status", "pending")
      .order("created_at").order("last_name").order("first_name").order("id");
  }

  async function getManageableAccounts() {
    const db = await client();
    return db.rpc("list_manageable_accounts");
  }

  async function approveUmpireProfile(profileId, approval = {}) {
    const db = await client();
    return db.rpc("approve_pending_account", {
      p_target_profile_id: profileId,
      p_all_divisions: approval.allDivisions === true,
      p_division_levels: approval.eligibleLevels || approval.divisionLevels || []
    });
  }

  async function rejectUmpireProfile(profileId, reason = "") {
    const db = await client();
    return db.rpc("reject_pending_account", { p_target_profile_id: profileId, p_reason: reason || null });
  }

  async function removeGameAssignmentCrew(assignmentId) {
    const db = await client();
    return db.rpc("remove_game_assignment_crew", { p_assignment_id: assignmentId });
  }

  async function assignGameAssignmentCrew(assignmentId, crewMemberId) {
    const db = await client();
    return db.rpc("assign_game_assignment_crew", { p_assignment_id: assignmentId, p_crew_member_id: crewMemberId });
  }

  async function declineOwnGameAssignment(assignmentId, reason) {
    const db = await client();
    return db.rpc("decline_own_game_assignment", { p_assignment_id: assignmentId, p_reason: reason });
  }

  const CREW_COLUMNS = "id,organization_id,profile_id,legacy_crew_id,first_name,last_name,email,phone,active,eligible_levels,preferences,notes";

  async function getCrewMembers() {
    const db = await client();
    return db.from("crew_members").select(CREW_COLUMNS).order("last_name").order("first_name").order("id");
  }

  const CREW_PROFILE_COLUMNS = "id,organization_id,role,status,first_name,last_name,email,phone,home_phone,address,contact_preference,birthdate,emergency_contact,emergency_contact_phone,crew_code,crew_code_issued_at,personnel_id,personnel_id_issued_at,official_history,years_of_service_override,photo_path,admin_notes,communication_preferences,approved_at,created_at,updated_at";

  async function getCrewProfiles(profileIds = []) {
    const ids = [...new Set(profileIds.filter(Boolean).map(String))];
    if (!ids.length) return { data: [], error: null };
    const db = await client();
    return db.from("profiles").select(CREW_PROFILE_COLUMNS).in("id", ids);
  }

  async function getCrewIdentityDiagnostics() {
    const db = await client();
    return db.rpc("list_crew_identity_diagnostics");
  }

  async function getLinkableUmpireProfiles() {
    const db = await client();
    return db.rpc("list_linkable_umpire_profiles");
  }

  async function manageCrewLoginIdentity(crewMemberId, action, profileId = null) {
    const db = await client();
    return db.rpc("manage_crew_login_identity", { p_crew_member_id: crewMemberId, p_action: action, p_target_profile_id: profileId });
  }

  async function createCrewMember(changes) {
    const db = await client();
    return db.rpc("create_crew_member", {
      p_first_name: changes.first_name,
      p_last_name: changes.last_name,
      p_email: changes.email,
      p_phone: changes.phone,
      p_active: changes.active,
      p_eligible_levels: changes.eligible_levels,
      p_preferences: changes.preferences,
      p_notes: changes.notes
    });
  }

  async function updateCrewMember(crewMemberId, changes) {
    const db = await client();
    return db.rpc("update_crew_member_with_personnel", {
      p_crew_member_id: crewMemberId,
      p_first_name: changes.first_name,
      p_last_name: changes.last_name,
      p_contact_email: changes.email,
      p_primary_phone: changes.phone,
      p_active: changes.active,
      p_eligible_levels: changes.eligible_levels,
      p_preferences: changes.preferences,
      p_notes: changes.notes,
      p_birthdate: changes.birthdate || null,
      p_service_history: changes.official_history || []
    });
  }

  async function getAvailability(crewMemberId) {
    const db = await client();
    return db.from("availability").select("*").eq("crew_member_id", crewMemberId).order("availability_date");
  }

  async function upsertOwnAvailability({ date, status, startTime = null, endTime = null, id = null }) {
    const db = await client();
    return db.rpc("upsert_own_availability", {
      p_availability_date: date,
      p_status: status,
      p_starts_at: startTime,
      p_ends_at: endTime,
      p_availability_id: id
    });
  }

  async function deleteAvailabilityDate(crewMemberId, date) {
    const db = await client();
    return db.from("availability").delete().eq("crew_member_id", crewMemberId).eq("availability_date", date);
  }

  async function deleteAvailabilityWindow(crewMemberId, id) {
    const db = await client();
    return db.from("availability").delete().eq("crew_member_id", crewMemberId).eq("id", id);
  }

  async function setOwnAvailabilityRange(startDate, endDate, status) {
    const db = await client();
    return db.rpc("set_own_availability_range", {
      p_start_date: startDate,
      p_end_date: endDate,
      p_status: status
    });
  }

  async function copyOwnAvailabilityWeek(sourceStartDate, targetStartDate) {
    const db = await client();
    return db.rpc("copy_own_availability_week", {
      p_source_start_date: sourceStartDate,
      p_target_start_date: targetStartDate
    });
  }

  async function getLocations() {
    const db = await client();
    return db.from("locations")
      .select("id,organization_id,legacy_location_id,name,address,timezone,status,supported_sports,notes,active")
      .order("name")
      .order("id");
  }

  async function getFields() {
    const db = await client();
    return db.from("fields")
      .select("id,organization_id,location_id,legacy_field_id,name,resource_type,resource_details,status,supported_sports,minimum_age,maximum_age,division_notes,active")
      .order("name")
      .order("id");
  }

  async function getGames() {
    const db = await client();
    return db.from("games")
      .select("id,organization_id,game_domain,sport,season_id,league_id,division_id,home_team_id,away_team_id,duration_minutes,location_id,field_id,location_name,legacy_game_id,game_date,game_time,timezone,home_team,away_team,level,game_type,lifecycle_status,notes,review,report,source_metadata")
      .order("game_date")
      .order("game_time")
      .order("id");
  }

  async function getGameAssignments() {
    const db = await client();
    return db.from("game_assignments")
      .select("id,organization_id,game_id,legacy_assignment_id,position,status,assigned_crew_member_id,locked,accepted_at,declined_at,decline_reason")
      .order("game_id")
      .order("position")
      .order("id");
  }

  async function getAssignmentClaims() {
    const db = await client();
    return db.from("assignment_claims")
      .select("id,organization_id,assignment_id,claimant_crew_member_id,legacy_claim_id,status,decision_by_profile_id,decision_reason,claimed_at,decided_at")
      .order("assignment_id")
      .order("claimed_at")
      .order("id");
  }

  async function submitAssignmentClaim(assignmentId) {
    const db = await client();
    return db.rpc("submit_assignment_claim", { p_assignment_id: assignmentId });
  }

  async function decideAssignmentClaim(assignmentId, decision, reason = "") {
    const db = await client();
    return db.rpc("decide_assignment_claim", {
      p_assignment_id: assignmentId,
      p_decision: decision,
      p_reason: reason || null
    });
  }

  async function saveOwnGameCompletion(
    gameId,
    awayScore,
    homeScore,
    notes = ""
  ) {
    const db = await client();
    return db.rpc("save_own_game_completion", {
      p_game_id: gameId,
      p_away_score: awayScore,
      p_home_score: homeScore,
      p_notes: notes || ""
    });
  }

  async function createLocationComplex(name) {
    const db = await client();
    return db.rpc("create_location_complex", { p_name: name });
  }

  async function createLocationField(locationId, name) {
    const db = await client();
    return db.rpc("create_location_field", { p_location_id: locationId, p_name: name });
  }

  async function getFieldAvailabilityRules() {
    const db = await client();
    return db.from("field_availability_rules").select("*").eq("active", true).order("day_of_week").order("starts_at_local");
  }

  async function getFieldClosures() {
    const db = await client();
    return db.from("field_closures").select("*").eq("active", true).order("starts_at");
  }

  async function getFieldReservations() {
    const db = await client();
    return db.from("field_reservations").select("*").order("starts_at");
  }

  async function createFacility(values) {
    const db = await client();
    return db.rpc("create_facility", {
      p_name: values.name, p_address: values.address || "", p_timezone: values.timezone,
      p_supported_sports: values.supportedSports || [], p_status: values.status, p_notes: values.notes || ""
    });
  }

  async function updateFacility(values) {
    const db = await client();
    return db.rpc("update_facility", {
      p_facility_id: values.id, p_name: values.name, p_address: values.address || "", p_timezone: values.timezone,
      p_supported_sports: values.supportedSports || [], p_status: values.status, p_notes: values.notes || ""
    });
  }

  async function createFacilityField(values) {
    const db = await client();
    return db.rpc("create_facility_field", {
      p_facility_id: values.facilityId, p_name: values.name, p_supported_sports: values.supportedSports || [],
      p_status: values.status, p_minimum_age: values.minimumAge || null, p_maximum_age: values.maximumAge || null,
      p_division_notes: values.divisionNotes || ""
    });
  }

  async function updateFacilityField(values) {
    const db = await client();
    return db.rpc("update_facility_field", {
      p_field_id: values.id, p_name: values.name, p_supported_sports: values.supportedSports || [],
      p_status: values.status, p_minimum_age: values.minimumAge || null, p_maximum_age: values.maximumAge || null,
      p_division_notes: values.divisionNotes || ""
    });
  }

  async function createFacilityResource(values) {
    const db = await client();
    return db.rpc("create_facility_resource", {
      p_facility_id: values.facilityId, p_name: values.name, p_resource_type: values.resourceType || "other",
      p_supported_sports: values.supportedSports || [], p_status: values.status,
      p_minimum_age: values.minimumAge || null, p_maximum_age: values.maximumAge || null,
      p_division_notes: values.divisionNotes || "", p_resource_details: values.resourceDetails || {}
    });
  }

  async function updateFacilityResource(values) {
    const db = await client();
    return db.rpc("update_facility_resource", {
      p_resource_id: values.id, p_name: values.name, p_resource_type: values.resourceType || "other",
      p_supported_sports: values.supportedSports || [], p_status: values.status,
      p_minimum_age: values.minimumAge || null, p_maximum_age: values.maximumAge || null,
      p_division_notes: values.divisionNotes || "", p_resource_details: values.resourceDetails || {}
    });
  }

  async function createFieldAvailabilityRule(values) {
    const db = await client();
    return db.rpc("create_field_availability_rule", {
      p_field_id: values.fieldId, p_day_of_week: values.dayOfWeek, p_starts_at_local: values.startsAtLocal,
      p_ends_at_local: values.endsAtLocal, p_effective_from: values.effectiveFrom || null, p_effective_until: values.effectiveUntil || null
    });
  }

  async function createFieldClosure(values) {
    const db = await client();
    return db.rpc("create_field_closure", {
      p_field_id: values.fieldId, p_closure_type: values.closureType, p_title: values.title,
      p_starts_at: values.startsAt, p_ends_at: values.endsAt, p_notes: values.notes || ""
    });
  }

  async function saveFieldReservation(values) {
    const db = await client();
    return db.rpc("save_field_reservation", {
      p_reservation_id: values.id || null, p_field_id: values.fieldId, p_reservation_type: values.reservationType,
      p_title: values.title, p_starts_at: values.startsAt, p_ends_at: values.endsAt,
      p_game_id: values.gameId || null, p_notes: values.notes || ""
    });
  }

  async function cancelFieldReservation(id) {
    const db = await client();
    return db.rpc("cancel_field_reservation", { p_reservation_id: id });
  }

  async function importScheduleGames(games) {
    const db = await client();
    return db.rpc("import_schedule_games", { p_games: games });
  }

  async function createDomainGame(values) {
    const db = await client();
    return db.rpc("create_domain_game", {
      p_game_domain: values.gameDomain,
      p_sport: values.sport,
      p_game_date: values.date,
      p_game_time: values.time,
      p_timezone: values.timezone || null,
      p_location_id: values.locationId || null,
      p_field_id: values.fieldId || null,
      p_location_name: values.locationName || null,
      p_home_team: values.homeTeam || null,
      p_away_team: values.awayTeam || null,
      p_level: values.level || "",
      p_game_type: values.gameType || "single",
      p_notes: values.notes || ""
    });
  }

  async function saveLeagueGame(values) {
    const db = await client();
    return db.rpc("save_league_game", {
      p_game_id: values.id || null, p_sport: values.sport, p_season_id: values.seasonId,
      p_league_id: values.leagueId, p_division_id: values.divisionId,
      p_home_team_id: values.homeTeamId, p_away_team_id: values.awayTeamId,
      p_game_date: values.date, p_game_time: values.time, p_duration_minutes: values.durationMinutes,
      p_location_id: values.locationId || null, p_field_id: values.fieldId || null, p_notes: values.notes || ""
    });
  }

  async function transitionLeagueGame(gameId, action) {
    const db = await client();
    return db.rpc("transition_league_game", { p_game_id: gameId, p_action: action });
  }

  async function getLeagueScheduleProposals() {
    const db = await client();
    return db.from("league_schedule_proposals").select("*").order("updated_at", { ascending: false });
  }

  async function getLeagueScheduleProposalGames(proposalId) {
    const db = await client();
    return db.from("league_schedule_proposal_games").select("*").eq("proposal_id", proposalId).order("ordinal");
  }

  async function saveLeagueScheduleProposal(payload) {
    const db = await client();
    return db.rpc("save_league_schedule_proposal", { p_payload: payload });
  }

  async function updateLeagueScheduleProposalGame(values) {
    const db = await client();
    return db.rpc("update_league_schedule_proposal_game", {
      p_proposal_game_id: values.id, p_game_date: values.date, p_game_time: values.time,
      p_location_id: values.locationId, p_field_id: values.fieldId, p_notes: values.notes || ""
    });
  }

  async function publishLeagueScheduleProposal(proposalId) {
    const db = await client();
    return db.rpc("publish_league_schedule_proposal", { p_proposal_id: proposalId });
  }

  async function getTournamentCatalog() {
    const db = await client();
    const [tournaments, divisions, teams, pools, memberships, proposals, games, rules, results, tiebreaks, brackets, bracketRounds, bracketGames, publications] = await Promise.all([
      db.from("tournaments").select("*").order("starts_on", { ascending: false }),
      db.from("tournament_divisions").select("*").order("name"),
      db.from("tournament_teams").select("*").order("name"),
      db.from("tournament_pools").select("*").order("name"),
      db.from("tournament_pool_memberships").select("*").order("assigned_at"),
      db.from("tournament_schedule_proposals").select("*").order("updated_at", { ascending: false }),
      db.from("games").select("*").eq("game_domain", "tournament").order("game_date"),
      db.from("tournament_scoring_rules").select("*"),
      db.from("tournament_game_results").select("*"),
      db.from("tournament_manual_tiebreaks").select("*").order("priority"),
      db.from("tournament_brackets").select("*").order("generated_at", { ascending: false }),
      db.from("tournament_bracket_rounds").select("*").order("round_number"),
      db.from("tournament_bracket_games").select("*").order("round_number").order("game_number"),
      db.from("tournament_publications").select("*")
    ]);
    const all = [tournaments, divisions, teams, pools, memberships, proposals, games, rules, results, tiebreaks, brackets, bracketRounds, bracketGames, publications];
    const error = all.find(result => result.error)?.error || null;
    return { data: { tournaments: tournaments.data || [], divisions: divisions.data || [], teams: teams.data || [], pools: pools.data || [], memberships: memberships.data || [], proposals: proposals.data || [], games: games.data || [], rules: rules.data || [], results: results.data || [], tiebreaks: tiebreaks.data || [], brackets: brackets.data || [], bracketRounds: bracketRounds.data || [], bracketGames: bracketGames.data || [], publications: publications.data || [] }, error };
  }
  async function getTournamentProposalGames(id) { const db=await client(); return db.from("tournament_schedule_proposal_games").select("*").eq("proposal_id",id).order("ordinal"); }
  async function saveTournament(payload) { const db=await client(); return db.rpc("save_tournament",{p_payload:payload}); }
  async function transitionTournament(id,status) { const db=await client(); return db.rpc("transition_tournament",{p_tournament_id:id,p_status:status}); }
  async function saveTournamentDivision(payload) { const db=await client(); return db.rpc("save_tournament_division",{p_payload:payload}); }
  async function saveTournamentTeam(payload) { const db=await client(); return db.rpc("save_tournament_team",{p_payload:payload}); }
  async function withdrawTournamentTeam(id) { const db=await client(); return db.rpc("withdraw_tournament_team",{p_team_id:id}); }
  async function saveTournamentPool(payload) { const db=await client(); return db.rpc("save_tournament_pool",{p_payload:payload}); }
  async function assignTournamentTeamToPool(teamId,poolId) { const db=await client(); return db.rpc("assign_tournament_team_to_pool",{p_team_id:teamId,p_pool_id:poolId}); }
  async function saveTournamentProposal(payload) { const db=await client(); return db.rpc("save_tournament_schedule_proposal",{p_payload:payload}); }
  async function updateTournamentProposalGame(values) { const db=await client(); return db.rpc("update_tournament_schedule_proposal_game",{p_game_id:values.id,p_date:values.date,p_time:values.time,p_location_id:values.locationId,p_field_id:values.fieldId,p_notes:values.notes||""}); }
  async function publishTournamentProposal(id) { const db=await client(); return db.rpc("publish_tournament_schedule_proposal",{p_proposal_id:id}); }
  async function saveTournamentScoringRules(payload) { const db=await client(); return db.rpc("save_tournament_scoring_rules",{p_payload:payload}); }
  async function saveTournamentGameResult(values) { const db=await client(); return db.rpc("save_tournament_game_result",{p_game_id:values.gameId,p_status:values.status,p_home_score:values.homeScore,p_away_score:values.awayScore,p_winner_team_id:values.winnerTeamId||null,p_decision_note:values.note||""}); }
  async function getTournamentPoolStandings(poolId) { const db=await client(); return db.rpc("get_tournament_pool_standings",{p_pool_id:poolId}); }
  async function saveTournamentManualTiebreak(values) { const db=await client(); return db.rpc("save_tournament_manual_tiebreak",{p_pool_id:values.poolId,p_team_id:values.teamId,p_priority:values.priority,p_reason:values.reason}); }
  async function generateTournamentBracket(values) { const db=await client(); return db.rpc("generate_tournament_bracket",{p_division_id:values.divisionId,p_qualifiers:values.qualifiers,p_name:values.name}); }
  async function scheduleTournamentBracketGame(values) { const db=await client(); return db.rpc("schedule_tournament_bracket_game",{p_bracket_game_id:values.bracketGameId,p_game_date:values.date,p_game_time:values.time,p_location_id:values.locationId,p_field_id:values.fieldId}); }
  async function setTournamentPublication(tournamentId,published) { const db=await client(); return db.rpc("set_tournament_publication",{p_tournament_id:tournamentId,p_published:published}); }
  async function getPublicTournament(shareToken) { const db=await client(); return db.rpc("get_public_tournament",{p_share_token:shareToken}); }
  async function rescheduleTournamentGame(values) { const db=await client(); return db.rpc("reschedule_tournament_game",{p_game_id:values.gameId,p_game_date:values.date,p_game_time:values.time,p_location_id:values.locationId,p_field_id:values.fieldId}); }
  async function transitionTournamentGame(gameId,action) { const db=await client(); return db.rpc("transition_tournament_game",{p_game_id:gameId,p_action:action}); }
  async function advanceTournamentByes(bracketId) { const db=await client(); return db.rpc("advance_tournament_byes",{p_bracket_id:bracketId}); }

  async function deleteScheduleGame(gameId) {
    const db = await client();
    return db.from("games")
      .delete()
      .eq("id", gameId)
      .select("*")
      .maybeSingle();
  }

  async function updateGameOperationalDetails(gameId, changes = {}) {
    const db = await client();
    return db.rpc("update_game_operational_details", {
      p_game_id: gameId,
      p_game_date: changes.gameDate || null,
      p_game_time: changes.gameTime || null,
      p_location_id: changes.locationId || null,
      p_field_id: changes.fieldId || null,
      p_lifecycle_status: changes.lifecycleStatus || null
    });
  }

  async function getCrewMembersByIds(crewMemberIds = []) {
    if (!crewMemberIds.length) return { data: [], error: null };
    const db = await client();
    return db.from("crew_members")
      .select("id,organization_id,profile_id,legacy_crew_id,first_name,last_name,email,phone,active,eligible_levels,preferences,notes")
      .in("id", crewMemberIds)
      .order("last_name")
      .order("first_name")
      .order("id");
  }

  return {
    getProfileForAuthUser,
    getCurrentOrganization,
    getWorkspaceContext,
    getAuthorizedWorkspaces,
    selectActiveWorkspace,
    clearActiveWorkspace,
    createCustomerWorkspace,
    enableWorkspaceModule,
    getSeasons,
    createSeason,
    activateSeason,
    getSports,
    getOrganizationSports,
    getLeagues,
    getDivisions,
    getTeams,
    createCompetitionProgram,
    createCompetitionDivision,
    createCompetitionTeam,
    getRecentActivities,
    updateProfile,
    updateProfilePhoto,
    getPendingUmpireProfiles,
    getManageableAccounts,
    approveUmpireProfile,
    rejectUmpireProfile,
    removeGameAssignmentCrew,
    assignGameAssignmentCrew,
    declineOwnGameAssignment,
    getLinkedCrewMember,
    getCrewMembers,
    getCrewProfiles,
    getCrewIdentityDiagnostics,
    getLinkableUmpireProfiles,
    manageCrewLoginIdentity,
    createCrewMember,
    createLocationComplex,
    createLocationField,
    getFieldAvailabilityRules,
    getFieldClosures,
    getFieldReservations,
    createFacility,
    updateFacility,
    createFacilityField,
    updateFacilityField,
    createFacilityResource,
    updateFacilityResource,
    createFieldAvailabilityRule,
    createFieldClosure,
    saveFieldReservation,
    cancelFieldReservation,
    updateCrewMember,
    getAvailability,
    upsertOwnAvailability,
    deleteAvailabilityDate,
    deleteAvailabilityWindow,
    setOwnAvailabilityRange,
    copyOwnAvailabilityWeek,
    getLocations,
    getFields,
    getGames,
    getGameAssignments,
    getAssignmentClaims,
    submitAssignmentClaim,
    decideAssignmentClaim,
    saveOwnGameCompletion,
    updateGameOperationalDetails,
    importScheduleGames,
    createDomainGame,
    saveLeagueGame,
    transitionLeagueGame,
    getLeagueScheduleProposals,
    getLeagueScheduleProposalGames,
    saveLeagueScheduleProposal,
    updateLeagueScheduleProposalGame,
    publishLeagueScheduleProposal,
    getTournamentCatalog,
    getTournamentProposalGames,
    saveTournament,
    transitionTournament,
    saveTournamentDivision,
    saveTournamentTeam,
    withdrawTournamentTeam,
    saveTournamentPool,
    assignTournamentTeamToPool,
    saveTournamentProposal,
    updateTournamentProposalGame,
    publishTournamentProposal,
    saveTournamentScoringRules,
    saveTournamentGameResult,
    getTournamentPoolStandings,
    saveTournamentManualTiebreak,
    generateTournamentBracket,
    scheduleTournamentBracketGame,
    setTournamentPublication,
    getPublicTournament,
    rescheduleTournamentGame,
    transitionTournamentGame,
    advanceTournamentByes,
    deleteScheduleGame,
    getCrewMembersByIds
  };
})();
