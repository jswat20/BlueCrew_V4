import { test, expect } from "./fixtures/app.fixture.js";

async function createAssignmentScenario(page, suffix) {
  return page.evaluate(scenarioSuffix => {
    const gameId = `assignment-auth-game-${scenarioSuffix}`;
    const assignmentId = `assignment-auth-slot-${scenarioSuffix}`;

    const game = {
      id: gameId,
      date: "2099-07-15",
      time: "18:00",
      field: "Authorization Field",
      level: "Varsity",
      gameType: "single",
      crewSize: 1,
      crewId: "",
      claimedBy: "",
      assignmentStatus: "needs_assignment",
      assignmentMode: "manual",
      assignments: [
        {
          id: assignmentId,
          gameId,
          position: "Plate",
          crewId: "",
          claimedBy: "",
          status: "needs_assignment",
          locked: false
        }
      ]
    };

    const existingIndex = games.findIndex(
      item => String(item.id) === gameId
    );

    if (existingIndex >= 0) {
      games.splice(existingIndex, 1);
    }

    games.push(game);

    return {
      gameId,
      assignmentId,
      crewId: 1
    };
  }, suffix);
}

test.describe("Assignment Action Authorization", () => {
  test("administrator may assign a slot directly", async ({ app }) => {
    const scenario = await createAssignmentScenario(
      app.page,
      "administrator"
    );

    const result = await app.page.evaluate(
      ({ gameId, assignmentId, crewId }) => {
        authService.loginAsAdmin();

        return assignmentService.assignToAssignment(
          gameId,
          assignmentId,
          crewId
        );
      },
      scenario
    );

    expect(result.success).toBe(true);
    expect(String(result.data.crewId)).toBe(
      String(scenario.crewId)
    );
    expect(result.data.status).toBe("assigned");
  });

  test("assigner may assign a slot directly", async ({ app }) => {
    const scenario = await createAssignmentScenario(
      app.page,
      "assigner"
    );

    const result = await app.page.evaluate(
      ({ gameId, assignmentId, crewId }) => {
        authService.loginAsAssigner();

        return assignmentService.assignToAssignment(
          gameId,
          assignmentId,
          crewId
        );
      },
      scenario
    );

    expect(result.success).toBe(true);
    expect(String(result.data.crewId)).toBe(
      String(scenario.crewId)
    );
    expect(result.data.status).toBe("assigned");
  });

  test("umpire cannot assign a slot directly", async ({ app }) => {
    const scenario = await createAssignmentScenario(
      app.page,
      "umpire"
    );

    const result = await app.page.evaluate(
      ({ gameId, assignmentId, crewId }) => {
        authService.loginAsUmpire();

        return assignmentService.assignToAssignment(
          gameId,
          assignmentId,
          crewId
        );
      },
      scenario
    );

    expect(result.success).toBe(false);
    expect(result.message).toBe("Unauthorized.");
    expect(result.data).toBeNull();
  });

  test("unauthorized direct assignment does not modify the slot", async ({
    app
  }) => {
    const scenario = await createAssignmentScenario(
      app.page,
      "unchanged"
    );

    const result = await app.page.evaluate(
      ({ gameId, assignmentId, crewId }) => {
        authService.loginAsUmpire();

        const game = gameService.getById(gameId);
        const assignment = game.assignments.find(
          item => String(item.id) === String(assignmentId)
        );

        const before = JSON.stringify(assignment);

        const mutation =
          assignmentService.assignToAssignment(
            gameId,
            assignmentId,
            crewId
          );

        const updatedGame = gameService.getById(gameId);
        const updatedAssignment =
          updatedGame.assignments.find(
            item =>
              String(item.id) === String(assignmentId)
          );

        return {
          mutation,
          before,
          after: JSON.stringify(updatedAssignment)
        };
      },
      scenario
    );

    expect(result.mutation.success).toBe(false);
    expect(result.mutation.message).toBe("Unauthorized.");
    expect(result.after).toBe(result.before);
  });
});

