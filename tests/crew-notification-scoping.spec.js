const { test, expect } = require("@playwright/test");

test.describe("Crew notification targeting", () => {
  test.beforeEach(async ({ page }) => { await page.goto("/"); });

  test("only returns notifications for the logged-in crew account", async ({ page }) => {
    const result = await page.evaluate(() => {
      authService.loginAsAdmin();
      const crews = crewService.getAll().slice(0, 2);
      const createLinked = (crew, suffix) => {
        const account = accountService.createAccount({ firstName: `Crew${suffix}`, lastName: "Target", email: `crew-target-${suffix}@test.com` }).data;
        accountService.approveAccount(account.id);
        accountService.linkCrew(account.id, crew.id);
        return accountService.getById(account.id);
      };
      const first = createLinked(crews[0], "one");
      const second = createLinked(crews[1], "two");
      notificationService.create({ title: "First only", message: "Private first message", audience: "umpire", recipientAccountId: first.id });
      notificationService.create({ title: "Second only", message: "Private second message", audience: "umpire", recipientAccountId: second.id });
      loginService.login(first.email);
      authService.loginAsUmpire();
      return notificationService.getNotifications().map(item => item.title);
    });
    expect(result).toContain("First only");
    expect(result).not.toContain("Second only");
  });

  test("notifies an assigned crew member when an accepted game changes", async ({ page }) => {
    const titles = await page.evaluate(() => {
      notificationService.clearAll();
      authService.loginAsAdmin();
      const crew = crewService.getAll()[0];
      let account = accountService.getAll().find(item => String(item.crewId) === String(crew.id));
      if (!account) {
        account = accountService.createAccount({ firstName: "Assigned", lastName: "Official", email: "assigned-change@test.com" }).data;
        accountService.approveAccount(account.id);
        accountService.linkCrew(account.id, crew.id);
        account = accountService.getById(account.id);
      }
      const game = gameService.create({ date: "2099-09-12", time: "5:00 PM", awayTeam: "Change Away", homeTeam: "Change Home", locationComplex: "Central Complex", locationField: "Field 1", level: crew.levels[0], gameType: "single" }).data;
      assignmentService.assignPosition(game.id, assignmentService.getAssignments(game)[0].position, crew.id);
      notificationService.clearAll();
      gameService.update(game.id, { time: "6:30 PM" });
      loginService.login(account.email);
      authService.loginAsUmpire();
      return notificationService.getNotifications().map(item => `${item.title}: ${item.message}`);
    });
    expect(titles.join(" ")).toContain("Accepted Game Updated");
    expect(titles.join(" ")).toContain("5:00 PM");
    expect(titles.join(" ")).toContain("6:30 PM");
  });

  test("availability is locked to the authenticated crew identity", async ({ page }) => {
    await page.evaluate(() => {
      authService.loginAsUmpire();
      document.getElementById("app-content").innerHTML = renderAvailability();
    });
    await expect(page.getByTestId("availability-logged-in-crew")).toContainText("Verified from your login");
    await expect(page.getByTestId("availability-crew-select")).toHaveCount(0);
    const identity = await page.evaluate(() => {
      const authenticated = authService.currentCrewId();
      availabilityPageState.selectedCrewId = "not-the-current-crew";
      handleAvailabilityCrewChange("not-the-current-crew");
      return { authenticated: String(authenticated), selected: getAvailabilityCrewId() };
    });
    expect(identity.selected).toBe(identity.authenticated);
  });
});
