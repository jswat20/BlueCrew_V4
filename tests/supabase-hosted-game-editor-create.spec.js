import { test, expect } from "./fixtures/supabase-auth.fixture.js";
import { GameEditorPage } from "./pages/GameEditorPage.js";

const administrator = {
  id: "profile-hosted-game-admin",
  auth_user_id: "auth-hosted-game-admin",
  organization_id: "organization-1",
  first_name: "Hosted",
  last_name: "Administrator",
  email: "hosted-game-admin@example.com",
  role: "administrator",
  status: "approved",
  communication_preferences: {}
};
const location = { id: "location-hosted-game", organization_id: "organization-1", name: "Lake Shore", active: true };
const field = { id: "field-hosted-game-6", organization_id: "organization-1", location_id: location.id, name: "Field 6", active: true };

async function login(page) {
  await page.evaluate(async () => loginService.loginWithPassword("hosted-game-admin@example.com", "password"));
}

async function openHostedAddGame(editor) {
  await editor.page.evaluate(() => renderPage("schedule"));
  await editor.page.getByTestId("add-game").click();
  await editor.expectOpen();
}

test.describe("Hosted Add Game persistence", () => {
  test.use({
    supabaseScenario: {
      profile: administrator,
      crewId: null,
      locations: [location],
      fields: [field],
      games: [],
      assignments: []
    }
  });

  test("Administrator creates a scrimmage through the hosted RPC and it survives schedule refresh", async ({ supabaseAuthApp }) => {
    const { page, calls } = supabaseAuthApp;
    const editor = new GameEditorPage(page);
    await login(page);

    await openHostedAddGame(editor);
    await editor.fillGame({
      date: "2099-09-30",
      time: "5:30 PM",
      field: "Field 6",
      level: "12U",
      homeTeam: "Hosted Home",
      awayTeam: "Hosted Away",
      gameType: "scrimmage"
    });
    await editor.save();

    await editor.expectGameVisible({
      date: "2099-09-30",
      field: "Field 6",
      homeTeam: "Hosted Home",
      awayTeam: "Hosted Away"
    });

    const persisted = await page.evaluate(async () => {
      const firstSnapshot = gameService.getAll();
      const refresh = await supabaseAuthService.refreshScheduling();
      renderPage("schedule");
      const refreshed = gameService.getAll();
      return {
        refresh,
        first: firstSnapshot.find(game => game.homeTeam === "Hosted Home"),
        refreshed: refreshed.find(game => game.homeTeam === "Hosted Home"),
        backendGames: window.__supabaseFixture.settings.games.length,
        backendAssignments: window.__supabaseFixture.settings.assignments.map(assignment => assignment.position)
      };
    });

    const rpcCalls = (await calls()).filter(call => call.name === "import_schedule_games");
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].args.p_games[0]).toMatchObject({
      date: "2099-09-30",
      time: "5:30 PM",
      field: "Field 6",
      gameType: "scrimmage",
      positions: ["Plate"]
    });
    expect(persisted.refresh.success).toBe(true);
    expect(persisted.backendGames).toBe(1);
    expect(persisted.backendAssignments).toEqual(["Plate"]);
    expect(persisted.first).toMatchObject({ gameType: "scrimmage", assignments: [{ position: "Plate" }] });
    expect(persisted.refreshed?.id).toBe(persisted.first?.id);
  });

  test("hosted persistence failure stays in the editor and reports an error", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    const editor = new GameEditorPage(page);
    await login(page);
    await page.evaluate(() => { window.__supabaseFixture.settings.failedRpc = "import_schedule_games"; });
    await openHostedAddGame(editor);
    await editor.fillGame({
      date: "2099-09-30",
      time: "5:30 PM",
      field: "Field 6",
      level: "12U",
      homeTeam: "Failure Home",
      awayTeam: "Failure Away",
      gameType: "scrimmage"
    });
    await editor.save();

    await expect(page.getByTestId("game-editor")).toBeVisible();
    await expect(page.getByText("Transactional write failed")).toBeVisible();
    expect(await page.evaluate(() => window.__supabaseFixture.settings.games.length)).toBe(0);
  });

  test("retrying the same hosted create key returns the existing game without duplication", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    await login(page);
    const result = await page.evaluate(async () => {
      const game = {
        externalGameId: "manual-retry-hosted-game",
        date: "2099-09-30",
        time: "5:30 PM",
        locationComplex: "Lake Shore",
        locationField: "Field 6",
        field: "Field 6",
        level: "12U",
        homeTeam: "Retry Home",
        awayTeam: "Retry Away",
        gameType: "scrimmage",
        assignmentStatus: "needs_assignment"
      };
      const first = await gameService.create(game);
      const retry = await gameService.create(game);
      return {
        first,
        retry,
        gameCount: window.__supabaseFixture.settings.games.length,
        assignmentCount: window.__supabaseFixture.settings.assignments.length
      };
    });

    expect(result.first.success).toBe(true);
    expect(result.retry.success).toBe(true);
    expect(result.retry.data.id).toBe(result.first.data.id);
    expect(result.gameCount).toBe(1);
    expect(result.assignmentCount).toBe(1);
  });
});
