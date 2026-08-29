import { test, expect } from "./fixtures/supabase-auth.fixture.js";
import fs from "node:fs";
import path from "node:path";

const migration = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/202608290001_public_account_role_requests.sql"), "utf8");
const authorizationHotfix = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/202608290002_public_account_role_requests_fail_closed.sql"), "utf8");

test.describe("public account request form", () => {
  test("requires an explicit account type and conditionally requires DOB", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    await page.getByTestId("registration-toggle").click();
    const role = page.getByTestId("account-requested-role");
    const dob = page.getByTestId("account-birthdate");
    await expect(role).toHaveValue("");
    await expect(dob).toBeHidden();
    await role.selectOption("umpire");
    await expect(dob).toBeVisible();
    await expect(dob).toHaveAttribute("required", "");
    await role.selectOption("league_viewer");
    await expect(dob).toBeHidden();
    await expect(dob).not.toHaveAttribute("required", "");
    await role.selectOption("administrator");
    await expect(dob).toBeHidden();
  });

  test("rejects submission without a type or matching password confirmation", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    await page.getByTestId("registration-toggle").click();
    await page.getByTestId("create-account-button").click();
    await expect(page.getByTestId("account-registration-message")).toHaveText("Select the account type you are requesting.");
    await page.getByTestId("account-requested-role").selectOption("administrator");
    await page.getByTestId("account-password").fill("one-password");
    await page.getByTestId("account-password-confirmation").fill("different-password");
    await page.getByTestId("create-account-button").click();
    await expect(page.getByTestId("account-registration-message")).toHaveText("Enter matching passwords.");
    expect((await supabaseAuthApp.calls()).some(call => call.operation === "signUp")).toBe(false);
  });

  test("remains contained at 390px", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByTestId("registration-toggle").click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });

  for (const requestedRole of ["league_viewer", "administrator"]) {
    test(`${requestedRole} request submits a null DOB and remains pending`, async ({ supabaseAuthApp }) => {
      const result = await supabaseAuthApp.page.evaluate(role => accountService.registerAuthenticatedAccount({
        firstName: "Role", lastName: "Requester", email: `${role}@example.com`, phone: "", password: "password1234", requestedRole: role
      }), requestedRole);
      expect(result).toMatchObject({ success: true, data: { status: "pending", role: "umpire", requestedRole } });
      const call = (await supabaseAuthApp.calls()).find(item => item.name === "provision_public_pending_account");
      expect(call.args).toMatchObject({ p_requested_role: requestedRole, p_birthdate: null });
    });
  }

  test("umpire request preserves minimum-age validation", async ({ supabaseAuthApp }) => {
    const result = await supabaseAuthApp.page.evaluate(() => accountService.registerAuthenticatedAccount({
      firstName: "Young", lastName: "Umpire", email: "young@example.com", password: "password1234",
      birthdate: new Date().toISOString().slice(0, 10), requestedRole: "umpire"
    }));
    expect(result).toMatchObject({ success: false, message: "minimum_age_13_required" });
  });

  test("tampered and missing requested roles fail closed before privilege exists", async ({ supabaseAuthApp }) => {
    for (const requestedRole of ["", "assigner", "super_admin"]) {
      const result = await supabaseAuthApp.page.evaluate(role => accountService.registerAuthenticatedAccount({
        firstName: "Tampered", lastName: "Request", email: `${role || "missing"}@example.com`, password: "password1234", requestedRole: role
      }), requestedRole);
      expect(result.success).toBe(false);
    }
  });
});

test.describe("role-aware administrative approval", () => {
  const admin = { id: "admin", auth_user_id: "admin-auth", organization_id: "organization-1", first_name: "Admin", last_name: "User", email: "admin@example.com", role: "administrator", status: "approved", communication_preferences: {} };
  for (const requestedRole of ["league_viewer", "administrator"]) {
    test.describe(requestedRole, () => {
      test.use({ supabaseScenario: { initialSession: true, profile: admin, crewId: null, pendingProfiles: [{ id: `pending-${requestedRole}`, auth_user_id: `auth-${requestedRole}`, organization_id: "organization-1", role: "umpire", requested_role: requestedRole, status: "pending", first_name: "Pending", last_name: "Person", email: `${requestedRole}@example.com`, phone: "", birthdate: null, created_at: "2026-08-29T00:00:00Z" }] } });
      test(`approves ${requestedRole} without creating Crew identity`, async ({ supabaseAuthApp }) => {
        const { page } = supabaseAuthApp;
        await page.evaluate(async () => { await loginService.loginWithPassword("admin@example.com", "password"); renderPage("accounts"); });
        if (requestedRole === "league_viewer") await page.getByTestId(`account-scope-pending-${requestedRole}`).selectOption("all");
        if (requestedRole === "administrator") await page.getByTestId(`account-role-confirm-pending-${requestedRole}`).check();
        await page.getByTestId(`approve-account-pending-${requestedRole}`).click();
        const state = await page.evaluate(() => window.__supabaseFixture.settings);
        expect(state.pendingProfiles[0]).toMatchObject({ role: requestedRole, status: "approved" });
        expect(state.crewMembers).toHaveLength(0);
        if (requestedRole === "league_viewer") expect(state.leagueViewerScopes).toEqual([expect.objectContaining({ all_divisions: true, division_levels: [] })]);
      });
    });
  }
});

test.describe("migration security contract", () => {
  test("separates requested role from authorization role and validates the request", () => {
    expect(migration).toContain("add column requested_role public.account_role");
    expect(migration).toContain("values (\n    eligible_organization_id, auth.uid(), 'umpire', requested, 'pending'");
    expect(migration).toContain("valid_requested_account_type_required");
    expect(migration).toContain("requested_role_is_server_managed");
  });
  test("enforces role-aware approval, scope, self-approval denial, and personnel lifecycle", () => {
    expect(migration).toContain("self_approval_not_permitted");
    expect(migration).toContain("league_viewer_scope_required");
    expect(migration).toContain("insert into public.league_viewer_scopes");
    expect(migration).toContain("return public.approve_pending_umpire(target.id)");
    expect(migration).not.toMatch(/insert into public\.crew_members[\s\S]*requested = 'league_viewer'/);
  });
  test("keeps all trusted functions authenticated and organization scoped", () => {
    expect(migration).toContain("where id = p_target_profile_id and organization_id = actor_org for update");
    expect(migration).toContain("if not public.is_administrator()");
    expect(migration).toContain("grant execute on function public.approve_pending_account");
    expect(migration).toContain("revoke all on function public.provision_public_pending_account");
  });

  test("fails closed when administrator authorization resolves to NULL", () => {
    expect(authorizationHotfix).toContain("create or replace function public.protect_requested_account_role");
    expect(authorizationHotfix).toContain("create or replace function public.approve_pending_account");
    expect(authorizationHotfix).toContain("create or replace function public.reject_pending_account");
    expect(authorizationHotfix).toContain("create or replace function public.list_manageable_accounts");
    expect(authorizationHotfix.match(/public\.is_administrator\(\) is not true/g)).toHaveLength(4);
    expect(authorizationHotfix).not.toMatch(/\bnot\s+public\.is_administrator\(\)/i);
  });
});
