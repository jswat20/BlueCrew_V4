import { test, expect } from "./fixtures/supabase-auth.fixture.js";
import AxeBuilder from "@axe-core/playwright";

const admin = {
  id: "profile-admin-61", auth_user_id: "auth-admin-61", organization_id: "organization-1",
  first_name: "John", last_name: "Switala", email: "john.switala@example.com",
  role: "administrator", status: "approved", communication_preferences: {}
};

test.describe("Milestone 6.1 shared presentation framework", () => {
  test.use({ supabaseScenario: { profile: admin, crewId: null, notifications: [{
    id: "notification-61", organization_id: "organization-1", type: "assignment-updated",
    audience: "admin", recipient_profile_id: null, title: "Crew updated",
    message: "Plate assignment changed.", read_at: null, created_at: "2026-08-08T18:00:00Z"
  }] } });

  test("formats admin greetings centrally while preserving the umpire shape", async ({ supabaseAuthApp }) => {
    const result = await supabaseAuthApp.page.evaluate(() => ({
      morning: presentationFormattingService.formatGreeting({ name: "John Switala", role: "admin", date: new Date(2026, 0, 1, 8) }),
      afternoon: presentationFormattingService.formatGreeting({ name: "John Switala", role: "admin", date: new Date(2026, 0, 1, 14) }),
      evening: presentationFormattingService.formatGreeting({ name: "John Switala", role: "admin", date: new Date(2026, 0, 1, 20) }),
      umpire: presentationFormattingService.formatGreeting({ name: "Alex Umpire", role: "umpire", date: new Date(2026, 0, 1, 8) })
    }));
    expect(result).toEqual({
      morning: "Good Morning, John Switala (Admin)",
      afternoon: "Good Afternoon, John Switala (Admin)",
      evening: "Good Evening, John Switala (Admin)",
      umpire: "Good Morning, Alex Umpire"
    });

    await supabaseAuthApp.page.evaluate(async () => {
      await loginService.loginWithPassword("john.switala@example.com", "password");
      renderPage("dashboard");
    });
    await expect(supabaseAuthApp.page.getByTestId("dashboard-welcome-name"))
      .toHaveText(/Good (Morning|Afternoon|Evening), John Switala \(Admin\)/);
  });

  test("maps assignment labels without mutating canonical positions", async ({ supabaseAuthApp }) => {
    const result = await supabaseAuthApp.page.evaluate(() => {
      const canonical = ["Plate", "Base", "U3", "U4"];
      return { labels: canonical.map(presentationFormattingService.formatAssignmentPosition), canonical };
    });
    expect(result.labels).toEqual(["U1", "U2", "U3", "U4"]);
    expect(result.canonical).toEqual(["Plate", "Base", "U3", "U4"]);
  });

  test("exposes semantic statuses, button variants, and deterministic game IDs", async ({ supabaseAuthApp }) => {
    const result = await supabaseAuthApp.page.evaluate(() => ({
      statuses: ["Needs Assignment", "Assigned", "Scheduled", "Pending Approval", "Completed", "Approved", "Cancelled"]
        .map(presentationFormattingService.getStatusBadgeClass),
      ghost: getPresentationButtonClass({ variant: "ghost" }),
      gameId: presentationFormattingService.formatGameIdentifier({ year: 2026, seasonCode: "S", organizationCode: "LSYB", canonicalLevel: "8U", sequence: 112 }),
      fallbackId: presentationFormattingService.formatGameIdentifier({ year: 2026, canonicalLevel: "8U" }),
      time: dateTimeFormattingService.formatTime12Hour("18:00")
    }));
    expect(result.statuses).toEqual([
      "status-badge-needs-assignment", "status-badge-assigned", "status-badge-scheduled",
      "status-badge-pending-approval", "status-badge-completed", "status-badge-approved-semantic", "status-badge-cancelled"
    ]);
    expect(result.ghost).toBe("button button-ghost");
    expect(result.gameId).toBe("2026-S-LSYB-8U-0112");
    expect(result.fallbackId).toBe("2026-8U");
    expect(result.time).toBe("6:00 PM");
  });

  test("adopts shared table, View All, notification row, and accessible controls", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    await page.evaluate(async () => {
      await loginService.loginWithPassword("john.switala@example.com", "password");
      renderPage("assigner-workbench");
    });
    await expect(page.getByTestId("workbench-open-notifications")).toHaveClass(/button-view-all/);
    await page.evaluate(() => renderPage("schedule"));
    await page.getByTestId("view-all-games").click();
    await expect(page.locator(".presentation-table-wrapper")).toHaveCount(1);
    await page.evaluate(() => renderPage("notifications"));
    await expect(page.locator(".shared-notification-row").first()).toBeVisible();
    await expect(page.locator(".shared-notification-row").first().getByTestId("notification-timestamp")).toBeVisible();

    const disabled = page.getByTestId("notifications-clear-selection");
    await expect(disabled).toBeDisabled();
    await expect(disabled).toHaveCSS("color", "rgb(102, 112, 133)");
    await page.getByTestId("notifications-select-visible").focus();
    await expect(page.getByTestId("notifications-select-visible")).toBeFocused();

    const accessibility = await new AxeBuilder({ page }).include('[data-testid="notifications"]').withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(accessibility.violations).toEqual([]);
  });
});
