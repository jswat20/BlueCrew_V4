const supabaseSharedRepository = (() => {
  async function client() {
    return supabaseClientService.getClient();
  }

  async function getProfileForAuthUser(authUserId) {
    const db = await client();
    return db.from("profiles").select("*").eq("auth_user_id", authUserId).maybeSingle();
  }

  async function updateProfile(profileId, changes) {
    const db = await client();
    return db.from("profiles").update(changes).eq("id", profileId).select("*").single();
  }

  async function getLinkedCrewMember(profileId) {
    const db = await client();
    return db.from("crew_members").select("*").eq("profile_id", profileId).maybeSingle();
  }

  async function getCurrentOrganization(organizationId) {
    const db = await client();
    return db.from("organizations").select("id,name,slug,timezone,settings").eq("id", organizationId).maybeSingle();
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

  const PENDING_PROFILE_COLUMNS = "id,organization_id,role,status,first_name,last_name,email,phone,created_at";

  async function getPendingUmpireProfiles() {
    const db = await client();
    return db.from("profiles").select(PENDING_PROFILE_COLUMNS)
      .eq("role", "umpire").eq("status", "pending")
      .order("created_at").order("last_name").order("first_name").order("id");
  }

  async function approveUmpireProfile(profileId, crewMemberId) {
    const db = await client();
    return db.rpc("approve_umpire_profile", { p_target_profile_id: profileId, p_target_crew_member_id: crewMemberId });
  }

  async function rejectUmpireProfile(profileId, reason = "") {
    const db = await client();
    return db.rpc("reject_umpire_profile", { p_target_profile_id: profileId, p_reason: reason || null });
  }

  async function removeGameAssignmentCrew(assignmentId) {
    const db = await client();
    return db.rpc("remove_game_assignment_crew", { p_assignment_id: assignmentId });
  }

  const CREW_COLUMNS = "id,organization_id,profile_id,legacy_crew_id,first_name,last_name,email,phone,active,eligible_levels,preferences,notes";

  async function getCrewMembers() {
    const db = await client();
    return db.from("crew_members").select(CREW_COLUMNS).order("last_name").order("first_name").order("id");
  }

  async function createCrewMember(changes) {
    const db = await client();
    return db.from("crew_members").insert(changes).select(CREW_COLUMNS).single();
  }

  async function updateCrewMember(crewMemberId, changes) {
    const db = await client();
    return db.from("crew_members").update(changes).eq("id", crewMemberId).select(CREW_COLUMNS).single();
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
      .select("id,organization_id,legacy_location_id,name,address,active")
      .order("name")
      .order("id");
  }

  async function getFields() {
    const db = await client();
    return db.from("fields")
      .select("id,organization_id,location_id,legacy_field_id,name,active")
      .order("name")
      .order("id");
  }

  async function getGames() {
    const db = await client();
    return db.from("games")
      .select("id,organization_id,season_id,location_id,field_id,legacy_game_id,game_date,game_time,timezone,home_team,away_team,level,game_type,lifecycle_status,review,report,source_metadata")
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

  async function importScheduleGames(games) {
    const db = await client();
    return db.rpc("import_schedule_games", { p_games: games });
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
    getRecentActivities,
    updateProfile,
    getPendingUmpireProfiles,
    approveUmpireProfile,
    rejectUmpireProfile,
    removeGameAssignmentCrew,
    getLinkedCrewMember,
    getCrewMembers,
    createCrewMember,
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
    importScheduleGames,
    getCrewMembersByIds
  };
})();
