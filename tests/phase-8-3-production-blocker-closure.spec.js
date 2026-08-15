import { test, expect } from "./fixtures/supabase-auth.fixture.js";
import fs from "node:fs";

const administrator = {
  id: "profile-admin-1", auth_user_id: "auth-admin-1", organization_id: "organization-1",
  first_name: "Avery", last_name: "Admin", email: "admin@example.com",
  role: "administrator", status: "approved", communication_preferences: {}
};
const approvedUmpire = {
  id: "profile-approved-1", auth_user_id: "auth-approved-1", organization_id: "organization-1",
  first_name: "Approved", last_name: "Umpire", email: "login@example.com", login_email: "login@example.com",
  role: "umpire", status: "approved", communication_preferences: {}, approved_at: "2026-08-12T00:00:00Z"
};
const linkedCrew = {
  id: "crew-approved-1", organization_id: "organization-1", profile_id: "profile-approved-1",
  first_name: "Approved", last_name: "Umpire", email: "contact@example.com", phone: "",
  active: true, eligible_levels: ["8U"], preferences: {}, notes: ""
};

test.describe("Phase 8.3 administrative account hydration", () => {
  test.use({ supabaseScenario: {
    initialSession: true, profile: administrator, crewId: null,
    manageableAccounts: [administrator, approvedUmpire], crewMembers: [linkedCrew]
  } });

  test("administrator sees a same-organization approved linked umpire with authoritative identity", async ({ supabaseAuthApp }) => {
    const { page, calls } = supabaseAuthApp;
    await page.evaluate(() => renderPage("accounts"));
    await page.getByTestId("account-filter-approved").click();
    await expect(page.getByText("Avery Admin", { exact: true })).toHaveCount(1);
    await expect(page.getByTestId("approved-account-profile-approved-1")).toBeVisible();
    await expect(page.getByTestId("send-password-reset-profile-approved-1")).toBeVisible();
    const account = await page.evaluate(() => accountService.getById("profile-approved-1"));
    expect(account).toMatchObject({ email: "login@example.com", loginEmail: "login@example.com", contactEmail: "contact@example.com", crewId: "crew-approved-1", identityStatus: "linked" });
    expect((await calls()).some(call => call.operation === "rpc" && call.name === "list_manageable_accounts")).toBe(true);
  });
});

test("approval transition enqueues canonical account-approved in-app and email deliveries", () => {
  const sql = fs.readFileSync("supabase/migrations/202608120003_production_blocker_closure.sql", "utf8");
  expect(sql).toContain("create or replace function public.list_manageable_accounts()");
  expect(sql).toContain("p_type => 'account-approved'");
  expect(sql).toContain("p_business_idempotency_key => concat('account-approved:', target_profile.id)");
  expect(sql).toContain("array['in_app','email']::public.communication_channel[]");
});

test("trusted password reset worker can read authoritative identity linkage", () => {
  const sql = fs.readFileSync("supabase/migrations/202608120004_password_reset_service_role_reads.sql", "utf8");
  expect(sql).toContain("grant select on table public.profiles to service_role");
  expect(sql).toContain("grant select on table public.crew_members to service_role");
});
