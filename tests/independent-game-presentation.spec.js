import { test, expect } from "./fixtures/supabase-auth.fixture.js";

test.use({ supabaseScenario: { initialSession: true, profile: {
  id: "profile-game-domain-admin", auth_user_id: "auth-game-domain-admin",
  organization_id: "organization-1", first_name: "Domain", last_name: "Admin",
  email: "domain-admin@example.com", role: "administrator", status: "approved",
  communication_preferences: {}
} } });

test.describe("independent game presentation", () => {
  test("League games do not inherit Officials staffing actions", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    await page.evaluate(() => {
      gameService.publishSharedGames({ games: [{
        id: "league-domain-game", gameDomain: "league", sport: "Softball",
        date: new Date().toISOString().slice(0, 10), time: "18:00",
        awayTeam: "League Away", homeTeam: "League Home", level: "12U",
        lifecycleStatus: "scheduled", status: "scheduled", assignments: []
      }], referencedCrew: [] });
      currentScheduleDate = new Date().toISOString().slice(0, 10);
      currentScheduleView = "daily";
      renderPage("schedule");
    });
    await expect(page.getByTestId("game-card-league-domain-game")).toContainText("League game");
    await expect(page.getByTestId("game-card-league-domain-game")).toContainText("Scheduled");
    await expect(page.getByTestId("game-card-league-domain-game")).not.toContainText("Needs Crew");
    await expect(page.getByTestId("game-card-league-domain-game")).not.toContainText("Manage Crew");
    await expect(page.getByTestId("game-card-league-domain-game")).not.toContainText("View Game Hub");
  });
});
