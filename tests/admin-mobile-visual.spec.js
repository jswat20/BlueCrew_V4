import fs from "node:fs";
import path from "node:path";
import { test, expect } from "./fixtures/app.fixture.js";

const outputDirectory = process.env.ADMIN_MOBILE_VISUAL_OUTPUT_DIR || "";
const visualPhoto = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mNk+M/wn4GBgYGJAQoAHgQCAf5lL8sAAAAASUVORK5CYII=";

async function capture(page, testInfo, name) {
  const target = outputDirectory ? path.join(outputDirectory, `${name}.png`) : testInfo.outputPath(`${name}.png`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  await page.screenshot({ path: target, fullPage: true });
}

async function seedAdminPage(app, pageName) {
  await app.page.evaluate(target => {
    authService.loginAsAdmin();
    document.body.dataset.role = "administrator";
    const today = new Date().toISOString().split("T")[0];
    const gameCount = target === "operations-center" ? 12 : 4;
    for (let index = 0; index < gameCount; index += 1) {
      gameService.create({
        date: today,
        time: `${10 + index}:30 AM`,
        level: index % 2 ? "12U" : "8U",
        locationComplex: "Lake Shore Athletic Complex",
        locationField: `Field ${index + 1}`,
        field: `Field ${index + 1}`,
        homeTeam: `Home Club ${index + 1}`,
        awayTeam: `Visiting Club ${index + 1}`,
        gameType: index % 2 ? "twoMan" : "single"
      });
    }
    renderPage(target);
  }, pageName);
}

const baseScenarios = [
  ["operations-center-portrait", { width: 390, height: 844 }, "operations-center"],
  ["operations-center-landscape", { width: 844, height: 390 }, "operations-center"],
  ["assigner-workbench-portrait", { width: 390, height: 844 }, "assigner-workbench"],
  ["assigner-workbench-landscape", { width: 844, height: 390 }, "assigner-workbench"],
  ["dashboard-regression-portrait", { width: 390, height: 844 }, "dashboard"],
  ["schedule-calendar-portrait", { width: 390, height: 844 }, "schedule"],
  ["schedule-calendar-landscape", { width: 844, height: 390 }, "schedule"],
  ["schedule-game-cards-portrait", { width: 390, height: 844 }, "schedule"],
  ["crew-list-portrait", { width: 390, height: 844 }, "crew"]
];

for (const [name, viewport, pageName] of baseScenarios) {
  test(`admin visual acceptance: ${name}`, async ({ app }, testInfo) => {
    await app.page.setViewportSize(viewport);
    await app.page.emulateMedia({ reducedMotion: "reduce" });
    await seedAdminPage(app, pageName);
    await expect(app.page.locator("main")).toBeVisible();
    await capture(app.page, testInfo, name);
  });
}

for (const [name, viewport] of [
  ["crew-member-detail-portrait", { width: 390, height: 844 }],
  ["crew-member-detail-landscape", { width: 844, height: 390 }],
  ["edit-crew-member-portrait", { width: 390, height: 844 }],
  ["edit-crew-member-landscape", { width: 844, height: 390 }]
]) {
  test(`admin visual acceptance: ${name}`, async ({ app }, testInfo) => {
    await app.page.setViewportSize(viewport);
    await app.page.emulateMedia({ reducedMotion: "reduce" });
    await seedAdminPage(app, "crew");
    await app.page.evaluate(photo => {
      const member = crewService.getAll()[0];
      const account = accountService.getAll().find(candidate => String(candidate.crewId) === String(member?.id));
      if (account) accountService.updateCrewProfileAsAdmin(account.id, { photoDataUrl: photo });
      renderPage("crew");
    }, visualPhoto);
    await app.page.getByRole("button", { name: /Open Crew Card/ }).first().click();
    if (name.startsWith("edit-")) {
      await app.page.evaluate(() => openCrewCardAdminEditMode(crewService.getAll()[0].id));
      await expect(app.page.getByTestId("crew-card-admin-edit-mode")).toBeVisible();
    } else {
      await expect(app.page.getByTestId("crew-card-dialog")).toBeVisible();
    }
    await capture(app.page, testInfo, name);
  });
}

for (const [name, viewport] of [
  ["admin-profile-crew-card-portrait", { width: 390, height: 844 }],
  ["admin-profile-crew-card-landscape", { width: 844, height: 390 }]
]) {
  test(`admin visual acceptance: ${name}`, async ({ app }, testInfo) => {
    await app.page.setViewportSize(viewport);
    await app.page.emulateMedia({ reducedMotion: "reduce" });
    await app.page.evaluate(() => {
      authService.loginAsAdmin();
      document.body.dataset.role = "administrator";
      document.body.dataset.page = "profile";
      const model = getCrewCardModel({
        id: "admin-profile-visual",
        role: "administrator",
        firstName: "Alex",
        lastName: "Administrator",
        email: "administrator@example.com",
        status: "approved"
      });
      document.querySelector("main").innerHTML = `<section class="unified-profile-page"><div class="unified-profile-card profile-baseball-card is-front"><div class="profile-card-stage"><div class="profile-card-orientation"><div class="crew-credential-flipper">${renderCrewCredentialFrontFace(model, { profileDesign: true })}</div></div></div></div></section>`;
      updateHeader("profile");
    });
    await expect(app.page.getByTestId("profile-card-role")).toHaveText("ADMINISTRATOR");
    await expect(app.page.getByTestId("profile-portrait-front")).toHaveAttribute("data-card-role", "administrator");
    await capture(app.page, testInfo, name);
  });
}

test("admin visual acceptance: admin-navigation-header", async ({ app }, testInfo) => {
  await app.page.setViewportSize({ width: 390, height: 844 });
  await app.page.evaluate(() => {
    authService.loginAsAdmin();
    document.body.dataset.role = "administrator";
    updateHeader("dashboard");
    document.querySelector(".sidebar")?.classList.add("open");
  });
  await expect(app.page.getByTestId("portal-identity")).toHaveText("Administrator Portal");
  await capture(app.page, testInfo, "admin-navigation-header");
});
