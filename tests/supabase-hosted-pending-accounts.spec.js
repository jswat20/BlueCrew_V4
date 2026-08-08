import { test, expect } from "./fixtures/supabase-auth.fixture.js";

const admin = { id:"admin-profile",auth_user_id:"admin-auth",organization_id:"organization-1",first_name:"Admin",last_name:"User",email:"admin@example.com",role:"administrator",status:"approved",communication_preferences:{} };
const pending = (id, first, created, organization="organization-1") => ({ id,organization_id:organization,role:"umpire",status:"pending",first_name:first,last_name:"Pending",email:`${first.toLowerCase()}@example.com`,phone:"",created_at:created });
const crew = id => ({ id,organization_id:"organization-1",profile_id:null,first_name:id,last_name:"Crew",email:"",phone:"",active:true,eligible_levels:["12U"],preferences:{},notes:"" });

test.describe("Hosted pending account administration", () => {
  test.use({ supabaseScenario: { profile:admin,crewId:null,pendingProfiles:[pending("pending-b","Second","2026-02-02"),pending("pending-a","First","2026-01-01"),pending("other","Other","2025-01-01","organization-2")],crewMembers:[crew("crew-a"),crew("crew-b")] } });

  test("loads an ordered organization queue and supports consecutive decisions", async ({ supabaseAuthApp }) => {
    const { page, calls } = supabaseAuthApp;
    const state = await page.evaluate(async () => { const login=await loginService.loginWithPassword("admin@example.com","password"); renderPage("operations-center"); return {login,ids:accountService.getPendingAccounts().map(item=>item.id)}; });
    expect(state.login.success).toBe(true);
    expect(state.ids).toEqual(["pending-a","pending-b"]);
    await page.getByTestId("operations-metric-pending-accounts").click();
    const dialog=page.getByTestId("operations-detail-pending-accounts");
    const first=dialog.locator('[data-operations-pending-account="pending-a"]');
    await first.getByTestId("operations-pending-account-crew").selectOption("crew-a");
    await first.locator('[data-operations-quick-action="approve-account"]').click();
    await expect(dialog).toBeVisible();
    await dialog.locator('[data-operations-pending-account="pending-b"] [data-operations-quick-action="reject-account"]').click();
    await expect(dialog).not.toBeVisible();
    const rpcCalls=(await calls()).filter(call=>call.operation==="rpc");
    expect(rpcCalls.find(call=>call.name==="approve_umpire_profile")?.args.p_target_crew_member_id).toBe("crew-a");
    expect(rpcCalls.some(call=>call.name==="reject_umpire_profile")).toBe(true);
    const effects=await page.evaluate(()=>({notifications:window.__supabaseFixture.settings.notifications.map(item=>item.type),activities:window.__supabaseFixture.settings.activities.map(item=>item.action),crew:window.__supabaseFixture.settings.crewMembers.find(item=>item.id==="crew-a")?.profile_id}));
    expect(effects).toEqual({notifications:["account-approved","account-rejected"],activities:["account_approved","account_rejected"],crew:"pending-a"});
  });
});

test.describe("Hosted pending account failures",()=>{
  test.use({supabaseScenario:{profile:admin,crewId:null,pendingProfiles:[pending("pending-fail","Failure","2026-01-01")],crewMembers:[crew("crew-a")],failedRpc:"approve_umpire_profile"}});
  test("keeps the row visible when persistence fails",async({supabaseAuthApp})=>{
    const {page}=supabaseAuthApp; await page.evaluate(async()=>{await loginService.loginWithPassword("admin@example.com","password");renderPage("operations-center");});
    await page.getByTestId("operations-metric-pending-accounts").click(); const dialog=page.getByTestId("operations-detail-pending-accounts"); const row=dialog.locator('[data-operations-pending-account="pending-fail"]');
    await row.getByTestId("operations-pending-account-crew").selectOption("crew-a"); await row.locator('[data-operations-quick-action="approve-account"]').click();
    await expect(row).toBeVisible(); await expect(dialog.getByTestId("operations-pending-accounts-status")).toContainText("Transactional write failed");
  });
});
