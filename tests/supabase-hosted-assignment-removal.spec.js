import { test, expect } from "./fixtures/supabase-auth.fixture.js";

const admin={id:"admin-profile",auth_user_id:"admin-auth",organization_id:"organization-1",first_name:"Admin",last_name:"User",email:"admin@example.com",role:"administrator",status:"approved",communication_preferences:{}};
const game={id:"game-remove",organization_id:"organization-1",season_id:"season-1",location_id:"location-1",field_id:"field-1",game_date:"2099-06-15",game_time:"18:30:00",timezone:"America/New_York",home_team:"Hawks",away_team:"Bears",level:"12U",game_type:"single",lifecycle_status:"scheduled",review:{},report:{},source_metadata:{}};
const assignment={id:"assignment-remove",organization_id:"organization-1",game_id:game.id,position:"Plate",status:"assigned",assigned_crew_member_id:"crew-remove",locked:false};
const removedCrew={id:"crew-remove",organization_id:"organization-1",profile_id:"removed-profile",first_name:"Removed",last_name:"Umpire",email:"removed@example.com",phone:"",active:true,eligible_levels:["12U"],preferences:{},notes:""};
const otherCrew={...removedCrew,id:"crew-other",profile_id:"other-profile",first_name:"Other",email:"other@example.com"};
const approvedClaim={id:"claim-approved",organization_id:"organization-1",assignment_id:assignment.id,claimant_crew_member_id:removedCrew.id,status:"approved",decision_by_profile_id:admin.id,decision_reason:"Approved",claimed_at:"2099-01-01T00:00:00Z",decided_at:"2099-01-02T00:00:00Z"};
const scenario={profile:admin,crewId:null,games:[game],assignments:[assignment],claims:[approvedClaim],crewMembers:[removedCrew,otherCrew],locations:[{id:"location-1",organization_id:"organization-1",name:"Complex",address:"",active:true}],fields:[{id:"field-1",organization_id:"organization-1",location_id:"location-1",name:"Field 1",active:true}]};

test.describe("Hosted administrative assignment removal",()=>{
  test.use({supabaseScenario:scenario});
  test("administrator removes crew atomically and refreshes Game Hub",async({supabaseAuthApp})=>{
    const {page,calls}=supabaseAuthApp; await page.evaluate(async()=>{await loginService.loginWithPassword("admin@example.com","password");renderPage("game-hub",{gameId:"game-remove"});});
    await expect(page.getByText("Decline Assignment",{exact:true})).toHaveCount(0); const button=page.getByTestId("game-hub-remove-assignment-remove"); await expect(button).toHaveText("Remove Crew Member"); await button.click();
    await expect(page.getByTestId("game-hub-assign-Plate")).toBeVisible();
    const state=await page.evaluate(()=>({assignment:window.__supabaseFixture.settings.assignments[0],notifications:window.__supabaseFixture.settings.notifications.map(item=>item.type),activities:window.__supabaseFixture.settings.activities.map(item=>item.action)}));
    expect(state.assignment).toMatchObject({assigned_crew_member_id:null,status:"needs_assignment"}); expect(state.notifications).toContain("assignment-removed"); expect(state.activities).toContain("assignment_removed"); expect((await calls()).some(call=>call.name==="remove_game_assignment_crew")).toBe(true);
    const lifecycle=await page.evaluate(async()=>{
      const settings=window.__supabaseFixture.settings;
      const history=claimsQueueService.getClaimHistory({status:"withdrawn"}).map(item=>item.assignment.claimId);
      const switchUmpire=async(id,crewId,email)=>{supabaseAuthService.clearForTests();settings.profile={id,auth_user_id:`auth-${id}`,organization_id:"organization-1",first_name:id,last_name:"Umpire",email,role:"umpire",status:"approved",communication_preferences:{}};settings.crewId=crewId;await loginService.loginWithPassword(email,"password");return portalService.getClaimableGames().map(item=>item.id);};
      const removed=await switchUmpire("removed-profile","crew-remove","removed@example.com");
      const other=await switchUmpire("other-profile","crew-other","other@example.com");
      return {claim:settings.claims[0],history,removed,other};
    });
    expect(lifecycle.claim).toMatchObject({status:"withdrawn",decision_reason:"Administrative assignment removal"});
    expect(lifecycle.history).toContain("claim-approved"); expect(lifecycle.removed).toContain("game-remove"); expect(lifecycle.other).toContain("game-remove");
  });
});

test.describe("Hosted assignment removal safeguards",()=>{
  test.use({supabaseScenario:{...scenario,assignments:[{...assignment,locked:true,status:"locked"}]}});
  test("locked assignment remains unchanged and shows an error",async({supabaseAuthApp})=>{const{page}=supabaseAuthApp;await page.evaluate(async()=>{await loginService.loginWithPassword("admin@example.com","password");renderPage("game-hub",{gameId:"game-remove"});});await page.getByTestId("game-hub-remove-assignment-remove").click();await expect(page.getByTestId("game-hub-remove-status-assignment-remove")).toContainText("assignment_removal_locked");expect(await page.evaluate(()=>window.__supabaseFixture.settings.assignments[0].assigned_crew_member_id)).toBe("crew-remove");});
});

test.describe("Hosted assignment removal rollback",()=>{
  test.use({supabaseScenario:{...scenario,assignments:[{...assignment}],failedRpc:"remove_game_assignment_crew"}});
  test("RPC failure preserves the assignment and approved claim",async({supabaseAuthApp})=>{const{page}=supabaseAuthApp;await page.evaluate(async()=>{await loginService.loginWithPassword("admin@example.com","password");renderPage("game-hub",{gameId:"game-remove"});});await page.getByTestId("game-hub-remove-assignment-remove").click();await expect(page.getByTestId("game-hub-remove-status-assignment-remove")).toContainText("Transactional write failed");expect(await page.evaluate(()=>({crew:window.__supabaseFixture.settings.assignments[0].assigned_crew_member_id,claim:window.__supabaseFixture.settings.claims[0].status}))).toEqual({crew:"crew-remove",claim:"approved"});});
});

test.describe("Hosted finalized assignment removal",()=>{
  test.use({supabaseScenario:{...scenario,games:[{...game,lifecycle_status:"approved"}],assignments:[{...assignment}]}});
  test("finalized game is rejected",async({supabaseAuthApp})=>{const{page}=supabaseAuthApp;await page.evaluate(async()=>{await loginService.loginWithPassword("admin@example.com","password");renderPage("game-hub",{gameId:"game-remove"});});await page.getByTestId("game-hub-remove-assignment-remove").click();await expect(page.getByTestId("game-hub-remove-status-assignment-remove")).toContainText("assignment_removal_finalized");});
});

test("umpire cannot invoke administrative removal",async({supabaseAuthApp})=>{const result=await supabaseAuthApp.page.evaluate(async()=>{await loginService.loginWithPassword("linked@example.com","password");return assignmentService.removeCrewAdministratively("game-remove","assignment-remove");});expect(result).toMatchObject({success:false,message:"Unauthorized."});});
