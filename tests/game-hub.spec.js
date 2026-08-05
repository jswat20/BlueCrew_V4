import { test, expect } from "./fixtures/app.fixture.js";

async function setupGameHub(app, options = {}) {
  return app.page.evaluate(settings => {
    const accountResult = accountService.createAccount({ firstName: "Game", lastName: "Hub", email: `game.hub.${Date.now()}@example.com`, password: "password123" });
    const crew = crewService.getAll()[0];
    accountService.approveAccount(accountResult.data.id);
    accountService.updateAccount(accountResult.data.id, { crewId: crew.id });
    loginService.login(accountResult.data.email, "password123");
    authService.loginAsUmpire();
    const created = gameService.create({ date: settings.date || "2030-03-15", time: settings.time || "6:30 PM", locationComplex: "BlueCrew Sports Complex", locationField: "Game Hub Field", field: "Game Hub Field", venue: "BlueCrew Sports Complex", level: "12U", homeTeam: "Game Hub Home", awayTeam: "Game Hub Away", gameType: settings.gameType || "single", conditions: settings.conditions || {} });
    const game = gameService.getById(created.data.id);
    const assignment = assignmentService.getAssignments(game)[0];
    assignment.crewId = settings.assigned === false ? crewService.getAll().find(item => String(item.id) !== String(crew.id))?.id || "other-crew" : crew.id;
    assignment.position = settings.position || "Plate";
    assignment.status = "assigned";
    gameService.save();
    portalService.setNowProviderForTests(() => new Date(settings.now || "2030-03-15T18:31:00"));
    if (settings.status && settings.status !== "scheduled") gameService.transitionStatus(game.id, settings.status);
    renderPage("game-hub", { gameId: game.id });
    return { gameId: game.id };
  }, options);
}

test.afterEach(async ({ app }) => {
  await app.page.evaluate(() => portalService.setNowProviderForTests());
});

