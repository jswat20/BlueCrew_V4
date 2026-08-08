import { test, expect } from "./fixtures/supabase-auth.fixture.js";
import { test as localTest } from "./fixtures/app.fixture.js";

const admin={id:"admin-staff",auth_user_id:"auth-admin-staff",organization_id:"organization-1",first_name:"Staff",last_name:"Admin",email:"staff@example.com",role:"administrator",status:"approved",communication_preferences:{}};
const location={id:"loc-staff",organization_id:"organization-1",name:"Complex",active:true};
const field={id:"field-staff",organization_id:"organization-1",location_id:location.id,name:"Field 1",active:true};
const scenario={profile:admin,crewId:null,locations:[location],fields:[field],games:[],assignments:[]};
const imported=(id,type,date="2099-05-01")=>({externalGameId:id,date,time:"18:00",timezone:"America/New_York",level:"12U",homeTeam:`Home ${id}`,awayTeam:`Away ${id}`,locationComplex:"Complex",locationField:"Field 1",gameType:type,lifecycleStatus:"scheduled",assignmentStatus:"needs_assignment"});

test.describe("Hosted import canonical assignment positions",()=>{
  test.use({supabaseScenario:scenario});
  test("one, two, and three official games persist their configured positions after refresh",async({supabaseAuthApp})=>{
    const {page,calls}=supabaseAuthApp;
    const result=await page.evaluate(async games=>{await loginService.loginWithPassword("staff@example.com","password");const mutation=await gameService.importSchedule(games);return{mutation,positions:window.__supabaseFixture.settings.assignments.reduce((out,a)=>{(out[a.game_id]||=[]).push(a.position);return out;},{})};},[imported("one","single"),imported("two","twoMan"),imported("three","threeMan")]);
    expect(result.mutation.success).toBe(true);
    expect(Object.values(result.positions)).toEqual([["Plate"],["Plate","Base"],["Plate","Base","U3"]]);
    const rpc=(await calls()).find(call=>call.name==="import_schedule_games");
    expect(rpc.args.p_games.map(game=>game.positions)).toEqual([["Plate"],["Plate","Base"],["Plate","Base","U3"]]);
  });
  test("duplicate or invalid positions reject the whole batch",async({supabaseAuthApp})=>{
    const result=await supabaseAuthApp.page.evaluate(async()=>{await loginService.loginWithPassword("staff@example.com","password");const before=window.__supabaseFixture.settings.games.length;const response=await supabaseSharedRepository.importScheduleGames([{...gameService.importSchedule,positions:["Plate","Plate"]}]);return{error:response.error?.message,before,after:window.__supabaseFixture.settings.games.length};});
    expect(result).toEqual({error:"schedule_import_invalid_positions",before:0,after:0});
  });
});

localTest("staffing summary uses one snapshot and explicit date scope",async({app})=>{
  const summary=await app.page.evaluate(()=>{
    authService.loginAsAdmin();
    const create=(date,type,name)=>gameService.create({date,time:"6:00 PM",level:"12U",homeTeam:`Home ${name}`,awayTeam:`Away ${name}`,field:"Field 1",gameType:type}).data;
    const one=create("2099-06-01","single","One");
    const two=create("2099-06-01","twoMan","Two");
    const other=create("2099-06-02","threeMan","Other");
    assignmentService.assignToAssignment(one.id,one.assignments[0].id,crewService.getAll()[0].id);
    return {day:dashboardService.getStaffingSummary({startDate:"2099-06-01",endDate:"2099-06-01"}),range:dashboardService.getStaffingSummary({startDate:"2099-06-01",endDate:"2099-06-02"}),positions:[one.assignments.length,two.assignments.length,other.assignments.length]};
  });
  expect(summary.positions).toEqual([1,2,3]);
  expect(summary.day).toEqual({gameCount:2,openPositionCount:2,fullyStaffedGameCount:1});
  expect(summary.range).toEqual({gameCount:3,openPositionCount:5,fullyStaffedGameCount:1});
});
