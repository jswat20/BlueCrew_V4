import { test, expect } from "./fixtures/supabase-auth.fixture.js";

const game = {
  id: "game-future-assigned",
  organization_id: "organization-1",
  season_id: "season-1",
  location_id: "location-future",
  field_id: "field-future",
  game_date: "2099-06-15",
  game_time: "18:30:00",
  timezone: "America/New_York",
  home_team: "Hawks",
  away_team: "Bears",
  level: "12U",
  game_type: "twoMan",
  lifecycle_status: "scheduled",
  review: {},
  report: {},
  source_metadata: {}
};

test.describe("Hosted assigned umpire schedule", () => {
  test.use({
    supabaseScenario: {
      locations: [{ id: "location-future", organization_id: "organization-1", name: "Pilot Complex", address: "1 Pilot Way", active: true }],
      fields: [{ id: "field-future", organization_id: "organization-1", location_id: "location-future", name: "Field A", active: true }],
      games: [game],
      assignments: [{
        id: "assignment-future",
        organization_id: "organization-1",
        game_id: game.id,
        position: "Plate",
        status: "assigned",
        assigned_crew_member_id: "crew-umpire-1",
        locked: false
      }]
    }
  });

  test("future assignment appears in My Schedule and opens Game Hub", async ({ supabaseAuthApp }) => {
    const { page, calls } = supabaseAuthApp;
    const state = await page.evaluate(async () => {
      const login = await loginService.loginWithPassword("linked@example.com", "password");
      const schedule = portalService.getMySchedule();
      renderPage("my-schedule");
      return {
        login,
        crewId: loginService.getCurrentAccount()?.crewId,
        ids: schedule.map(item => item.id),
        assignment: gameService.getById("game-future-assigned")?.assignments?.[0]
      };
    });
    expect(state.login.success).toBe(true);
    expect(state.crewId).toBe("crew-umpire-1");
    expect(state.ids).toContain(game.id);
    expect(state.assignment).toMatchObject({ crewId: "crew-umpire-1", status: "assigned" });
    await expect(page.getByTestId(`my-schedule-row-${game.id}`)).toBeVisible();
    await page.getByTestId(`my-schedule-open-game-${game.id}`).click();
    await expect(page.getByTestId("game-hub-summary")).toContainText("Bears @ Hawks");
    await expect(page.getByTestId("game-hub-summary-position")).toContainText("Plate");

    const queried = (await calls()).filter(call => call.operation === "select").map(call => call.table);
    expect(queried).toContain("games");
    expect(queried).toContain("game_assignments");
  });
});
