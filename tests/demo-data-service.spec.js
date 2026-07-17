import { test, expect } from "./fixtures/app.fixture.js";

test.describe("Demo Data Service", () => {
  test("starts unloaded", async ({ app }) => {
    const summary = await app.page.evaluate(() =>
      demoDataService.getSummary()
    );

    expect(summary.loaded).toBe(false);
  });

  test("loads demo crew, games, and accounts", async ({ app }) => {
    const summary = await app.page.evaluate(() => {
      demoDataService.loadLeague();
      return demoDataService.getSummary();
    });

    expect(summary.loaded).toBe(true);
    expect(summary.crew).toBe(40);
    expect(summary.games).toBe(120);
    expect(summary.accounts).toBe(51);
  });

  test("loads realistic sample account states", async ({ app }) => {
    const accounts = await app.page.evaluate(() => {
      demoDataService.loadLeague();

      return accountService.getAll().map(account => ({
        id: account.id,
        email: account.email,
        status: account.status,
        crewId: account.crewId
      }));
    });

    expect(accounts).toHaveLength(51);

    expect(
      accounts.filter(account => account.status === "approved")
    ).toHaveLength(45);

    expect(
      accounts.filter(account => account.status === "pending")
    ).toHaveLength(4);

    expect(
      accounts.filter(account => account.status === "rejected")
    ).toHaveLength(2);

    expect(
      accounts.filter(account => account.status === "inactive")
    ).toHaveLength(0);

    expect(
      accounts.find(account =>
        account.email ===
          "ethan.parker@showcase.theslate.test"
      )
    ).toMatchObject({
      status: "approved",
      crewId: "showcase-crew-001"
    });

    expect(
      accounts.find(account =>
        account.email ===
          "noah.brooks@showcase.theslate.test"
      )
    ).toMatchObject({
      status: "approved",
      crewId: "showcase-crew-002"
    });
  });

  test("creates valid assignment models for demo games", async ({ app }) => {
    const result = await app.page.evaluate(() => {
      demoDataService.loadLeague();

      return gameService.getAll().map(game => ({
        id: game.id,
        gameType: game.gameType,
        assignments:
          assignmentService.getAssignments(game).length
      }));
    });

    expect(result).toHaveLength(120);

    expect(
      result.find(game => game.id === "showcase-game-001")
        .assignments
    ).toBe(1);

    expect(
      result.find(game => game.id === "showcase-game-002")
        .assignments
    ).toBe(2);
  });

  test("does not duplicate demo data or accounts", async ({ app }) => {
    const result = await app.page.evaluate(() => {
      demoDataService.loadLeague();
      demoDataService.loadLeague();

      const accounts = accountService.getAll();

      return {
        summary: demoDataService.getSummary(),
        accountEmails:
          accounts.map(account => account.email)
      };
    });

    expect(result.summary.crew).toBe(40);
    expect(result.summary.games).toBe(120);
    expect(result.summary.accounts).toBe(51);

    expect(new Set(result.accountEmails).size)
      .toBe(result.accountEmails.length);
  });

  test("restores original crew, games, and accounts", async ({ app }) => {
    const result = await app.page.evaluate(() => {
      const originalAccount =
        accountService.createAccount({
          id: "original-account",
          firstName: "Original",
          lastName: "Umpire",
          email: "original.umpire@test.com"
        }).data;

      accountService.approveAccount(originalAccount.id);

      const originalCrewMember = crewService.getAll()[0];

      accountService.linkCrew(
        originalAccount.id,
        originalCrewMember.id
      );

      const originalCrewIds =
        crewService.getAll().map(member => member.id);

      const originalGameIds =
        gameService.getAll().map(game => game.id);

      const originalAccounts =
        accountService.getAll().map(account => ({
          id: account.id,
          email: account.email,
          status: account.status,
          crewId: account.crewId
        }));

      demoDataService.loadLeague();
      demoDataService.resetLeague();

      return {
        originalCrewIds,
        restoredCrewIds:
          crewService.getAll().map(member => member.id),
        originalGameIds,
        restoredGameIds:
          gameService.getAll().map(game => game.id),
        originalAccounts,
        restoredAccounts:
          accountService.getAll().map(account => ({
            id: account.id,
            email: account.email,
            status: account.status,
            crewId: account.crewId
          }))
      };
    });

    expect(result.restoredCrewIds)
      .toEqual(result.originalCrewIds);

    expect(result.restoredGameIds)
      .toEqual(result.originalGameIds);

    expect(result.restoredAccounts)
      .toEqual(result.originalAccounts);
  });

  test("populates upcoming games on the dashboard", async ({ app }) => {
    await app.page.evaluate(() => {
      demoDataService.loadLeague();
      renderPage("dashboard");
    });

    const upcomingCount = await app.page
      .getByTestId("dashboard-summary-today-games-value")
      .textContent();

    expect(Number(upcomingCount)).toBeGreaterThan(0);

    await expect(
      app.page.getByTestId("dashboard-today-games")
    ).toBeVisible();
  });

  test("shows demo pending-account counts on the dashboard", async ({
    app
  }) => {
    await app.page.evaluate(() => {
      demoDataService.loadLeague();
      renderPage("dashboard");
    });

    await expect(
      app.page.getByTestId(
        "dashboard-summary-pending-accounts-value"
      )
    ).toHaveText("4");
  });
});
