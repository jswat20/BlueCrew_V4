import { test, expect } from "./fixtures/app.fixture.js";

function offsetDate(offset) {
  const date = new Date(); date.setHours(12, 0, 0, 0); date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

test.beforeEach(async ({ app }) => {
  await app.page.evaluate(() => {
    authService.loginAsAdmin(); document.body.dataset.role = "admin";
    scheduleIncludePastGames = false; scheduleQuickSort = { field: "", direction: "asc" };
    Object.assign(scheduleAdvancedFilters, { date: "", time: "", locationComplex: "", field: "", level: "", matchup: "", crew: "", status: "", sort: "date", direction: "asc" });
  });
});

test("All Games defaults to future work and preserves filters across the past toggle", async ({ app }) => {
  const ids = await app.page.evaluate(({ past, today, future }) => {
    const create = (date, name, field) => gameService.create({ id: `schedule-polish-${name.replaceAll(" ", "-").toLowerCase()}`, date, time: "18:00", locationComplex: "Lake Shore Athletic Complex", locationField: field, field, level: "12U", homeTeam: `${name} Home`, awayTeam: `${name} Away`, gameType: "single" }).data;
    const old = create(past, "History Polish", "History Field"); old.status = "completed";
    const now = create(today, "Today Polish", "Keep Field");
    const next = create(future, "Future Polish", "Other Field"); gameService.save();
    currentScheduleView = "all"; renderPage("schedule");
    return { past: old.id, today: now.id, future: next.id };
  }, { past: offsetDate(-1), today: offsetDate(0), future: offsetDate(1) });
  await expect(app.page.getByTestId(`game-row-${ids.past}`)).toHaveCount(0);
  await expect(app.page.getByTestId(`game-row-${ids.today}`)).toBeVisible();
  await expect(app.page.getByTestId(`game-row-${ids.future}`)).toBeVisible();
  const toggle = app.page.getByTestId("schedule-include-past");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(app.page.getByTestId(`game-row-${ids.past}`)).toBeVisible();
  await expect(app.page.getByTestId(`schedule-status-${ids.past}`)).toHaveText("Completed");
  await expect(app.page.getByTestId(`schedule-status-${ids.past}`)).toHaveClass(/status-badge-approved/);
  await app.page.getByTestId("schedule-advanced-field").selectOption("Keep Field");
  await expect(app.page.getByTestId(`game-row-${ids.today}`)).toBeVisible();
  await expect(app.page.getByTestId(`game-row-${ids.future}`)).toHaveCount(0);
  await toggle.click();
  await expect(app.page.getByTestId("schedule-advanced-field")).toHaveValue("Keep Field");
  await expect(app.page.getByTestId(`game-row-${ids.past}`)).toHaveCount(0);
});

test("All Games renders normalized complex, formatted time, aliased level, fallbacks, and semantic status", async ({ app }) => {
  const ids = await app.page.evaluate(date => {
    levelTerminologyService.configure({ level_aliases: { "16U": "Colt" } });
    const assigned = gameService.create({ id: "schedule-polish-presentation", date, time: "18:00", locationComplex: "Lake Shore Athletic Complex", locationField: "Field 3", field: "Field 3", level: "16U", homeTeam: "Presentation Home", awayTeam: "Presentation Away", gameType: "single" }).data;
    assignmentService.assignToAssignment(assigned.id, assignmentService.getAssignments(assigned)[0].id, crewService.getAll()[0].id);
    const missing = gameService.create({ id: "schedule-polish-missing", date, time: "09:30", locationComplex: "", locationField: "Field 4", field: "Field 4", level: "", homeTeam: "Missing Home", awayTeam: "Missing Away", gameType: "single" }).data;
    currentScheduleView = "all"; renderPage("schedule"); return { assigned: assigned.id, missing: missing.id };
  }, offsetDate(2));
  await expect(app.page.locator(".schedule-table thead")).toContainText("Complex");
  const assigned = app.page.getByTestId(`game-row-${ids.assigned}`);
  await expect(assigned.locator(".schedule-column-time")).toHaveText("6:00 PM");
  await expect(assigned.locator(".schedule-column-complex")).toHaveText("Lake Shore Athletic Complex");
  await expect(assigned).toContainText("16U - Colt");
  await expect(app.page.getByTestId(`schedule-status-${ids.assigned}`)).toHaveClass(/status-badge-assigned/);
  const missing = app.page.getByTestId(`game-row-${ids.missing}`);
  await expect(missing.locator(".schedule-column-time")).toHaveText("9:30 AM");
  await expect(missing.locator(".schedule-column-complex")).toHaveText("Complex unavailable");
  await expect(missing).toContainText("Level unavailable");
  await expect(app.page.getByTestId(`schedule-status-${ids.missing}`)).toHaveClass(/status-badge-needs-assignment/);
});

test("quick headers sort underlying values in both directions with accessible state", async ({ app }) => {
  await app.page.evaluate(dates => {
    levelTerminologyService.configure({ level_aliases: { "8U": "Pinto", "12U": "Bronco", "16U": "Colt" } });
    const create = (suffix, date, time, complex, field, level) => gameService.create({ id: `schedule-polish-sort-${suffix}`, date, time, locationComplex: complex, locationField: field, field, level, homeTeam: `Sort Polish ${suffix} Home`, awayTeam: `Sort Polish ${suffix} Away`, gameType: "single" }).data;
    const a = create("A", dates[0], "18:00", "Zulu Complex", "Field 10", "12U");
    const b = create("B", dates[1], "09:00", "Alpha Complex", "Field 2", "8U");
    const c = create("C", dates[2], "12:00", "Mike Complex", "Field 1", "16U");
    assignmentService.assignToAssignment(a.id, assignmentService.getAssignments(a)[0].id, crewService.getAll()[0].id);
    c.status = "cancelled"; gameService.save();
    currentScheduleView = "all"; renderPage("schedule");
  }, [offsetDate(1), offsetDate(2), offsetDate(3)]);
  await app.page.getByTestId("schedule-advanced-matchup").fill("Sort Polish");
  await expect(app.page.getByTestId("schedule-status-schedule-polish-sort-C")).toHaveClass(/status-badge-danger/);
  const names = () => app.page.locator(".schedule-table tbody tr td:nth-child(6)").allTextContents().then(values => values.map(value => value.match(/Sort Polish ([ABC])/)[1]));
  const expectations = {
    date: [["A", "B", "C"], ["C", "B", "A"]],
    time: [["B", "C", "A"], ["A", "C", "B"]],
    field: [["C", "B", "A"], ["A", "B", "C"]],
    complex: [["B", "C", "A"], ["A", "C", "B"]],
    level: [["B", "A", "C"], ["C", "A", "B"]],
    status: [["A", "C", "B"], ["B", "C", "A"]]
  };
  for (const [field, [ascending, descending]] of Object.entries(expectations)) {
    const button = app.page.getByTestId(`schedule-quick-sort-${field}`);
    await button.click();
    await expect(button.locator("xpath=..")).toHaveAttribute("aria-sort", "ascending");
    expect(await names()).toEqual(ascending);
    await button.click();
    await expect(button.locator("xpath=..")).toHaveAttribute("aria-sort", "descending");
    expect(await names()).toEqual(descending);
    await expect(app.page.getByTestId("schedule-advanced-matchup")).toHaveValue("Sort Polish");
  }
});
