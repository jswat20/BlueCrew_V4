import { test, expect } from "./fixtures/supabase-auth.fixture.js";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const migrationPath = "supabase/migrations/202608140002_pending_umpire_admin_email.sql";
const administrator = (id, organizationId, overrides = {}) => ({
  id, auth_user_id: `auth-${id}`, organization_id: organizationId,
  first_name: "Approval", last_name: "Administrator", email: `${id}@example.com`,
  role: "administrator", status: "approved", communication_preferences: {}, ...overrides
});

test.describe("verified pending-umpire administrator email", () => {
  const sameOrganizationAdmin = administrator("admin-same", "organization-1");
  const otherOrganizationAdmin = administrator("admin-other", "organization-2");
  const assigner = administrator("assigner-same", "organization-1", { role: "assigner" });

  test.use({ supabaseScenario: {
    profileMissingUntilProvision: true,
    organizationProfiles: [sameOrganizationAdmin, otherOrganizationAdmin, assigner]
  } });

  test("verified public provisioning queues exactly one email to the same-organization administrator", async ({ supabaseAuthApp }) => {
    const result = await supabaseAuthApp.page.evaluate(async () => {
      const db = await supabaseClientService.getClient();
      const args = { p_first_name: "New", p_last_name: "Umpire", p_phone: "5550101000", p_birthdate: "2000-01-15" };
      const first = await db.rpc("provision_public_pending_umpire", args);
      const second = await db.rpc("provision_public_pending_umpire", args);
      return { first, second, profile: window.__supabaseFixture.settings.profile,
        events: window.__supabaseFixture.settings.communicationEvents,
        deliveries: window.__supabaseFixture.settings.communicationDeliveries };
    });
    expect(result.first.error).toBeNull();
    expect(result.second.error).toBeNull();
    expect(result.profile).toMatchObject({ role: "umpire", status: "pending" });
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({
      event_type: "account-pending-approval", recipient_profile_id: "admin-same",
      metadata: { pendingName: "New Umpire", pendingEmail: "linked@example.com", actionPath: "accounts" }
    });
    expect(result.deliveries).toEqual([expect.objectContaining({ recipient_profile_id: "admin-same", channel: "email", status: "pending" })]);
    expect(result.events.some(event => ["profile-umpire-1", "admin-other", "assigner-same"].includes(event.recipient_profile_id))).toBe(false);
  });
});

test("migration binds the trigger to the verified public-registration activity and preserves tenant/role boundaries", () => {
  const sql = fs.readFileSync(migrationPath, "utf8");
  expect(sql).toContain("new.metadata ->> 'registrationWorkflow' <> 'public-umpire'");
  expect(sql).toContain("profile.organization_id = pending_profile.organization_id");
  expect(sql).toContain("profile.role = 'administrator'");
  expect(sql).toContain("profile.status = 'approved'");
  expect(sql).not.toMatch(/role\s*=\s*'assigner'/);
  expect(sql).toContain("account-pending-approval:', pending_profile.id, ':', administrator_profile.id");
  expect(sql).toContain("p_channels => array['email']");
  expect(sql).toContain("after insert on public.activities");
});

test("transactional email renders the administrator action, pending name, and verified email", async () => {
  const templateUrl = pathToFileURL(path.resolve("supabase/functions/_shared/communication-template.mjs")).href;
  const { renderCommunicationEmail } = await import(templateUrl);
  const message = renderCommunicationEmail({
    event_type: "account-pending-approval", recipient_display_name: "Approval Administrator",
    metadata: { pendingName: "New Umpire", pendingEmail: "verified@example.com", actionPath: "accounts" },
    organization_settings: {}
  }, { appUrl: "https://app.worktheslate.com" });
  expect(message.subject).toContain("Umpire Awaiting Approval");
  expect(message.text).toContain("verified their email");
  expect(message.text).toContain("Umpire: New Umpire");
  expect(message.text).toContain("Verified Email: verified@example.com");
  expect(message.text).toContain("Review Pending Accounts: https://app.worktheslate.com/accounts");
  expect(message.html).toContain("Review Pending Accounts");
});

test("existing approval and account-approved communication remain present after pending-email migration", () => {
  const approval = fs.readFileSync("supabase/migrations/202608130002_approval_identity_link_order.sql", "utf8");
  expect(approval).toContain("p_type => 'account-approved'");
  expect(approval).toContain("p_business_idempotency_key => concat('account-approved:', target_profile.id)");
  expect(approval).toContain("update public.profiles set status = 'approved'");
});

test("zero/multiple eligible organization and pending-data RLS guards remain unchanged", () => {
  const registration = fs.readFileSync("supabase/migrations/202608130001_public_umpire_registration_and_approval.sql", "utf8");
  const rls = fs.readFileSync("supabase/migrations/202608040002_rls.sql", "utf8");
  expect(registration).toContain("eligible_organization_count <> 1");
  expect(registration).toContain("email_confirmed_at is null");
  expect(rls).toContain("public.is_approved_account()");
});
