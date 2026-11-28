const facilityService = (() => {
  let state = { facilities: [], fields: [], availability: [], closures: [], reservations: [], loaded: false };
  const clean = value => String(value ?? "").trim();
  const sports = value => [...new Set(String(value || "").split(",").map(item => item.trim().toLowerCase()).filter(Boolean))];
  const messageFor = error => {
    const value = clean(error?.message);
    const messages = {
      administrator_required: "Administrator access is required.", reservation_conflict: "That resource is already reserved during this time.",
      reservation_outside_availability: "This reservation is outside the resource's availability.", reservation_module_not_enabled: "Reservation management is not enabled for this workspace.",
      reservation_blocked_by_closure: "A closure blocks this reservation.", field_unavailable: "This resource is not operational.",
      reservation_must_fit_single_local_day: "Reservations must start and end on the same local day."
    };
    return messages[value] || value || "The facility operation could not be completed.";
  };
  async function load() {
    try {
      const results = await Promise.all([
        supabaseSharedRepository.getLocations(), supabaseSharedRepository.getFields(),
        supabaseSharedRepository.getFieldAvailabilityRules(), supabaseSharedRepository.getFieldClosures(),
        supabaseSharedRepository.getFieldReservations()
      ]);
      const failure = results.find(result => result.error);
      if (failure) throw failure.error;
      state = { facilities: results[0].data || [], fields: results[1].data || [], availability: results[2].data || [], closures: results[3].data || [], reservations: results[4].data || [], loaded: true };
      return { success: true };
    } catch (error) {
      if (typeof operationalMonitoringService !== "undefined") void operationalMonitoringService.captureFailure("facility", "facility.load", error, { workflow: "facility_directory" });
      return { success: false, message: messageFor(error) };
    }
  }
  const snapshot = () => structuredClone(state);
  const clear = () => { state = { facilities: [], fields: [], availability: [], closures: [], reservations: [], loaded: false }; };
  async function run(action, successMessage, operation = "facility.mutation") {
    try {
      const result = await action();
      if (result.error) throw result.error;
      await load();
      await locationService.loadSharedLocations();
      return { success: true, message: successMessage };
    } catch (error) {
      if (typeof operationalMonitoringService !== "undefined") void operationalMonitoringService.captureFailure("facility", operation, error, { workflow: "facility_scheduling" });
      return { success: false, message: messageFor(error) };
    }
  }
  const facilityValues = form => ({
    id: form.id || null, name: clean(form.name), address: clean(form.address), timezone: clean(form.timezone) || "America/New_York",
    supportedSports: sports(form.supportedSports), status: form.status || "operational", notes: clean(form.notes)
  });
  const fieldValues = form => ({
    id: form.id || null, facilityId: form.facilityId, name: clean(form.name), resourceType: clean(form.resourceType) || "other", supportedSports: sports(form.supportedSports),
    status: form.status || "operational", minimumAge: form.minimumAge ? Number(form.minimumAge) : null,
    maximumAge: form.maximumAge ? Number(form.maximumAge) : null, divisionNotes: clean(form.divisionNotes)
  });
  return {
    load, snapshot, clear,
    saveFacility(form) { const values = facilityValues(form); return run(() => values.id ? supabaseSharedRepository.updateFacility(values) : supabaseSharedRepository.createFacility(values), values.id ? "Facility updated." : "Facility created.", "facility.save"); },
    saveField(form) { const values = fieldValues(form); return run(() => values.id ? supabaseSharedRepository.updateFacilityResource(values) : supabaseSharedRepository.createFacilityResource(values), values.id ? "Resource updated." : "Resource created.", "facility.resource_save"); },
    addAvailability(form) { return run(() => supabaseSharedRepository.createFieldAvailabilityRule(form), "Availability added.", "facility.availability_save"); },
    addClosure(form) { return run(() => supabaseSharedRepository.createFieldClosure(form), "Closure added.", "facility.closure_save"); },
    saveReservation(form) { return run(() => supabaseSharedRepository.saveFieldReservation(form), form.id ? "Reservation rescheduled." : "Reservation created.", "facility.reservation_save"); },
    cancelReservation(id) { return run(() => supabaseSharedRepository.cancelFieldReservation(id), "Reservation cancelled.", "facility.reservation_cancel"); }
  };
})();