test.describe("Assignment Position Authorization", () => {
  test("administrator may assign a slot by position", async ({ app }) => {
    const scenario = await createAssignmentScenario(
      app.page,
      "position-administrator"
    );

    const result = await app.page.evaluate(
      ({ gameId, crewId }) => {
        authService.loginAsAdmin();

        return assignmentService.assignPosition(
          gameId,
          "Plate",
          crewId
        );
      },
      scenario
    );

    expect(result.success).toBe(true);
    expect(String(result.data.crewId)).toBe(
      String(scenario.crewId)
    );
    expect(result.data.status).toBe("assigned");
  });

  test("assigner may clear a slot by position", async ({ app }) => {
    const scenario = await createAssignmentScenario(
      app.page,
      "position-clear"
    );

    const result = await app.page.evaluate(
      ({ gameId, crewId }) => {
        authService.loginAsAssigner();

        const assigned = assignmentService.assignPosition(
          gameId,
          "Plate",
          crewId
        );

        const cleared = assignmentService.clearPosition(
          gameId,
          "Plate"
        );

        return {
          assigned,
          cleared
        };
      },
      scenario
    );

    expect(result.assigned.success).toBe(true);
    expect(result.cleared.success).toBe(true);
    expect(result.cleared.data.crewId).toBe("");
    expect(result.cleared.data.status).toBe(
      "needs_assignment"
    );
  });

  test("umpire cannot assign a slot by position", async ({ app }) => {
    const scenario = await createAssignmentScenario(
      app.page,
      "position-umpire"
    );

    const result = await app.page.evaluate(
      ({ gameId, crewId }) => {
        authService.loginAsUmpire();

        return assignmentService.assignPosition(
          gameId,
          "Plate",
          crewId
        );
      },
      scenario
    );

    expect(result.success).toBe(false);
    expect(result.message).toBe("Unauthorized.");
    expect(result.data).toBeNull();
  });

  test("unauthorized clear by position does not modify the slot", async ({
    app
  }) => {
    const scenario = await createAssignmentScenario(
      app.page,
      "position-unchanged"
    );

    const result = await app.page.evaluate(
      ({ gameId, assignmentId, crewId }) => {
        authService.loginAsAdmin();

        const assigned = assignmentService.assignPosition(
          gameId,
          "Plate",
          crewId
        );

        if (!assigned.success) {
          return {
            setup: assigned,
            mutation: null,
            before: null,
            after: null
          };
        }

        const game = gameService.getById(gameId);
        const assignment = game.assignments.find(
          item => String(item.id) === String(assignmentId)
        );

        const before = JSON.stringify(assignment);

        authService.loginAsUmpire();

        const mutation = assignmentService.clearPosition(
          gameId,
          "Plate"
        );

        const updatedGame = gameService.getById(gameId);
        const updatedAssignment =
          updatedGame.assignments.find(
            item =>
              String(item.id) === String(assignmentId)
          );

        return {
          setup: assigned,
          mutation,
          before,
          after: JSON.stringify(updatedAssignment)
        };
      },
      scenario
    );

    expect(result.setup.success).toBe(true);
    expect(result.mutation.success).toBe(false);
    expect(result.mutation.message).toBe("Unauthorized.");
    expect(result.after).toBe(result.before);
  });
});

