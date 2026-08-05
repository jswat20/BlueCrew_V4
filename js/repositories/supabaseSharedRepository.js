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

  return {
    getProfileForAuthUser,
    updateProfile,
    getLinkedCrewMember,
    getAvailability,
    upsertOwnAvailability,
    deleteAvailabilityDate,
    deleteAvailabilityWindow,
    setOwnAvailabilityRange,
    copyOwnAvailabilityWeek
  };
})();
