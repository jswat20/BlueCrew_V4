import { test, expect } from "./fixtures/supabase-auth.fixture.js";

const admin = { id: "profile-admin-5b", auth_user_id: "auth-admin-5b", organization_id: "organization-1", first_name: "John", last_name: "Assignor", email: "john@example.com", role: "administrator", status: "approved", communication_preferences: {} };

test("administrator greeting and title use authenticated identity, then reset on logout", async ({ supabaseAuthApp }) => {
  const { page } = supabaseAuthApp;
  await page.evaluate(async () => { await loginService.loginWithPassword("linked@example.com", "password"); renderPage("dashboard"); });
  await expect(page.getByTestId("crew-dashboard")).toContainText("Linked Umpire");
  await expect(page).toHaveTitle("The Slate | SwatWorks - Umpire");
  await page.evaluate(async () => { await loginService.logout(); renderPage("login"); });
  await expect(page).toHaveTitle("The Slate | SwatWorks");
});

test.describe("administrator hosted polish", () => {
  test.use({ supabaseScenario: { profile: admin, crewId: null, notifications: [
    { id: "n-unread", organization_id: "organization-1", type: "game-imported", audience: "admin", recipient_profile_id: null, title: "Imported", message: "Game imported", read_at: null, created_at: "2099-01-02T00:00:00Z" },
    { id: "n-read", organization_id: "organization-1", type: "game-imported", audience: "admin", recipient_profile_id: null, title: "Old import", message: "Read", read_at: "2099-01-02T01:00:00Z", created_at: "2099-01-01T00:00:00Z" },
    { id: "n-other", organization_id: "organization-2", type: "game-imported", audience: "admin", recipient_profile_id: null, title: "Other org", message: "Hidden", read_at: null, created_at: "2099-01-03T00:00:00Z" }
  ], locations: [{ id: "loc-1", organization_id: "organization-1", name: "Lake Shore", active: true }], fields: [{ id: "field-1", organization_id: "organization-1", location_id: "loc-1", name: "Field 1", active: true }] } });

  test("admin is greeted by name and unread Workbench count uses hosted snapshot", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    await page.evaluate(async () => { await loginService.loginWithPassword("john@example.com", "password"); renderPage("dashboard"); });
    await expect(page.getByTestId("dashboard-welcome-name")).toContainText("John Assignor");
    await expect(page).toHaveTitle("The Slate | SwatWorks - Admin");
    const counts = await page.evaluate(async () => {
      const before = dashboardService.getNotificationsSummary().unreadCount;
      await notificationService.markAsRead("n-unread");
      return { before, after: dashboardService.getNotificationsSummary().unreadCount, visible: notificationService.getNotificationCenter().totalCount };
    });
    expect(counts).toEqual({ before: 1, after: 0, visible: 2 });
  });

  test("hosted CSV import persists canonical level through refresh", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    const result = await page.evaluate(async () => {
      await loginService.loginWithPassword("john@example.com", "password");
      levelTerminologyService.configure({ level_aliases: { "8U": "Pinto" } });
      const preview = scheduleImportService.preview("External Game ID,Game Date,Game Time,Canonical Level,Lake Shore Alias,Display Level,Home Team,Away Team,Location,Field,Game Type,Lifecycle Status,Initial Assignment Status,Notes\next-1,2099-04-01,18:00,,Pinto,,Home,Away,Lake Shore,Field 1,single,scheduled,needs_assignment,Imported");
      const mutation = await gameService.importSchedule(preview.games);
      return { preview, mutation, stored: gameService.getAll().find(game => game.level === "8U")?.level };
    });
    expect(result.preview).toMatchObject({ success: true, validRows: 1, invalidRows: 0 });
    expect(result.mutation.success).toBe(true);
    expect(result.stored).toBe("8U");
  });
});
