import { test, expect } from "./fixtures/app.fixture.js";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ app }) => {
  await app.page.evaluate(() => {
    authService.loginAsAdmin();
    document.body.dataset.role = "admin";
    scheduleIncludePastGames = false;
    const game = gameService.getAll()[0];
    if (game) currentScheduleDate = game.date;
    renderPage("schedule");
  });
});

test("Calendar label and cohesive All Games card use accessible explicit controls", async ({ app }) => {
  await expect(app.page.getByTestId("view-daily")).toHaveText("Calendar View");
  await app.page.getByTestId("view-all-games").click();
  const card = app.page.getByTestId("all-games-card");
  await expect(card.getByRole("heading", { name: "All Games" })).toBeVisible();
  await expect(card.locator("table.presentation-table")).toBeVisible();
  const toggle = app.page.getByTestId("schedule-include-past");
  await expect(toggle).toHaveAttribute("type", "checkbox");
  await expect(toggle).not.toBeChecked();
  await toggle.press("Space");
  await expect(toggle).toBeChecked();
  const row = card.locator("tbody tr").first();
  await expect(row).toHaveCSS("cursor", "default");
  await expect(row.getByRole("button", { name: "View Game Hub" })).toBeVisible();
});

test("All Games shows compact crew names or TBD without duplicating status", async ({ app }) => {
  await app.page.evaluate(() => {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const date = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
    gameService.create({ id: "milestone-67-tbd", date, time: "18:00", locationComplex: "Lake Shore Athletic Complex", locationField: "Field 1", field: "Field 1", level: "12U", awayTeam: "TBD Away", homeTeam: "TBD Home", gameType: "single" });
    currentScheduleView = "all"; renderScheduleContent();
  });
  const rows = app.page.locator(".schedule-table tbody tr");
  await expect(rows.first()).toBeVisible();
  const values = await rows.locator("td:nth-child(7)").allTextContents();
  expect(values.some(value => value.trim() === "TBD") || values.some(value => /U[1-4]\s+\S+/.test(value))).toBeTruthy();
  await expect(rows.locator("td:nth-child(7)").filter({ hasText: "Needs Crew" })).toHaveCount(0);
});

test("Calendar cards format time, clean crew state, and expose only shared actions", async ({ app }) => {
  const card = app.page.locator(".schedule-game-card").first();
  test.skip(await card.count() === 0, "No game on selected calendar date.");
  await expect(card.locator(".game-time")).toHaveText(/\d{1,2}:\d{2}\s(?:AM|PM)|Time TBD/);
  await expect(card.getByRole("button", { name: "Edit Game" })).toBeVisible();
  await expect(card.getByRole("button", { name: "Manage Crew" })).toBeVisible();
  await expect(card.getByRole("button", { name: "View Game Hub" })).toBeVisible();
  await expect(card.getByTestId(/delete-game-/)).toHaveCount(0);
  await expect(card).not.toContainText("Crew: No crew assigned");
});

test("Edit Game is an accessible modal and keeps Delete Game inside", async ({ app }) => {
  const edit = app.page.getByTestId(/edit-game-/).first();
  test.skip(await edit.count() === 0, "No editable game on selected calendar date.");
  await edit.click();
  const dialog = app.page.getByRole("dialog", { name: "Edit Game" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(dialog.getByTestId("delete-game-button")).toHaveText("Delete Game");
  await expect(dialog).toBeFocused();
  await dialog.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(edit).toBeFocused();
});

test("Build Crew presents U labels and complete game context", async ({ app }) => {
  const manage = app.page.getByTestId(/game-details-/).first();
  test.skip(await manage.count() === 0, "No game on selected calendar date.");
  await manage.click();
  const drawer = app.page.getByTestId("assignment-drawer");
  await expect(drawer.getByTestId("assignment-title")).toHaveText("Build Crew");
  await expect(drawer.getByTestId("assignment-game-summary")).toContainText(/@/);
  await expect(drawer.getByTestId("assignment-game-summary")).toContainText(/\d{1,2}:\d{2}\s(?:AM|PM)/);
  await expect(drawer.getByTestId("assignment-game-summary")).toContainText(/Field|Complex/);
  const position = drawer.locator(".crew-builder-slot-info strong").first();
  await expect(position).toHaveText(/U1|U2|U3|U4/);
  await expect(drawer.locator(".crew-builder-slot-info")).not.toContainText(/Plate|Base/);
});

test("Calendar area keeps the wider desktop share and stacks responsively", async ({ app }) => {
  const grid = app.page.locator(".daily-assignment-grid");
  test.skip(await grid.count() === 0, "Calendar grid unavailable.");
  const desktop = await grid.locator(":scope > *").evaluateAll(elements => elements.map(element => element.getBoundingClientRect().width));
  expect(desktop[1]).toBeGreaterThan(desktop[0]);
  await app.page.setViewportSize({ width: 700, height: 900 });
  const mobile = await grid.locator(":scope > *").evaluateAll(elements => elements.map(element => element.getBoundingClientRect()));
  expect(mobile[1].top).toBeGreaterThan(mobile[0].bottom - 1);
});

test("admin Schedule has no automated WCAG A or AA violations", async ({ app }) => {
  const accessibility = await new AxeBuilder({ page: app.page })
    .include("#app-content")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});
