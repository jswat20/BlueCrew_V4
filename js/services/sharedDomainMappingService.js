const sharedDomainMappingService = (() => {
  function mapProfile(profile, crewId = null) {
    if (!profile) return null;
    return {
      id: profile.id,
      authUserId: profile.auth_user_id,
      organizationId: profile.organization_id,
      firstName: profile.first_name || "",
      lastName: profile.last_name || "",
      email: profile.email || "",
      phone: profile.phone || "",
      homePhone: profile.home_phone || "",
      address: profile.address || "",
      contactPreference: profile.contact_preference || "text",
      birthdate: profile.birthdate || "",
      emergencyContact: profile.emergency_contact || "",
      emergencyContactPhone: profile.emergency_contact_phone || "",
      officialHistory: profile.official_history || [],
      yearsOfServiceOverride: profile.years_of_service_override ?? null,
      adminNotes: profile.admin_notes || "",
      communicationPreferences: profile.communication_preferences || {},
      role: profile.role,
      status: profile.status,
      crewId,
      crewCode: profile.crew_code || "",
      crewCodeIssuedAt: profile.crew_code_issued_at || null,
      approvedAt: profile.approved_at || null,
      rejectedAt: profile.rejected_at || null,
      lastLogin: profile.last_login_at || null,
      createdAt: profile.created_at
    };
  }

  function mapCrewMember(row) {
    if (!row) return null;
    return {
      id: row.id,
      organizationId: row.organization_id,
      profileId: row.profile_id,
      legacyCrewId: row.legacy_crew_id || null,
      firstName: row.first_name || "",
      lastName: row.last_name || "",
      email: row.email || "",
      phone: row.phone || "",
      active: row.active !== false,
      levels: Array.isArray(row.eligible_levels) ? [...row.eligible_levels] : [],
      preferences: row.preferences || {},
      notes: row.notes || ""
    };
  }

  function mapAvailability(row) {
    if (!row) return null;
    return {
      id: row.id,
      crewId: row.crew_member_id,
      organizationId: row.organization_id,
      date: row.availability_date,
      status: row.status,
      startTime: row.starts_at ? String(row.starts_at).slice(0, 5) : "",
      endTime: row.ends_at ? String(row.ends_at).slice(0, 5) : ""
    };
  }

  function mapLocation(row) {
    if (!row) return null;
    return {
      id: row.id,
      organizationId: row.organization_id,
      legacyLocationId: row.legacy_location_id || null,
      name: row.name || "",
      address: row.address || "",
      active: row.active !== false
    };
  }

  function mapField(row) {
    if (!row) return null;
    return {
      id: row.id,
      organizationId: row.organization_id,
      locationId: row.location_id,
      legacyFieldId: row.legacy_field_id || null,
      name: row.name || "",
      active: row.active !== false
    };
  }

  function mapAssignment(row, claims = []) {
    if (!row) return null;
    const orderedClaims = [...claims].sort((left, right) =>
      `${left.claimed_at || ""}\u0000${left.id}`.localeCompare(`${right.claimed_at || ""}\u0000${right.id}`)
    );
    const pendingClaim = orderedClaims.find(claim => claim.status === "pending") || null;
    const processedClaim = [...orderedClaims].reverse().find(claim => ["approved", "rejected"].includes(claim.status)) || null;
    return {
      id: row.id,
      gameId: row.game_id,
      legacyAssignmentId: row.legacy_assignment_id || null,
      position: row.position || "",
      status: row.status,
      crewId: row.assigned_crew_member_id || "",
      locked: row.locked === true || row.status === "locked",
      claimedBy: pendingClaim?.claimant_crew_member_id || "",
      claimId: pendingClaim?.id || processedClaim?.id || "",
      claimStatus: pendingClaim?.status || processedClaim?.status || "",
      claimProcessed: Boolean(processedClaim),
      claimProcessedAt: processedClaim?.decided_at || null,
      acceptedAt: row.accepted_at || null,
      declinedAt: row.declined_at || null,
      declineReason: row.decline_reason || ""
    };
  }

  function mapGame(row, { location = null, field = null, assignments = [], claimsByAssignment = new Map() } = {}) {
    if (!row) return null;
    const mappedAssignments = assignments
      .map(assignment => mapAssignment(assignment, claimsByAssignment.get(assignment.id) || []))
      .filter(Boolean)
      .sort((left, right) => `${left.position}\u0000${left.id}`.localeCompare(`${right.position}\u0000${right.id}`));
    // Legacy game.crewId reflects the first persisted assignment only; the
    // complete authoritative assignment list remains available on assignments.
    const primary = mappedAssignments[0] || null;
    const report =
      row.report &&
      typeof row.report === "object" &&
      !Array.isArray(row.report)
        ? structuredClone(row.report)
        : {};
    const completion =
      report.completion &&
      typeof report.completion === "object" &&
      !Array.isArray(report.completion)
        ? report.completion
        : {};
    return {
      id: row.id,
      legacyGameId: row.legacy_game_id || null,
      organizationId: row.organization_id,
      seasonId: row.season_id,
      locationId: row.location_id,
      fieldId: row.field_id,
      date: row.game_date,
      time: row.game_time ? String(row.game_time).slice(0, 5) : "",
      timezone: row.timezone || "America/New_York",
      homeTeam: row.home_team || "",
      awayTeam: row.away_team || "",
      level: row.level || "",
      gameType: row.game_type || "single",
      status: row.lifecycle_status,
      lifecycleStatus: row.lifecycle_status,
      locationComplex: location?.name || "",
      locationField: field?.name || "",
      field: field?.name || "",
      venue: location?.name || "",
      assignments: mappedAssignments,
      crewId: primary?.crewId || "",
      assignmentStatus: primary?.status || "needs_assignment",
      review: row.review || {},
      report,
      reports: report,
      completed: completion.completed === true,
      completionTime: completion.completionTime || null,
      completedBy:
        completion.completedBy ||
        completion.completedByProfileId ||
        "",
      completionStatus:
        completion.completionStatus ||
        (completion.completed === true
          ? "completed"
          : "incomplete"),
      awayScore:
        completion.awayScore === null ||
        completion.awayScore === undefined
          ? null
          : Number(completion.awayScore),
      homeScore:
        completion.homeScore === null ||
        completion.homeScore === undefined
          ? null
          : Number(completion.homeScore),
      sourceMetadata: row.source_metadata || {},
      sharedHydrated: true
    };
  }

  return { mapProfile, mapCrewMember, mapAvailability, mapLocation, mapField, mapAssignment, mapGame };
})();
