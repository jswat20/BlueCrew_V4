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

  return { mapProfile, mapCrewMember, mapAvailability };
})();
