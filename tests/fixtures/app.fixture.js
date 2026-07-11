import { test as base } from "@playwright/test";

import { GameEditorPage } from "../pages/GameEditorPage.js";
import { AssignmentPage } from "../pages/AssignmentPage.js";

export const test = base.extend({
  app: async ({ page }, use) => {
    await page.goto("/");

    const app = {
      page,

      gameEditorPage: new GameEditorPage(page),

      assignmentPage: new AssignmentPage(page),

      async loginAsApprovedUmpire() {
        await page.evaluate(() => {
          localStorage.removeItem("bluecrew_accounts");

          const account = accountService.createAccount({
            firstName: "Test",
            lastName: "Umpire",
            email: `umpire-${Date.now()}@test.com`
          }).data;

          accountService.approveAccount(account.id);

          const crewMember = crewService.getAll()[0];

          accountService.linkCrew(account.id, crewMember.id);

          loginService.login(account.email);

          authService.loginAsUmpire();
document.body.dataset.role = "umpire";

if (typeof refreshNavigationAuthorization === "function") {
  refreshNavigationAuthorization();
}

if (window.BlueCrew?.test) {
  window.BlueCrew.test.currentRole = "umpire";
}

if (window.qaService) {
  qaService.setRole("umpire");
}
        });
      },

async createPendingClaim(overrides = {}) {
  await this.loginAsApprovedUmpire();

  await page.evaluate((gameOverrides) => {
    const game = gameService.create({
      date: new Date().toISOString().split("T")[0],
      time: "6:00 PM",
      field: "Field 1",
      level: "12U",
      homeTeam: "Pending Home",
      awayTeam: "Pending Away",
      gameType: "single",
      ...gameOverrides
    }).data;

    assignmentService.openForClaim(game.id);

    portalService.claimGame(game.id, `${game.id}-plate`);
  }, overrides);
}
    };

    await use(app);
  }
});

export { expect } from "@playwright/test";