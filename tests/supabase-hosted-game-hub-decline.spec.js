import { test, expect } from "./fixtures/supabase-auth.fixture.js";

const profile = {
  id: "profile-decline", auth_user_id: "auth-decline", organization_id: "organization-1",
  first_name: "Hosted", last_name: "Umpire", email: "hosted.umpire@example.com",
  role: "umpire", status: "approved", communication_preferences: {}
};
const game = {
  id: "game-decline", organization_id: "organization-1", season_id: "season-1",
  location_id: "location-1", field_id: "field-1", game_date: "2099-06-15",
  game_time: "18:30:00", timezone: "America/New_York", home_team: "Hawks",
  away_team: "Bears", level: "12U", game_type: "twoMan", lifecycle_status: "scheduled",
  review: {}, report: {}, source_metadata: {}
};
const assignments = [
  { id: "assignment-plate", organization_id: "organization-1", game_id: game.id, position: "Plate", status: "assigned", assigned_crew_member_id: "crew-decline", locked: false },
  { id: "assignment-base", organization_id: "organization-1", game_id: game.id, position: "Base", status: "needs_assignment", assigned_crew_member_id: null, locked: false }
];
const crew = { id: "crew-decline", organization_id: "organization-1", profile_id: profile.id, first_name: "Hosted", last_name: "Umpire", email: profile.email, phone: "", active: true, eligible_levels: ["12U"], preferences: {}, notes: "" };

test.describe("Hosted umpire Game Hub decline regression", () => {
  test.use({ supabaseScenario: {
    profile, crewId: crew.id, games: [game], assignments, crewMembers: [crew],
    locations: [{ id: "location-1", organization_id: "organization-1", name: "Complex", address: "", active: true }],
    fields: [{ id: "field-1", organization_id: "organization-1", location_id: "location-1", name: "Field 1", active: true }]
  } });

  test("assigned umpire retains U1 presentation and required-reason decline workflow", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    await page.evaluate(async () => {
      await loginService.loginWithPassword("hosted.umpire@example.com", "password");
      renderPage("game-hub", { gameId: "game-decline" });
    });
    await expect(page.getByTestId("game-hub-summary-position")).toContainText("U1");
    await expect(page.getByTestId("game-hub-summary-time")).toContainText("6:30 PM");
    page.once("dialog", dialog => dialog.accept("Hosted schedule conflict"));
    await page.getByTestId("game-hub-decline-assignment").click();
    await expect(page.locator("body")).toHaveAttribute("data-page", "my-schedule");
    const state = await page.evaluate(() => {
      const assignment = assignmentService.getAssignments(gameService.getById("game-decline"))[0];
      return { crewId: assignment.crewId, status: assignment.status };
    });
    expect(state).toMatchObject({ crewId: "", status: "needs_assignment" });
  });
});
