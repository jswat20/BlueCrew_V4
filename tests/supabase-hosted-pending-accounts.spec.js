import { test, expect } from "./fixtures/supabase-auth.fixture.js";

const admin = { id:"admin-profile",auth_user_id:"admin-auth",organization_id:"organization-1",first_name:"Admin",last_name:"User",email:"admin@example.com",role:"administrator",status:"approved",communication_preferences:{} };
const pending = (id, first, created, organization="organization-1") => ({ id,organization_id:organization,role:"umpire",status:"pending",first_name:first,last_name:"Pending",email:`${first.toLowerCase()}@example.com`,phone:"",created_at:created });
const crew = (id, email="") => ({ id,organization_id:"organization-1",profile_id:null,first_name:id,last_name:"Crew",email,phone:"",active:true,eligible_levels:["12U"],preferences:{},notes:"" });

test.describe("Hosted pending account administration", () => {
  test.use({ supabaseScenario: { profile:admin,crewId:null,pendingProfiles:[pending("pending-b","Second","2026-02-02"),pending("pending-a","First","2026-01-01"),pending("other","Other","2025-01-01","organization-2")],crewMembers:[crew("crew-a","first@example.com"),crew("crew-b")] } });

  test("loads an ordered organization queue and supports consecutive decisions", async ({ supabaseAuthApp }) => {
    const { page, calls } = supabaseAuthApp;
    const state = await page.evaluate(async () => { const login=await loginService.loginWithPassword("admin@example.com","password"); renderPage("operations-center"); return {login,ids:accountService.getPendingAccounts().map(item=>item.id)}; });
    expect(state.login.success).toBe(true);
    expect(state.ids).toEqual(["pending-a","pending-b"]);
    await page.getByTestId("operations-metric-pending-accounts").click();
    const dialog=page.getByTestId("operations-detail-pending-accounts");
    const first=dialog.locator('[data-operations-pending-account="pending-a"]');
    await expect(first.locator("strong")).toHaveText("First Pending");
    await expect(dialog.locator('[data-operations-pending-account="pending-b"] strong')).toHaveText("Second Pending");
    await expect(first.locator("strong")).not.toContainText("pending-a");
    await expect(first.getByTestId("operations-pending-account-crew")).toHaveCount(0);
    await first.locator('[data-operations-quick-action="approve-account"]').click();
    await expect(page.getByTestId("operations-metric-pending-accounts").locator("strong")).toHaveText("1");
    await expect(dialog).toBeVisible();
    await dialog.locator('[data-operations-pending-account="pending-b"] [data-operations-quick-action="reject-account"]').click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByTestId("operations-metric-pending-accounts").locator("strong")).toHaveText("0");
    const rpcCalls=(await calls()).filter(call=>call.operation==="rpc");
    expect(rpcCalls.find(call=>call.name==="approve_pending_umpire")?.args).toEqual({p_target_profile_id:"pending-a"});
    expect(rpcCalls.some(call=>call.name==="reject_umpire_profile")).toBe(true);
    const effects=await page.evaluate(()=>({notifications:window.__supabaseFixture.settings.notifications.map(item=>item.type),activities:window.__supabaseFixture.settings.activities.map(item=>item.action),crew:window.__supabaseFixture.settings.crewMembers.find(item=>item.id==="crew-a")?.profile_id}));
    expect(effects).toEqual({notifications:["account-approved","account-rejected"],activities:["account_approved","account_rejected"],crew:"pending-a"});
  });
});

test.describe("Hosted pending account identity display", () => {
  const uuid = "e4da57f5-412d-40e5-a40f-92254ef15731";
  test.use({ supabaseScenario: { profile:admin,crewId:null,pendingProfiles:[
    pending(uuid,"Ryan","2026-03-01"),
    { ...pending("missing-last","Single","2026-03-02"), last_name:"" }
  ] } });

  test("Accounts and Operations Center show human names while actions retain profile IDs", async ({ supabaseAuthApp }) => {
    const { page, calls } = supabaseAuthApp;
    await page.evaluate(async()=>{await loginService.loginWithPassword("admin@example.com","password");renderPage("operations-center");});
    await page.getByTestId("operations-metric-pending-accounts").click();
    const dialog=page.getByTestId("operations-detail-pending-accounts");
    const row=dialog.locator(`[data-operations-pending-account="${uuid}"]`);
    await expect(row.locator("strong")).toHaveText("Ryan Pending");
    await expect(row.locator("strong")).not.toContainText(uuid);
    await row.getByRole("button", { name: "Review" }).click();
    await expect(page.locator("body")).toHaveAttribute("data-page", "accounts");
    const accountRow=page.getByTestId(`pending-account-${uuid}`);
    await expect(accountRow.locator("strong")).toHaveText("Ryan Pending");
    await expect(accountRow).toContainText("ryan@example.com");
    await expect(page.getByTestId("pending-account-missing-last").locator("strong")).toHaveText("Single");
    await page.getByTestId(`reject-account-${uuid}`).click();
    expect((await calls()).find(call=>call.name==="reject_umpire_profile")?.args).toEqual({p_target_profile_id:uuid,p_reason:null});
  });
});

test.describe("Hosted pending account failures",()=>{
  test.use({supabaseScenario:{profile:admin,crewId:null,pendingProfiles:[pending("pending-fail","Failure","2026-01-01")],crewMembers:[crew("crew-a","failure@example.com")],failedRpc:"approve_pending_umpire"}});
  test("keeps the row visible when persistence fails",async({supabaseAuthApp})=>{
    const {page}=supabaseAuthApp; await page.evaluate(async()=>{await loginService.loginWithPassword("admin@example.com","password");renderPage("operations-center");});
    await page.getByTestId("operations-metric-pending-accounts").click(); const dialog=page.getByTestId("operations-detail-pending-accounts"); const row=dialog.locator('[data-operations-pending-account="pending-fail"]');
    await row.locator('[data-operations-quick-action="approve-account"]').click();
    await expect(row).toBeVisible(); await expect(dialog.getByTestId("operations-pending-accounts-status")).toContainText("Transactional write failed");
  });
});
