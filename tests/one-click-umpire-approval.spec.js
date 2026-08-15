import { test, expect } from "./fixtures/supabase-auth.fixture.js";

const administrator = {
  id: "admin-profile", auth_user_id: "admin-auth", organization_id: "organization-1",
  first_name: "Admin", last_name: "User", email: "admin@example.com",
  role: "administrator", status: "approved", communication_preferences: {}
};
const pending = {
  id: "legacy-pending", auth_user_id: "legacy-auth", organization_id: "organization-1",
  first_name: "Legacy", last_name: "Applicant", email: "legacy@example.com", phone: "5550109000",
  role: "umpire", status: "pending", communication_preferences: {}, created_at: "2026-08-01T00:00:00.000Z"
};
const crew = (overrides = {}) => ({
  id: "existing-crew", organization_id: "organization-1", profile_id: null,
  first_name: "Existing", last_name: "Crew", email: "legacy@example.com", phone: "",
  active: true, eligible_levels: ["12U"], preferences: {}, notes: "", ...overrides
});

test.describe("one-click umpire approval", () => {
  test.use({ supabaseScenario: { initialSession: true, profile: administrator, crewId: null, pendingProfiles: [{ ...pending }], crewMembers: [] } });

  test("legacy pending registration creates and links exactly one Crew record and retries idempotently", async ({ supabaseAuthApp }) => {
    const result = await supabaseAuthApp.page.evaluate(async () => {
      const first = await accountService.approveAuthenticatedAccount("legacy-pending");
      const retry = await accountService.approveAuthenticatedAccount("legacy-pending");
      const state = window.__supabaseFixture.settings;
      return { first, retry, crew: state.crewMembers, profile: state.pendingProfiles[0], notifications: state.notifications, events: state.communicationEvents };
    });
    expect(result.first.success).toBe(true);
    expect(result.retry.success).toBe(true);
    expect(result.crew).toHaveLength(1);
    expect(result.crew[0]).toMatchObject({ profile_id: "legacy-pending", first_name: "Legacy", last_name: "Applicant", email: "legacy@example.com", phone: "5550109000", active: true, eligible_levels: [], preferences: {}, notes: "" });
    expect(result.profile.status).toBe("approved");
    expect(result.notifications.filter(item => item.type === "account-approved")).toHaveLength(1);
    expect(result.events.filter(item => item.event_type === "account-approved")).toHaveLength(1);
  });

  test("public registration ignores attempted organization, role, status, and Crew injection", async ({ supabaseAuthApp }) => {
    await supabaseAuthApp.page.evaluate(() => accountService.registerAuthenticatedAccount({
      firstName: "Public", lastName: "Applicant", email: "public@example.com", phone: "5550109010", birthdate: "2000-01-15", password: "password1234",
      organizationId: "attacker-organization", role: "administrator", status: "approved", crewId: "attacker-crew"
    }));
    const call = (await supabaseAuthApp.calls()).find(item => item.name === "provision_public_pending_umpire");
    expect(call.args).toEqual({ p_first_name: "Public", p_last_name: "Applicant", p_phone: "5550109010", p_birthdate: "2000-01-15" });
  });
});

for (const scenario of [
  { name: "uses one active unlinked exact-email Crew match", rows: [crew()], success: true, expectedCrew: 1 },
  { name: "fails closed for duplicate exact-email Crew matches", rows: [crew(), crew({ id: "duplicate-crew" })], message: "Multiple Crew records use this verified email. Resolve the duplicate Crew records before approval." },
  { name: "fails closed for an inactive exact-email Crew match", rows: [crew({ active: false })], message: "The matching Crew record is inactive. Review and reactivate it before approval." },
  { name: "fails closed for an exact-email Crew match linked elsewhere", rows: [crew({ profile_id: "another-profile" })], message: "A Crew record with this verified email is already linked to another account." },
  { name: "does not match name-only or phone-only Crew records", rows: [crew({ email: "different@example.com", first_name: "Legacy", last_name: "Applicant", phone: "5550109000" })], success: true, expectedCrew: 2 }
]) {
  test.describe(scenario.name, () => {
    test.use({ supabaseScenario: { initialSession: true, profile: administrator, crewId: null, pendingProfiles: [{ ...pending }], crewMembers: scenario.rows } });
    test(scenario.name, async ({ supabaseAuthApp }) => {
      const result = await supabaseAuthApp.page.evaluate(async () => {
        const before = window.__supabaseFixture.settings.crewMembers.length;
        const approval = await accountService.approveAuthenticatedAccount("legacy-pending");
        const state = window.__supabaseFixture.settings;
        return { approval, before, crew: state.crewMembers, profile: state.pendingProfiles[0], notifications: state.notifications };
      });
      if (scenario.success) {
        expect(result.approval.success).toBe(true);
        expect(result.crew).toHaveLength(scenario.expectedCrew);
        expect(result.crew.filter(item => item.profile_id === "legacy-pending")).toHaveLength(1);
      } else {
        expect(result.approval).toMatchObject({ success: false, message: scenario.message });
        expect(result.crew).toHaveLength(result.before);
        expect(result.profile.status).toBe("pending");
        expect(result.notifications).toHaveLength(0);
      }
    });
  });
}
