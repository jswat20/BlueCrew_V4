import { test, expect } from "@playwright/test";

test.describe("Portal Pending Claims", () => {
  test("returns pending claims for the current umpire account", async ({ page }) => {
    await page.goto("/");

    const pendingClaims = await page.evaluate(() => {
      localStorage.removeItem("bluecrew_accounts");

      const account = accountService.createAccount({
        firstName: "Pending",
        lastName: "Claimant",
        email: `pending.claimant-${Date.now()}@example.com`
      }).data;

      accountService.approveAccount(account.id);

      const crewMember = crewService.getAll()[0];

      accountService.linkCrew(account.id, crewMember.id);

      loginService.login(account.email);

      const game = gameService.create({
        date: new Date().toISOString().split("T")[0],
        time: "6:00 PM",
        field: "Field 1",
        level: "12U",
        homeTeam: "Pending Claims Home",
        awayTeam: "Pending Claims Away",
        gameType: "single"
      }).data;

      assignmentService.openForClaim(game.id);

      portalService.claimGame(game.id, `${game.id}-plate`);

      return portalService.getMyPendingClaims();
    });

    expect(pendingClaims).toHaveLength(1);
    expect(pendingClaims[0].game.homeTeam).toBe("Pending Claims Home");
    expect(pendingClaims[0].assignment.status).toBe("pending_approval");
  });

  test("does not return claims from another umpire account", async ({ page }) => {
    await page.goto("/");

    const pendingClaims = await page.evaluate(() => {
      localStorage.removeItem("bluecrew_accounts");

      const crewMembers = crewService.getAll();

      const first = accountService.createAccount({
        firstName: "First",
        lastName: "Claimant",
        email: `first.claimant-${Date.now()}@example.com`
      }).data;

      const second = accountService.createAccount({
        firstName: "Second",
        lastName: "Claimant",
        email: `second.claimant-${Date.now()}@example.com`
      }).data;

      accountService.approveAccount(first.id);
      accountService.approveAccount(second.id);

      accountService.linkCrew(first.id, crewMembers[0].id);
      accountService.linkCrew(second.id, crewMembers[1].id);

      loginService.login(first.email);

      const game = gameService.create({
        date: new Date().toISOString().split("T")[0],
        time: "6:30 PM",
        field: "Field 2",
        level: "10U",
        homeTeam: "Other Claims Home",
        awayTeam: "Other Claims Away",
        gameType: "single"
      }).data;

      assignmentService.openForClaim(game.id);

      portalService.claimGame(game.id, `${game.id}-plate`);

      loginService.login(second.email);

      return portalService.getMyPendingClaims();
    });

    expect(pendingClaims).toHaveLength(0);
  });
});