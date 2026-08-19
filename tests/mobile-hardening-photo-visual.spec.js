import fs from "node:fs";
import path from "node:path";
import { test, expect } from "./fixtures/supabase-auth.fixture.js";

const visualOutputDirectory = process.env.MOBILE_VISUAL_OUTPUT_DIR || "";

for (const scenario of [
  { name: "edit-my-information-portrait-390x844", viewport: { width: 390, height: 844 } },
  { name: "edit-my-information-landscape-844x390", viewport: { width: 844, height: 390 } }
]) {
  test(`visual acceptance: ${scenario.name}`, async ({ supabaseAuthApp }, testInfo) => {
    const { page } = supabaseAuthApp;
    await page.setViewportSize(scenario.viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(async () => { await loginService.loginWithPassword("linked@example.com", "password"); renderPage("profile"); });
    await page.getByTestId("profile-card-back").click();
    await page.getByTestId("profile-edit-crew-card").click();
    const editor = page.getByTestId("crew-card-self-edit-shell");
    await expect(editor).toBeVisible();
    await expect(page.getByTestId("profile-photo-input")).toBeVisible();
    const collisions = await editor.evaluate(element => {
      const header = element.querySelector(".crew-card-edit-header").getBoundingClientRect();
      const photo = element.querySelector(".profile-photo-editor").getBoundingClientRect();
      const photoHeading = element.querySelector(".profile-photo-editor > h3").getBoundingClientRect();
      return {
        scrollTop: element.scrollTop,
        overlaps: photo.top < header.bottom - 1,
        headingClipped: photoHeading.top < photo.top - 1 || photoHeading.bottom > photo.bottom + 1
      };
    });
    expect(collisions).toEqual({ scrollTop: 0, overlaps: false, headingClipped: false });
    await page.getByTestId("profile-photo-input").focus();
    const focusedClearance = await editor.evaluate(element => {
      const header = element.querySelector(".crew-card-edit-header").getBoundingClientRect();
      const heading = element.querySelector(".profile-photo-editor > h3").getBoundingClientRect();
      return heading.bottom > header.bottom;
    });
    expect(focusedClearance).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    const target = visualOutputDirectory
      ? path.join(visualOutputDirectory, `${scenario.name}.png`)
      : testInfo.outputPath(`${scenario.name}.png`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    await page.screenshot({ path: target, fullPage: true });
  });
}
