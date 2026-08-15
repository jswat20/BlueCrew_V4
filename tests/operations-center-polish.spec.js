import { test, expect } from "./fixtures/app.fixture.js";

test("Operations staffing table formats and aligns current 28-day work",async({app})=>{
  await app.page.evaluate(()=>{
    authService.loginAsAdmin(); levelTerminologyService.configure({level_aliases:{"12U":"Bronco"}});
    const base=new Date(); base.setHours(12,0,0,0);
    const date=offset=>{const value=new Date(base);value.setDate(value.getDate()+offset);return value.toISOString().split("T")[0];};
    const create=(offset,name,status="scheduled")=>{const result=gameService.create({date:date(offset),time:offset===0?"18:00":"09:30",level:"12U",homeTeam:`Home ${name}`,awayTeam:`Away ${name}`,locationComplex:"Central Complex",locationField:"Field 1",field:"Field 1",gameType:"single"}).data;if(status==="cancelled")result.status="cancelled";return result.id;};
    const values={past:create(-1,"Past"),today:create(0,"Today"),day28:create(28,"Day28"),day29:create(29,"Day29"),cancelled:create(5,"Cancelled","cancelled")};
    renderPage("operations-center"); return values;
  });
  const rows=app.page.getByTestId("operations-upcoming-event");
  await expect(rows.getByText("Away Today @ Home Today")).toBeVisible();
  await expect(rows.getByText("Away Day28 @ Home Day28")).toBeVisible();
  await expect(rows.getByText("Away Day29 @ Home Day29")).toHaveCount(0);
  await expect(rows.getByText("Away Past @ Home Past")).toHaveCount(0);
  await expect(rows.getByText("Away Cancelled @ Home Cancelled")).toHaveCount(0);
  await expect(rows.filter({hasText:"Away Today @ Home Today"}).getByText("6:00 PM")).toBeVisible();
  await expect(rows.getByText("12U - Bronco").first()).toBeVisible();
  const alignment=await app.page.evaluate(()=>{const table=document.querySelector(".operations-staffing-table");const style=selector=>getComputedStyle(table.querySelector(selector)).textAlign;return{matchHeader:style("th.operations-column-matchup"),matchCell:style("td.operations-column-matchup"),locationHeader:style("th.operations-column-location"),locationCell:style("td.operations-column-location"),timeHeader:style("th.operations-column-time"),timeCell:style("td.operations-column-time"),levelHeader:style("th.operations-column-level"),levelCell:style("td.operations-column-level")};});
  expect(alignment).toEqual({matchHeader:"center",matchCell:"left",locationHeader:"center",locationCell:"center",timeHeader:"center",timeCell:"center",levelHeader:"center",levelCell:"center"});
});

test("Operations top staffing metrics share the inclusive 28-day scope",async({app})=>{
  const result=await app.page.evaluate(()=>{
    authService.loginAsAdmin();const base=new Date();base.setHours(12,0,0,0);const date=offset=>{const d=new Date(base);d.setDate(d.getDate()+offset);return d.toISOString().split("T")[0];};
    const staffed=gameService.create({date:date(0),time:"18:00",level:"12U",homeTeam:"Staffed Home",awayTeam:"Staffed Away",field:"Field 1",gameType:"single"}).data;
    const open=gameService.create({date:date(28),time:"19:00",level:"12U",homeTeam:"Open Home",awayTeam:"Open Away",field:"Field 1",gameType:"twoMan"}).data;
    assignmentService.assignToAssignment(staffed.id,staffed.assignments[0].id,crewService.getAll()[0].id);
    const summary=dashboardService.getStaffingSummary({startDate:date(0),endDate:date(28)});const center=dashboardService.getOperationsCenter();
    return{summary,metrics:Object.fromEntries(center.statusMetrics.filter(metric=>["events-today","open-positions","fully-staffed"].includes(metric.id)).map(metric=>[metric.id,{value:metric.value,display:metric.displayValue}]))};
  });
  expect(result.summary).toEqual({gameCount:2,openPositionCount:2,fullyStaffedGameCount:1});
  expect(result.metrics["events-today"].value).toBe(2);
  expect(result.metrics["open-positions"].value).toBe(2);
  expect(result.metrics["fully-staffed"]).toEqual({value:1,display:"1 of 2"});
});