test.describe("Umpire Game Hub", () => {
  test("renders the simplified contract and no legacy cards", async ({ app }) => {
    const { gameId } = await setupGameHub(app, { conditions: { summary: "Sunny", temperature: "82° / 64°", fieldStatus: "Playable" } });
    await expect(app.page.getByTestId("game-hub-actions").getByRole("button")).toHaveCount(1);
    await expect(app.page.getByTestId("game-hub-back")).toContainText("Back to My Schedule");
    await expect(app.page.getByTestId("game-hub-availability")).toHaveCount(0);
    await expect(app.page.getByTestId("game-hub-claim-games")).toHaveCount(0);
    await expect(app.page.getByTestId("game-hub-matchup")).toHaveText("Game Hub Away @ Game Hub Home");
    await expect(app.page.getByTestId("game-hub-level-badge")).toHaveText("12U");
    await expect(app.page.getByTestId("game-hub-operational-status")).toHaveText("On Time");
    await expect(app.page.getByTestId("game-hub-weather")).toContainText("Sunny · 82° / 64° · Playable");
    await expect(app.page.getByTestId("game-hub-summary-date")).toContainText("2030-03-15");
    await expect(app.page.getByTestId("game-hub-summary-time")).toContainText("6:30 PM");
    await expect(app.page.getByTestId("game-hub-summary-location")).toContainText("BlueCrew Sports Complex");
    await expect(app.page.getByTestId("game-hub-summary-field")).toContainText("Game Hub Field");
    await expect(app.page.getByTestId("game-hub-assignment-badge")).toHaveText("You’re Assigned");
    await expect(app.page.getByTestId("game-hub-summary-position")).toContainText("Plate (solo)");
    for (const id of ["game-hub-checklist", "game-hub-section-game-information", "game-hub-section-arrival", "game-hub-section-game-day", "game-hub-section-timeline", "game-hub-section-conditions", "game-hub-section-status"]) await expect(app.page.getByTestId(id)).toHaveCount(0);
    await app.page.getByTestId("game-hub-back").click();
    await expect(app.page.getByTestId(`my-schedule-row-${gameId}`)).toBeVisible();
  });

  test("preserves Crew Notes", async ({ app }) => {
    const { gameId } = await setupGameHub(app);
    await app.page.getByTestId("game-hub-crew-notes-input").fill("Confirm plate meeting.");
    await app.page.getByTestId("game-hub-save-crew-notes").click();
    await expect(app.page.getByTestId("game-hub-crew-notes-status")).toContainText("saved");
    await app.page.evaluate(id => renderPage("game-hub", { gameId: id }), gameId);
    await expect(app.page.getByTestId("game-hub-crew-notes-input")).toHaveValue("Confirm plate meeting.");
  });

  test("does not expose another umpire's position or decline action", async ({ app }) => {
    await setupGameHub(app, { assigned: false, position: "B2" });
    await expect(app.page.getByTestId("game-hub-assignment-badge")).toHaveText("Assigned");
    await expect(app.page.getByTestId("game-hub-summary-position")).toHaveCount(0);
    await expect(app.page.getByTestId("game-hub-decline-assignment")).toHaveCount(0);
  });

  test("assigned umpire can decline with the existing required-reason workflow", async ({ app }) => {
    const { gameId } = await setupGameHub(app);
    app.page.once("dialog", dialog => dialog.accept("Pilot conflict"));
    await app.page.getByTestId("game-hub-decline-assignment").click();
    await expect(app.page.getByTestId("my-schedule")).toBeVisible();
    const state = await app.page.evaluate(id => { const game = gameService.getById(id); const assignment = assignmentService.getAssignments(game)[0]; return { crewId: assignment.crewId, status: assignment.status, reason: assignment.declineReason }; }, gameId);
    expect(state).toMatchObject({ crewId: "", reason: "Pilot conflict" });
    expect(["needs_assignment", "open_for_claim"]).toContain(state.status);
  });

  for (const [stored, expected, gameType] of [["B1", "B1", "threeMan"], ["B2", "B2", "threeMan"], ["B3", "B3", "fourMan"], ["Plate", "Plate (solo)", "single"], ["Base", "Base (2-man)", "twoMan"], ["Legacy Rover", "Legacy Rover", "threeMan"]]) {
    test(`maps ${stored} safely`, async ({ app }) => {
      await setupGameHub(app, { position: stored, gameType });
      await expect(app.page.getByTestId("game-hub-summary-position")).toContainText(expected);
    });
  }

  for (const [label, now, enabled] of [["before", "2030-03-15T18:29:00", false], ["exactly at", "2030-03-15T18:30:00", false], ["one minute after", "2030-03-15T18:31:00", true]]) {
    test(`completion is ${enabled ? "enabled" : "disabled"} ${label} start`, async ({ app }) => {
      await setupGameHub(app, { now });
      enabled ? await expect(app.page.getByTestId("game-hub-complete-game")).toBeEnabled() : await expect(app.page.getByTestId("game-hub-complete-game")).toBeDisabled();
    });
  }

  test("cancelled game cannot complete or decline", async ({ app }) => {
    await setupGameHub(app, { status: "cancelled" });
    await expect(app.page.getByTestId("game-hub-complete-game")).toBeDisabled();
    await expect(app.page.getByTestId("game-hub-decline-assignment")).toHaveCount(0);
    await expect(app.page.getByTestId("game-hub-operational-status")).toHaveText("Cancelled");
  });

  test("completion dialog validates, cancels safely, persists atomically, and restores focus", async ({ app }) => {
    const { gameId } = await setupGameHub(app);
    const trigger = app.page.getByTestId("game-hub-complete-game");
    await trigger.click();
    const dialog = app.page.getByTestId("game-hub-completion-dialog");
    await expect(dialog).toHaveAttribute("open", "");
    await expect(app.page.getByTestId("game-hub-completion-away-score")).toBeFocused();
    await app.page.getByTestId("game-hub-confirm-completion").click();
    await expect(app.page.getByTestId("game-hub-completion-dialog-error")).toContainText("whole numbers");
    await app.page.getByTestId("game-hub-cancel-completion").click();
    await expect(trigger).toBeFocused();
    expect(await app.page.evaluate(id => gameService.getById(id).completed, gameId)).not.toBe(true);
    await trigger.click();
    await app.page.getByTestId("game-hub-completion-away-score").fill("3");
    await app.page.getByTestId("game-hub-completion-home-score").fill("7");
    await app.page.getByTestId("game-hub-completion-notes").fill("Rain shortened; no ejections.");
    await app.page.getByTestId("game-hub-confirm-completion").click();
    await expect(app.page.getByTestId("game-hub-completion-complete")).toBeVisible();
    const saved = await app.page.evaluate(id => { const game = gameService.getById(id); return { status: gameService.getStatus(game), away: game.awayScore, home: game.homeScore, notes: game.reports.notes }; }, gameId);
    expect(saved).toEqual({ status: "completed", away: 3, home: 7, notes: "Rain shortened; no ejections." });
  });

  test("Escape closes the dialog and restores focus", async ({ app }) => {
    await setupGameHub(app);
    const trigger = app.page.getByTestId("game-hub-complete-game");
    await trigger.click();
    await app.page.keyboard.press("Escape");
    await expect(app.page.getByTestId("game-hub-completion-dialog")).not.toHaveAttribute("open", "");
    await expect(trigger).toBeFocused();
  });

  test("administrator command view remains separate", async ({ app }) => {
    const { gameId } = await setupGameHub(app);
    await app.page.evaluate(id => { authService.loginAsAdmin(); document.body.dataset.role = "admin"; renderPage("game-hub", { gameId: id }); }, gameId);
    await expect(app.page.getByTestId("game-hub-admin-view")).toBeVisible();
    await expect(app.page.locator('[data-umpire-summary="true"]')).toHaveCount(0);
  });

  test("summary remains usable at mobile width", async ({ app }) => {
    await app.page.setViewportSize({ width: 390, height: 844 });
    await setupGameHub(app);
    await expect(app.page.getByTestId("game-hub-summary")).toBeVisible();
    expect(await app.page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
});