test.describe("Assignment Slot State Authorization", () => {
  test("administrator may open a slot for claims", async ({ app }) => {
    const scenario = await createAssignmentScenario(
      app.page,
      "open-administrator"
    );

    const result = await app.page.evaluate(
      ({ gameId, assignmentId }) => {
        authService.loginAsAdmin();

        return assignmentService.openAssignmentForClaims(
          gameId,
          assignmentId
        );
      },
      scenario
    );

    expect(result.success).toBe(true);
    expect(result.data.crewId).toBe("");
    expect(result.data.claimedBy).toBe("");
    expect(result.data.status).toBe("open_for_claim");
    expect(result.data.locked).toBe(false);
  });

  test("umpire cannot open a slot for claims", async ({ app }) => {
    const scenario = await createAssignmentScenario(
      app.page,
      "open-umpire"
    );

    const result = await app.page.evaluate(
      ({ gameId, assignmentId }) => {
        authService.loginAsUmpire();

        const game = gameService.getById(gameId);
        const assignment = game.assignments.find(
          item => String(item.id) === String(assignmentId)
        );

        const before = JSON.stringify(assignment);

        const mutation =
          assignmentService.openAssignmentForClaims(
            gameId,
            assignmentId
          );

        const updatedGame = gameService.getById(gameId);
        const updatedAssignment =
          updatedGame.assignments.find(
            item =>
              String(item.id) === String(assignmentId)
          );

        return {
          mutation,
          before,
          after: JSON.stringify(updatedAssignment)
        };
      },
      scenario
    );

    expect(result.mutation.success).toBe(false);
    expect(result.mutation.message).toBe("Unauthorized.");
    expect(result.after).toBe(result.before);
  });

  test("assigner may clear an assignment slot", async ({ app }) => {
    const scenario = await createAssignmentScenario(
      app.page,
      "clear-assigner"
    );

    const result = await app.page.evaluate(
      ({ gameId, assignmentId, crewId }) => {
        authService.loginAsAssigner();

        const assigned =
          assignmentService.assignToAssignment(
            gameId,
            assignmentId,
            crewId
          );

        const cleared =
          assignmentService.clearAssignmentSlot(
            gameId,
            assignmentId
          );

        return {
          assigned,
          cleared
        };
      },
      scenario
    );

    expect(result.assigned.success).toBe(true);
    expect(result.cleared.success).toBe(true);
    expect(result.cleared.data.crewId).toBe("");
    expect(result.cleared.data.claimedBy).toBe("");
    expect(result.cleared.data.status).toBe(
      "needs_assignment"
    );
    expect(result.cleared.data.locked).toBe(false);
  });

  test("umpire cannot clear an assignment slot", async ({ app }) => {
    const scenario = await createAssignmentScenario(
      app.page,
      "clear-umpire"
    );

    const result = await app.page.evaluate(
      ({ gameId, assignmentId, crewId }) => {
        authService.loginAsAdmin();

        const setup = assignmentService.assignToAssignment(
          gameId,
          assignmentId,
          crewId
        );

        const game = gameService.getById(gameId);
        const assignment = game.assignments.find(
          item => String(item.id) === String(assignmentId)
        );

        const before = JSON.stringify(assignment);

        authService.loginAsUmpire();

        const mutation =
          assignmentService.clearAssignmentSlot(
            gameId,
            assignmentId
          );

        const updatedGame = gameService.getById(gameId);
        const updatedAssignment =
          updatedGame.assignments.find(
            item =>
              String(item.id) === String(assignmentId)
          );

        return {
          setup,
          mutation,
          before,
          after: JSON.stringify(updatedAssignment)
        };
      },
      scenario
    );

    expect(result.setup.success).toBe(true);
    expect(result.mutation.success).toBe(false);
    expect(result.mutation.message).toBe("Unauthorized.");
    expect(result.after).toBe(result.before);
  });

  test("administrator may lock an assignment slot", async ({ app }) => {
    const scenario = await createAssignmentScenario(
      app.page,
      "lock-administrator"
    );

    const result = await app.page.evaluate(
      ({ gameId, assignmentId, crewId }) => {
        authService.loginAsAdmin();

        const assigned =
          assignmentService.assignToAssignment(
            gameId,
            assignmentId,
            crewId
          );

        const locked =
          assignmentService.lockAssignmentSlot(
            gameId,
            assignmentId
          );

        return {
          assigned,
          locked
        };
      },
      scenario
    );

    expect(result.assigned.success).toBe(true);
    expect(result.locked.success).toBe(true);
    expect(String(result.locked.data.crewId)).toBe(
      String(scenario.crewId)
    );
    expect(result.locked.data.status).toBe("locked");
    expect(result.locked.data.locked).toBe(true);
  });

  test("umpire cannot lock an assignment slot", async ({ app }) => {
    const scenario = await createAssignmentScenario(
      app.page,
      "lock-umpire"
    );

    const result = await app.page.evaluate(
      ({ gameId, assignmentId, crewId }) => {
        authService.loginAsAdmin();

        const setup = assignmentService.assignToAssignment(
          gameId,
          assignmentId,
          crewId
        );

        const game = gameService.getById(gameId);
        const assignment = game.assignments.find(
          item => String(item.id) === String(assignmentId)
        );

        const before = JSON.stringify(assignment);

        authService.loginAsUmpire();

        const mutation =
          assignmentService.lockAssignmentSlot(
            gameId,
            assignmentId
          );

        const updatedGame = gameService.getById(gameId);
        const updatedAssignment =
          updatedGame.assignments.find(
            item =>
              String(item.id) === String(assignmentId)
          );

        return {
          setup,
          mutation,
          before,
          after: JSON.stringify(updatedAssignment)
        };
      },
      scenario
    );

    expect(result.setup.success).toBe(true);
    expect(result.mutation.success).toBe(false);
    expect(result.mutation.message).toBe("Unauthorized.");
    expect(result.after).toBe(result.before);
  });
});
