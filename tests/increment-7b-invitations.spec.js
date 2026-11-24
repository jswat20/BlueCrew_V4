import fs from "node:fs";
import path from "node:path";
import { test, expect } from "./fixtures/supabase-auth.fixture.js";

const migration=fs.readFileSync(path.join(process.cwd(),"supabase/migrations/20261124015251_secure_workspace_invitations.sql"),"utf8");

test("workspace invitations store only hashes and accept from locked server state",()=>{
  expect(migration).toContain("extensions.gen_random_bytes(32)");
  expect(migration).toContain("token_digest bytea not null unique");
  expect(migration).not.toMatch(/\btoken\s+text\s+not\s+null/i);
  expect(migration).toContain("lower(v_user.email)<>v_invitation.recipient_email");
  expect(migration).toContain("where token_digest=extensions.digest(convert_to(p_token,'utf8'),'sha256') for update");
  expect(migration).toContain("v_invitation.organization_id,v_actor,v_invitation.role_code::public.account_role,'approved'");
  expect(migration).toContain("'workspace.invitation_accepted'");
  expect(migration).toContain("grant execute on function public.accept_workspace_invitation(text) to authenticated");
  expect(migration).not.toMatch(/grant execute on function public\.accept_workspace_invitation\(text\) to anon/);
});

test("invited League Viewers receive an explicit workspace-local scope",()=>{
  const scopeMigration=fs.readFileSync(path.join(process.cwd(),"supabase/migrations/20261124015824_complete_invited_league_viewer_scope.sql"),"utf8");
  expect(scopeMigration).toContain("old.accepted_at is null and new.accepted_at is not null");
  expect(scopeMigration).toContain("organization_id=new.organization_id and auth_user_id=new.accepted_by_auth_user_id");
  expect(scopeMigration).toContain("values(v_profile_id,new.organization_id,true,'{}'::text[])");
  expect(scopeMigration).toContain("revoke all on function private.complete_invited_league_viewer_scope() from public,anon,authenticated");
});

test("invitation lifecycle is bounded, single-use, and auditable",()=>{
  expect(migration).toContain("p_expires_in_hours < 1 or p_expires_in_hours > 168");
  expect(migration).toContain("invitation_rate_limited");
  expect(migration).toContain("invitation_pending_exists");
  expect(migration).toContain("invitation_self_forbidden");
  expect(migration).toContain("invitation_already_accepted");
  expect(migration).toContain("workspace.invitation_revoked");
  expect(migration).toContain("workspace.invitation_expired");
  expect(migration).toContain("workspace.invitation_regenerated");
  expect(migration).toContain("workspace_invitations_no_direct_access");
});

test.describe("hosted invitation workflow",()=>{
  test.use({supabaseScenario:{initialSession:true,profile:{id:"profile-admin",auth_user_id:"auth-admin",organization_id:"organization-1",first_name:"Workspace",last_name:"Admin",email:"admin@example.test",phone:"",role:"administrator",status:"approved",communication_preferences:{}},crewId:null}});

  test("administrator issues a one-time visible link and intended recipient accepts",async({supabaseAuthApp})=>{
    const {page}=supabaseAuthApp;
    await page.evaluate(()=>renderPage("settings"));
    await page.getByTestId("workspace-invitation-issue-form").locator("input[name='email']",{}).fill("recipient@example.test");
    await page.getByTestId("workspace-invitation-issue-form").locator("select[name='role']",{}).selectOption("league_viewer");
    await page.getByTestId("workspace-invitation-issue-form").getByRole("button",{name:"Create invitation"}).click();
    await expect(page.getByTestId("workspace-invitation-secret")).toBeVisible();
    await expect(page.getByTestId("workspace-invitation-row")).toContainText("recipient@example.test");
    await page.evaluate(()=>{
      const link=workspaceInvitationService.snapshot().latestIssuedLink;
      sessionStorage.setItem("slate_workspace_invitation_token",link.split("#invite=")[1]);
      window.__supabaseFixture.settings.profile.email="recipient@example.test";
      renderPage("workspace-invitation");
    });
    await expect(page.getByTestId("workspace-invitation-preview")).toContainText("Invited Fixture Workspace");
    await page.getByTestId("workspace-invitation-accept").click();
    await expect(page.getByTestId("workspace-switcher")).toContainText("Invited Fixture Workspace");
    await expect(page.getByTestId("workspace-switcher-select")).toHaveValue("organization-invited");
  });

  test("wrong recipient is rejected without revealing workspace details",async({supabaseAuthApp})=>{
    const {page}=supabaseAuthApp;
    await page.evaluate(async()=>{
      await workspaceInvitationService.issue({email:"someone-else@example.test",role:"league_viewer",expiresInHours:24});
      const link=workspaceInvitationService.snapshot().latestIssuedLink;
      sessionStorage.setItem("slate_workspace_invitation_token",link.split("#invite=")[1]);
      renderPage("workspace-invitation");
    });
    await expect(page.getByTestId("workspace-invitation-error")).toContainText("verified email address");
    await expect(page.getByTestId("workspace-invitation-preview")).not.toContainText("Invited Fixture Workspace");
    await expect(page.getByTestId("workspace-invitation-accept")).toBeDisabled();
  });
});
