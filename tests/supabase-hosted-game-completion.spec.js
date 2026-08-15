import {
  test,
  expect
} from "./fixtures/supabase-auth.fixture.js";

const pastGame = {
  id: "game-completion-1",
  organization_id: "organization-1",
  season_id: "season-1",
  location_id: "location-1",
  field_id: "field-1",
  game_date: "2020-08-20",
  game_time: "18:30:00",
  timezone: "America/New_York",
  home_team: "Hawks",
  away_team: "Bears",
  level: "12U",
  game_type: "single",
  lifecycle_status: "scheduled",
  review: {},
  report: {},
  source_metadata: {}
};

const ownAssignment = {
  id: "assignment-completion-1",
  organization_id: "organization-1",
  game_id: pastGame.id,
  position: "Plate",
  status: "assigned",
  assigned_crew_member_id: "crew-umpire-1",
  locked: false
};

const location = {
  id: "location-1",
  organization_id: "organization-1",
  name: "Central Complex",
  address: "1 Main St",
  active: true
};

const field = {
  id: "field-1",
  organization_id: "organization-1",
  location_id: location.id,
  name: "Field 1",
  active: true
};

async function login(page) {
  const result = await page.evaluate(() =>
    loginService.loginWithPassword(
      "linked@example.com",
      "correct horse battery staple"
    )
  );
  expect(result.success).toBe(true);
}

test.describe("Hosted game completion", () => {
  test.use({
    supabaseScenario: {
      locations: [location],
      fields: [field],
      games: [pastGame],
      assignments: [ownAssignment]
    }
  });

  test("persists completion and refreshes the shared snapshot", async ({
    supabaseAuthApp
  }) => {
    const { page, calls } = supabaseAuthApp;
    await login(page);

    const result = await page.evaluate(async gameId =>
      portalService.completeGame(gameId, {
        awayScore: "4",
        homeScore: "7",
        notes: "Rain-shortened. One ejection."
      }),
      pastGame.id
    );

    expect(result.success).toBe(true);

    const state = await page.evaluate(gameId => {
      const game = gameService.getById(gameId);
      return {
        status: gameService.getStatus(game),
        completed: game.completed,
        awayScore: game.awayScore,
        homeScore: game.homeScore,
        notes: game.report?.notes,
        completion:
          portalService.getGameCompletion(gameId)
      };
    }, pastGame.id);

    expect(state).toMatchObject({
      status: "completed",
      completed: true,
      awayScore: 4,
      homeScore: 7,
      notes: "Rain-shortened. One ejection."
    });

    expect(
      (await calls()).some(call =>
        call.operation === "rpc" &&
        call.name === "save_own_game_completion" &&
        call.args.p_game_id === pastGame.id
      )
    ).toBe(true);
  });

  test("rejects invalid scores before calling the RPC", async ({
    supabaseAuthApp
  }) => {
    const { page, calls } = supabaseAuthApp;
    await login(page);

    const result = await page.evaluate(async gameId =>
      portalService.completeGame(gameId, {
        awayScore: "-1",
        homeScore: "2"
      }),
      pastGame.id
    );

    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        message:
          "Enter non-negative whole numbers for both scores."
      })
    );

    expect(
      (await calls()).some(call =>
        call.operation === "rpc" &&
        call.name === "save_own_game_completion"
      )
    ).toBe(false);
  });

  test("rejects a game assigned to another crew member", async ({
    supabaseAuthApp
  }) => {
    const { page } = supabaseAuthApp;
    await login(page);

    await page.evaluate(gameId => {
      const fixture = window.__supabaseFixture;
      fixture.settings.assignments[0]
        .assigned_crew_member_id = "crew-other";
      return supabaseAuthService.refreshScheduling();
    }, pastGame.id);

    const result = await page.evaluate(async gameId =>
      portalService.completeGame(gameId, {
        awayScore: "1",
        homeScore: "2"
      }),
      pastGame.id
    );

    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        message:
          "You are not assigned to this game."
      })
    );
  });

  test("rejects cancelled games", async ({
    supabaseAuthApp
  }) => {
    const { page } = supabaseAuthApp;
    await login(page);

    await page.evaluate(async () => {
      window.__supabaseFixture.settings.games[0]
        .lifecycle_status = "cancelled";
      await supabaseAuthService.refreshScheduling();
    });

    const result = await page.evaluate(async gameId =>
      portalService.completeGame(gameId, {
        awayScore: "1",
        homeScore: "2"
      }),
      pastGame.id
    );

    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        message:
          "Cancelled games cannot be completed."
      })
    );
  });

  test("allows returned completion correction and preserves returned state", async ({
    supabaseAuthApp
  }) => {
    const { page } = supabaseAuthApp;
    await login(page);

    await page.evaluate(async () => {
      const game =
        window.__supabaseFixture.settings.games[0];
      game.lifecycle_status = "returned";
      game.review = {
        status: "returned",
        returnReason: "Correct score."
      };
      game.report = {
        completion: {
          completed: true,
          completionTime:
            "2026-08-01T20:00:00.000Z",
          awayScore: 2,
          homeScore: 3,
          notes: "Original"
        }
      };
      await supabaseAuthService.refreshScheduling();
    });

    const result = await page.evaluate(async gameId =>
      portalService.updateCompletedGame(gameId, {
        awayScore: "5",
        homeScore: "6",
        notes: "Corrected after review."
      }),
      pastGame.id
    );

    expect(result.success).toBe(true);

    const game = await page.evaluate(gameId =>
      gameService.getById(gameId),
      pastGame.id
    );

    expect(game).toMatchObject({
      lifecycleStatus: "returned",
      awayScore: 5,
      homeScore: 6
    });
    expect(game.report.notes).toBe(
      "Corrected after review."
    );
  });

  test("rejects finalized reviews", async ({
    supabaseAuthApp
  }) => {
    const { page } = supabaseAuthApp;
    await login(page);

    await page.evaluate(async () => {
      const game =
        window.__supabaseFixture.settings.games[0];
      game.lifecycle_status = "approved";
      game.review = {
        status: "approved",
        finalized: true
      };
      await supabaseAuthService.refreshScheduling();
    });

    const result = await page.evaluate(async gameId =>
      gameService.saveOwnCompletion(gameId, {
        awayScore: 1,
        homeScore: 2,
        notes: ""
      }),
      pastGame.id
    );

    expect(result.success).toBe(false);
    expect(result.error.message).toContain(
      "game_completion_finalized"
    );
  });
});

