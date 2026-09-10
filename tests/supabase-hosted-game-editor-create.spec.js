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

  test("distinct hosted create keys remain distinct for an ordinary game type", async ({ supabaseAuthApp }) => {
    const { page, calls } = supabaseAuthApp;
    await login(page);
    const result = await page.evaluate(async () => {
      const shared = {
        date: "2099-10-01",
        time: "5:30 PM",
        locationComplex: "Lake Shore",
        locationField: "Field 6",
        field: "Field 6",
        level: "12U",
        gameType: "twoMan",
        assignmentStatus: "needs_assignment"
      };
      const first = await gameService.create({
        ...shared,
        externalGameId: "manual-distinct-hosted-game-1",
        homeTeam: "Distinct Home One",
        awayTeam: "Distinct Away One"
      });
      const second = await gameService.create({
        ...shared,
        externalGameId: "manual-distinct-hosted-game-2",
        homeTeam: "Distinct Home Two",
        awayTeam: "Distinct Away Two"
      });
      return {
        first,
        second,
        gameCount: window.__supabaseFixture.settings.games.length,
        assignmentCount: window.__supabaseFixture.settings.assignments.length
      };
    });

    const rpcCalls = (await calls()).filter(call => call.name === "import_schedule_games");
    expect(result.first.success).toBe(true);
    expect(result.second.success).toBe(true);
    expect(result.second.data.id).not.toBe(result.first.data.id);
    expect(result.gameCount).toBe(2);
    expect(result.assignmentCount).toBe(4);
    expect(rpcCalls).toHaveLength(2);
    expect(rpcCalls.map(call => call.args.p_games[0].externalGameId)).toEqual([
      "manual-distinct-hosted-game-1",
      "manual-distinct-hosted-game-2"
    ]);
    expect(rpcCalls[0].args.p_games[0].positions).toEqual(["Plate", "Base"]);
  });

  test("Administrator deletes a hosted scrimmage and its assignment stays deleted after refresh", async ({ supabaseAuthApp }) => {
    const { page, calls } = supabaseAuthApp;
    const editor = new GameEditorPage(page);
    await login(page);

    const game = {
      date: "2099-09-30",
      time: "5:30 PM",
      field: "Field 6",
      level: "12U",
      homeTeam: "Hosted Delete Home",
      awayTeam: "Hosted Delete Away",
      gameType: "scrimmage"
    };

    await openHostedAddGame(editor);
    await editor.fillGame(game);
    await editor.save();
    await editor.expectGameVisible(game);
    await editor.deleteGame(game);
    await editor.expectGameNotVisible(game);

    const persisted = await page.evaluate(async () => {
      const refresh = await supabaseAuthService.refreshScheduling();
      renderPage("schedule");
      return {
        refresh,
        backendGames: window.__supabaseFixture.settings.games.length,
        backendAssignments: window.__supabaseFixture.settings.assignments.length,
        visibleGames: gameService.getAll().map(item => item.homeTeam)
      };
    });

    const deleteCall = (await calls()).find(call => call.name === "delete_schedule_game");
    expect(deleteCall?.args.p_game_id).toBeTruthy();
    expect(persisted.refresh.success).toBe(true);
    expect(persisted.backendGames).toBe(0);
    expect(persisted.backendAssignments).toBe(0);
    expect(persisted.visibleGames).not.toContain("Hosted Delete Home");
  });

  test("hosted deletion cascades claims and nulls communication references", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    const editor = new GameEditorPage(page);
    await login(page);

      const game = {
        date: "2099-09-30",
        time: "5:30 PM",
        field: "Field 6",
        level: "12U",
        homeTeam: "Cascade Home",
        awayTeam: "Cascade Away",
        gameType: "scrimmage"
      };

    await openHostedAddGame(editor);
    await editor.fillGame(game);
    await editor.save();
    const result = await page.evaluate(async () => {
      const settings = window.__supabaseFixture.settings;
      const created = settings.games.find(item => item.home_team === "Cascade Home");
      const assignment = settings.assignments.find(item => item.game_id === created.id);
      settings.claims.push({ id: "delete-claim", organization_id: created.organization_id, assignment_id: assignment.id, status: "pending" });
      settings.communicationEvents.push({ id: "delete-event", organization_id: created.organization_id, game_id: created.id, assignment_id: assignment.id });
      const mutation = await gameService.delete(created.id);
      return { mutation, settings };
    });
    expect(result.mutation).toMatchObject({ success: true, status: "deleted", data: { deletedGameCount: 1, deletedAssignmentCount: 1, deletedClaimCount: 1 } });
    expect(result.settings.games).toHaveLength(0);
    expect(result.settings.assignments).toHaveLength(0);
    expect(result.settings.claims).toHaveLength(0);
    expect(result.settings.communicationEvents[0]).toMatchObject({ game_id: null, assignment_id: null });
  });

  test("RPC failure reports an error and preserves the game and editor", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    const editor = new GameEditorPage(page);
    await login(page);

    const game = {
      date: "2099-09-30",
      time: "5:30 PM",
      field: "Field 6",
      level: "12U",
      homeTeam: "Hosted Delete Failure Home",
      awayTeam: "Hosted Delete Failure Away",
      gameType: "scrimmage"
    };

    await openHostedAddGame(editor);
    await editor.fillGame(game);
    await editor.save();
    await page.evaluate(() => { window.__supabaseFixture.settings.failedRpc = "delete_schedule_game"; });
    await editor.deleteGame(game);

    await expect(page.getByTestId("game-editor")).toBeVisible();
    await expect(page.getByText("Transactional write failed")).toBeVisible();
    expect(await page.evaluate(() => window.__supabaseFixture.settings.games.length)).toBe(1);
  });

  test("zero-row authoritative result cannot produce success or close the editor", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    const editor = new GameEditorPage(page);
    await login(page);
    const game = { date: "2099-09-30", time: "5:30 PM", field: "Field 6", level: "12U", homeTeam: "Zero Row Home", awayTeam: "Zero Row Away", gameType: "scrimmage" };
    await openHostedAddGame(editor);
    await editor.fillGame(game);
    await editor.save();
    await page.evaluate(() => { window.__supabaseFixture.settings.deleteScheduleGameMode = "zero_row"; });
    await editor.deleteGame(game);
    await expect(page.getByTestId("game-editor")).toBeVisible();
    await expect(page.getByText("Game deletion was not confirmed by the server.")).toBeVisible();
    expect(await page.evaluate(() => window.__supabaseFixture.settings.games.length)).toBe(1);
  });

  test("confirmed deletion followed by refresh failure reports persistence accurately", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    await login(page);
    const result = await page.evaluate(async () => {
      const created = await gameService.create({ externalGameId: "refresh-failure-delete", date: "2099-09-30", time: "5:30 PM", locationComplex: "Lake Shore", locationField: "Field 6", field: "Field 6", level: "12U", homeTeam: "Refresh Failure Home", awayTeam: "Refresh Failure Away", gameType: "scrimmage" });
      window.__supabaseFixture.settings.deniedTable = "games";
      return gameService.delete(created.data.id);
    });
    expect(result).toMatchObject({ success: false, data: { persisted: true, status: "deleted" } });
    expect(result.message).toContain("Game was deleted, but the schedule refresh failed");
  });

  test("contradictory refreshed snapshot cannot produce transient false success", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    await login(page);
    const result = await page.evaluate(async () => {
      const created = await gameService.create({ externalGameId: "contradictory-delete", date: "2099-09-30", time: "5:30 PM", locationComplex: "Lake Shore", locationField: "Field 6", field: "Field 6", level: "12U", homeTeam: "Contradiction Home", awayTeam: "Contradiction Away", gameType: "scrimmage" });
      window.__supabaseFixture.settings.deleteScheduleGameMode = "contradictory_refresh";
      return gameService.delete(created.data.id);
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain("refreshed schedule still contains the game");
    expect(await page.evaluate(() => window.__supabaseFixture.settings.games.length)).toBe(1);
  });

  test("already-absent retry is idempotent after authoritative refresh", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    await login(page);
    const result = await page.evaluate(async () => {
      const created = await gameService.create({ externalGameId: "already-absent-delete", date: "2099-09-30", time: "5:30 PM", locationComplex: "Lake Shore", locationField: "Field 6", field: "Field 6", level: "12U", homeTeam: "Absent Home", awayTeam: "Absent Away", gameType: "scrimmage" });
      window.__supabaseFixture.settings.games = [];
      window.__supabaseFixture.settings.assignments = [];
      return gameService.delete(created.data.id);
    });
    expect(result).toMatchObject({ success: true, status: "already_absent", idempotent: true });
    expect(await page.evaluate(() => gameService.getAll())).toEqual([]);
  });

  test("unauthorized delete is rejected without changing the target", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    await login(page);
    const result = await page.evaluate(async () => {
      const created = await gameService.create({ externalGameId: "unauthorized-delete", date: "2099-09-30", time: "5:30 PM", locationComplex: "Lake Shore", locationField: "Field 6", field: "Field 6", level: "12U", homeTeam: "Unauthorized Home", awayTeam: "Unauthorized Away", gameType: "scrimmage" });
      window.__supabaseFixture.settings.profile.role = "umpire";
      return gameService.delete(created.data.id);
    });
    expect(result).toMatchObject({ success: false, message: "game_delete_forbidden" });
    expect(await page.evaluate(() => window.__supabaseFixture.settings.games.length)).toBe(1);
  });

  test("cross-organization target is not deleted or disclosed", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    await login(page);
    const result = await page.evaluate(async () => {
      const settings = window.__supabaseFixture.settings;
      settings.games.push({ id: "other-org-game", organization_id: "organization-2", game_date: "2099-09-30", game_time: "17:30", home_team: "Other Home", away_team: "Other Away", level: "12U", game_type: "scrimmage", lifecycle_status: "scheduled", assignments: [] });
      gameService.publishSharedGames({ games: [sharedDomainMappingService.mapGame(settings.games[0], { assignments: [], claimsByAssignment: new Map() })], referencedCrew: [] });
      return gameService.delete("other-org-game");
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain("refreshed schedule still contains the game");
    expect(await page.evaluate(() => window.__supabaseFixture.settings.games.some(item => item.id === "other-org-game"))).toBe(true);
  });
});
