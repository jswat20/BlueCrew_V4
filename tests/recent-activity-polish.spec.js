import { test, expect } from "./fixtures/app.fixture.js";

test("Recent Activity presents a concise attributed audit table", async ({ app }) => {
  await app.page.evaluate(() => {
    localStorage.removeItem("bluecrew_activity");
    authService.loginAsAdmin(); document.body.dataset.role = "admin";
    levelTerminologyService.configure({ level_aliases: { "8U": "Pinto" } });
    const now = Date.now();
    activityService.log({ id: "game-added", type: "game", action: "game_created", actorName: "John Switala", actorRole: "administrator", createdAt: new Date(now - 1000).toISOString(), metadata: { locationComplex: "Lake Shore Athletic Complex", level: "8U", date: "2026-08-12", time: "18:00" } });
    activityService.log({ id: "assigned", type: "assignment", action: "assigned", actorName: "Jane Smith", actorRole: "assigner", crewId: crewService.getAll()[0].id, subject: "Plate", metadata: { position: "Plate" }, createdAt: new Date(now - 2000).toISOString() });
    activityService.log({ id: "umpire-action", type: "claim", action: "claim_submitted", actorName: "Test UmpireOne", actorRole: "umpire", subject: "Plate", message: "Claim submitted for Plate.", createdAt: new Date(now - 3000).toISOString() });
    activityService.log({ id: "system-action", type: "notification", action: "notification_sent", systemGenerated: true, message: "Automated reminder sent.", createdAt: new Date(now - 4000).toISOString() });
    renderPage("dashboard");
  });
  const feed = app.page.getByTestId("dashboard-assignment-activity");
  await expect(feed.locator(".dashboard-activity-header span")).toHaveText(["Time", "Activity", "Level", "Performed By", "Details"]);
  const rows = feed.getByTestId("dashboard-assignment-activity-item");
  await expect(rows.nth(0).getByTestId("dashboard-assignment-activity-time")).toHaveText(/\d{1,2}:\d{2} (AM|PM)/);
  await expect(rows.nth(0).getByTestId("dashboard-activity-category")).toContainText("Game Added");
  await expect(rows.nth(0).getByTestId("dashboard-assignment-activity-matchup")).toHaveText("8U - Pinto");
  await expect(rows.nth(0).locator(".operations-log-actor")).toHaveText("Admin - John Switala");
  await expect(rows.nth(0).getByTestId("dashboard-assignment-activity-action")).toHaveText("Lake Shore Athletic Complex • 8U - Pinto • Aug 12, 2026 • 6:00 PM");
  await expect(rows.nth(1).locator(".operations-log-actor")).toHaveText("Assigner - Jane Smith");
  await expect(rows.nth(1).locator(".operations-log-actor")).not.toContainText("Plate");
  await expect(rows.nth(1).getByTestId("dashboard-assignment-activity-action")).toContainText("assigned to Plate");
  await expect(rows.nth(2).locator(".operations-log-actor")).toHaveText("Umpire - Test UmpireOne");
  await expect(rows.nth(3).locator(".operations-log-actor")).toHaveText("System");
  await expect(rows.nth(3).getByTestId("dashboard-assignment-activity-matchup")).toHaveText("—");
  await expect(rows).toHaveCount(4);
});

test("removed and cancelled games retain context and crew removal stays useful", async ({ app }) => {
  await app.page.evaluate(() => {
    localStorage.removeItem("bluecrew_activity"); authService.loginAsAdmin(); document.body.dataset.role = "admin";
    levelTerminologyService.configure({ level_aliases: { "12U": "Bronco" } });
    const context = { locationComplex: "Lake Shore Athletic Complex", level: "12U", date: "2026-08-13", time: "19:30" };
    activityService.log({ id: "removed-game", type: "game", action: "game_deleted", actorName: "John Switala", actorRole: "administrator", metadata: context, createdAt: new Date(Date.now() - 1000).toISOString() });
    activityService.log({ id: "cancelled-game", type: "game", action: "game_cancelled", actorName: "Jane Smith", actorRole: "assigner", metadata: context, createdAt: new Date(Date.now() - 2000).toISOString() });
    activityService.log({ id: "crew-removed", type: "assignment", action: "cleared", actorName: "Jane Smith", actorRole: "assigner", subject: "Plate", metadata: { position: "Plate", previousCrewName: "Test UmpireOne" }, createdAt: new Date(Date.now() - 3000).toISOString() });
    renderPage("dashboard");
  });
  const rows = app.page.getByTestId("dashboard-assignment-activity-item");
  await expect(rows.nth(0).getByTestId("dashboard-activity-category")).toContainText("Game Removed");
  await expect(rows.nth(0).getByTestId("dashboard-assignment-activity-action")).toHaveText("Lake Shore Athletic Complex • 12U - Bronco • Aug 13, 2026 • 7:30 PM");
  await expect(rows.nth(1).getByTestId("dashboard-activity-category")).toContainText("Game Cancelled");
  await expect(rows.nth(1).getByTestId("dashboard-assignment-activity-action")).toHaveText("Lake Shore Athletic Complex • 12U - Bronco • Aug 13, 2026 • 7:30 PM");
  await expect(rows.nth(2).getByTestId("dashboard-assignment-activity-action")).toHaveText("Test UmpireOne removed from Plate");
});
