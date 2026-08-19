import fs from "node:fs";
import path from "node:path";
import { test, expect } from "./fixtures/app.fixture.js";

const visualOutputDirectory = process.env.MOBILE_VISUAL_OUTPUT_DIR || "";

async function capture(page, testInfo, name) {
  const target = visualOutputDirectory
    ? path.join(visualOutputDirectory, `${name}.png`)
    : testInfo.outputPath(`${name}.png`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  await page.screenshot({ path: target, fullPage: true });
}

async function openProfile(app, back = false) {
  await app.loginAsApprovedUmpire();
  await app.page.evaluate(() => renderPage("profile"));
  if (back) await app.page.getByTestId("profile-card-back").click();
}

async function openClaimGames(app) {
  await app.loginAsApprovedUmpire();
  await app.page.evaluate(() => {
    const account = loginService.getCurrentAccount();
    const game = gameService.create({
      date: "2099-09-12", time: "10:00", level: "8U",
      locationComplex: "Lake Shore Youth Baseball", locationField: "Field 6", field: "Field 6",
      homeTeam: "Home", awayTeam: "Away", gameType: "single"
    }).data;
    authService.loginAsAdmin();
    assignmentService.openForClaims(game.id);
    authService.useAuthenticatedAccount(account);
    renderPage("claim-games");
  });
}

const scenarios = [
  { name: "my-schedule-portrait-390x844", viewport: { width: 390, height: 844 }, open: async app => { await app.loginAsApprovedUmpire(); await app.page.evaluate(() => renderPage("my-schedule")); }, locator: '[data-testid="my-schedule"]' },
  { name: "my-schedule-landscape-844x390", viewport: { width: 844, height: 390 }, open: async app => { await app.loginAsApprovedUmpire(); await app.page.evaluate(() => renderPage("my-schedule")); }, locator: '[data-testid="my-schedule"]' },
  { name: "crew-card-front-portrait-390x844", viewport: { width: 390, height: 844 }, open: app => openProfile(app), locator: '.profile-card-stage' },
  { name: "crew-card-back-portrait-390x844", viewport: { width: 390, height: 844 }, open: app => openProfile(app, true), locator: '[data-testid="crew-card-back"]' },
  { name: "crew-card-front-landscape-844x390", viewport: { width: 844, height: 390 }, open: app => openProfile(app), locator: '.profile-card-stage' },
  { name: "crew-card-back-landscape-844x390", viewport: { width: 844, height: 390 }, open: app => openProfile(app, true), locator: '[data-testid="crew-card-back"]' },
  { name: "claim-games-portrait-390x844", viewport: { width: 390, height: 844 }, open: openClaimGames, locator: '[data-testid="claim-games"]' },
  { name: "claim-games-landscape-844x390", viewport: { width: 844, height: 390 }, open: openClaimGames, locator: '[data-testid="claim-games"]' }
];

for (const scenario of scenarios) {
  test(`visual acceptance: ${scenario.name}`, async ({ app }, testInfo) => {
    await app.page.setViewportSize(scenario.viewport);
    await app.page.emulateMedia({ reducedMotion: "reduce" });
    await scenario.open(app);
    await expect(app.page.locator(scenario.locator)).toBeVisible();
    const overflow = await app.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await capture(app.page, testInfo, scenario.name);
  });
}
