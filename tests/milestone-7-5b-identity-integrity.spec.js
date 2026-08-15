import { test, expect } from "./fixtures/supabase-auth.fixture.js";
import fs from "fs";

const admin = { id:"admin-profile",auth_user_id:"admin-auth",organization_id:"organization-1",first_name:"Admin",last_name:"User",email:"admin@example.com",phone:"",role:"administrator",status:"approved",communication_preferences:{} };
const crew = { id:"crew-1",organization_id:"organization-1",profile_id:"admin-profile",first_name:"Test",last_name:"Umpire",email:"contact@example.com",phone:"",active:true,eligible_levels:["8U"],preferences:{},notes:"" };

test.describe("Milestone 7.5B identity integrity", () => {
  test.use({ supabaseScenario: { profile: admin, crewId: null, crewMembers:[crew], identityDiagnostics:[{ crew_member_id:"crew-1",linked_profile_id:"admin-profile",linkage_status:"conflict",linked_role:"administrator",linked_status:"approved",login_email:"admin@example.com",contact_email:"contact@example.com",conflict_code:"role_incompatible" }], initialSession:true } });

  test("roster presents a trusted role conflict and separates Login Email from Contact Email", async ({ supabaseAuthApp }) => {
    await supabaseAuthApp.page.goto("/");
    await expect(supabaseAuthApp.page.getByRole("heading", { name: /Good (?:Morning|Afternoon|Evening), Admin User/ })).toBeVisible();
    const model = await supabaseAuthApp.page.evaluate(() => getCrewCardModel("crew-1"));
    expect(model.identityStatus).toBe("conflict");
    expect(model.loginEmail).toBe("admin@example.com");
    expect(model.email).toBe("contact@example.com");
    await supabaseAuthApp.page.evaluate(() => openCrewCredentialCard("crew-1"));
    await expect(supabaseAuthApp.page.getByTestId("crew-card-identity-status")).toHaveText("Identity Conflict");
    await expect(supabaseAuthApp.page.getByTestId("crew-card-login-email")).toHaveText("admin@example.com");
    await expect(supabaseAuthApp.page.getByTestId("crew-card-password-reset")).toBeDisabled();
  });

  test("migration provides admin-only diagnostics, compatible link validation, uniqueness, and audit", () => {
    const sql = fs.readFileSync("supabase/migrations/202608110001_identity_linkage_integrity.sql", "utf8");
    expect(sql).toContain("crew_members_profile_id_unique");
    expect(sql).toContain("list_crew_identity_diagnostics");
    expect(sql).toContain("list_linkable_umpire_profiles");
    expect(sql).toContain("manage_crew_login_identity");
    expect(sql).toContain("target.role <> 'umpire'");
    expect(sql).toContain("target.status <> 'approved'");
    expect(sql).toContain("identity_profile_already_linked");
    expect(sql).toContain("crew_identity_");
    expect(sql).toContain("public.is_administrator()");
  });

  test("password reset worker blocks questionable linkage and uses Auth email", () => {
    const source = fs.readFileSync("supabase/functions/send-account-password-reset/index.ts", "utf8");
    expect(source).toContain("target.role !== \"umpire\"");
    expect(source).toContain("links.length !== 1");
    expect(source).toContain("admin.auth.admin.getUserById");
    expect(source).toContain("authTarget.user.email");
    expect(source).not.toContain("resetPasswordForEmail(target.email");
  });

  test("ordinary administrator onboarding no longer exposes invitation-code UI", async ({ supabaseAuthApp }) => {
    await supabaseAuthApp.page.goto("/");
    await expect(supabaseAuthApp.page.getByRole("heading", { name: /Good (?:Morning|Afternoon|Evening), Admin User/ })).toBeVisible();
    await supabaseAuthApp.page.getByTestId("nav-accounts").click();
    await expect(supabaseAuthApp.page.getByTestId("create-registration-invitation")).toHaveCount(0);
    await expect(supabaseAuthApp.page.getByTestId("registration-invitation-code")).toHaveCount(0);
    const call = await supabaseAuthApp.page.evaluate(() => window.__supabaseFixture.calls.find(item => item.operation === "rpc" && item.name === "create_umpire_invitation"));
    expect(call).toBeUndefined();
  });
});
