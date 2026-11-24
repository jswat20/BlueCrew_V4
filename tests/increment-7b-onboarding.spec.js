import fs from "node:fs";
import path from "node:path";
import { test, expect } from "./fixtures/supabase-auth.fixture.js";

const root = process.cwd();

test("self-service workspace provisioning remains narrow and audited", () => {
  const sql = fs.readFileSync(path.join(root,"supabase/migrations/20261124013000_self_service_workspace_onboarding.sql"),"utf8");
  expect(sql).toContain("v_auth_user_id uuid := (select auth.uid())");
  expect(sql).toContain("email_confirmed_at is null");
  expect(sql).toContain("pg_advisory_xact_lock");
  expect(sql).toContain("workspace_creation_rate_limited");
  expect(sql).toContain("'workspace.self_service_created'");
  expect(sql).toContain("grant execute on function public.create_customer_workspace(text,text,text,text[]) to authenticated");
  expect(sql).not.toMatch(/grant execute on function public\.create_customer_workspace[^;]+ to anon/);
  expect(sql).toContain("private.has_membership_role(v_organization_id,array['administrator'])");
});

test.describe("hosted onboarding client", () => {
  test.use({ supabaseScenario: { initialSession: true, workspaces: [] } });

  test("verified user with no workspace can create one and become administrator", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    await expect(page.getByTestId("workspace-onboarding-page")).toBeVisible();
    await page.locator("[name='name']").fill("Synthetic Softball Customer");
    await expect(page.locator("[name='slug']")).toHaveValue("synthetic-softball-customer");
    await page.getByLabel("Tournament Management").check();
    await page.getByTestId("workspace-onboarding-submit").click();
    await expect(page.getByTestId("workspace-switcher")).toContainText("Synthetic Softball Customer");
    await expect(page.getByTestId("active-workspace-modules")).toContainText("League");
    await expect(page.getByTestId("active-workspace-modules")).toContainText("Tournament");
    const calls = await supabaseAuthApp.calls();
    expect(calls.some(call => call.name === "create_customer_workspace" && call.args.p_enabled_modules.includes("tournament"))).toBe(true);
  });
});
