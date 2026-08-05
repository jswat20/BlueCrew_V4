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
    updateProfile,
    getLinkedCrewMember,
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
    getCrewMembersByIds
  };
})();
