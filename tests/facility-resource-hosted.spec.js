import { test, expect } from "./fixtures/supabase-auth.fixture.js";

const administrator = {
  id: "profile-resource-admin",
  auth_user_id: "auth-resource-admin",
  organization_id: "organization-1",
  first_name: "Resource",
  last_name: "Administrator",
  email: "resource-admin@example.com",
  phone: "",
  role: "administrator",
  status: "approved"
};

test.use({
  supabaseScenario: {
    profile: administrator,
    initialSession: true,
    locations: [{ id: "facility-1", organization_id: "organization-1", name: "Community Center", address: "", timezone: "America/New_York", status: "operational", supported_sports: [], notes: "", active: true }],
    fields: []
  }
});

test("administrator creates and reloads a typed bookable resource", async ({ supabaseAuthApp }) => {
  const result = await supabaseAuthApp.page.evaluate(async () => {
    await facilityService.load();
    const saved = await facilityService.saveField({
      facilityId: "facility-1",
      name: "Court 1",
      resourceType: "pickleball_court",
      supportedSports: "pickleball",
      status: "operational"
    });
    return { saved, catalog: facilityService.snapshot() };
  });

  expect(result.saved).toEqual(expect.objectContaining({ success: true, message: "Resource created." }));
  expect(result.catalog.fields).toEqual([
    expect.objectContaining({ name: "Court 1", resource_type: "pickleball_court", supported_sports: ["pickleball"] })
  ]);
  const calls = await supabaseAuthApp.calls();
  expect(calls).toEqual(expect.arrayContaining([
    expect.objectContaining({ operation: "rpc", name: "create_facility_resource" })
  ]));
});
