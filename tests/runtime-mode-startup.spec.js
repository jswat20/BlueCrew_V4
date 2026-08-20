import { test as base, expect } from "@playwright/test";
import { test as hostedTest } from "./fixtures/supabase-auth.fixture.js";
import { readFileSync } from "node:fs";

base("explicit local-test mode preserves local behavior", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("page-dashboard")).toBeVisible();
  expect(await page.evaluate(() => supabaseClientService.getRuntimeMode())).toBe("local");
  expect(await page.evaluate(() => gameService.getAll().length)).toBeGreaterThan(0);
});

base("missing hosted configuration blocks local and demo data", async ({ page }) => {
  await page.addInitScript(() => {
    window.BLUECREW_RUNTIME_CONFIG = Object.freeze({ mode: "hosted" });
    window.BLUECREW_SUPABASE_CONFIG = Object.freeze({ mode: "hosted", url: "", publishableKey: "" });
  });
  await page.goto("/");
  await expect(page.getByTestId("hosted-configuration-error")).toBeVisible();
  await expect(page.getByText("Do not continue with schedule or account changes.")).toBeVisible();
  expect(await page.evaluate(() => ({ games: gameService.getAll().length, crew: crewService.getAll().length, user: authService.getCurrentUser() }))).toEqual({ games: 0, crew: 0, user: null });
});

base("missing hosted browser dependency is distinct from invalid configuration", async ({ browser }) => {
  const context = await browser.newContext({ serviceWorkers: "block" });
  const page = await context.newPage();
  try {
    await page.route("**/*", route => decodeURIComponent(route.request().url()).includes("/node_modules/@supabase/supabase-js/dist/umd/supabase.js")
      ? route.abort()
      : route.continue());
    await page.addInitScript(() => {
      window.BLUECREW_RUNTIME_CONFIG = Object.freeze({ mode: "hosted" });
      window.BLUECREW_SUPABASE_CONFIG = Object.freeze({ mode: "hosted", url: "https://fixture.supabase.co", publishableKey: "sb_publishable_fixture" });
    });
    await page.goto("http://127.0.0.1:5501/");
    await expect(page.getByTestId("hosted-dependency-error")).toBeVisible();
    await expect(page.getByText("The Slate could not load a required application component.")).toBeVisible();
    await expect(page.getByTestId("hosted-configuration-error")).toHaveCount(0);
  } finally {
    await context.close();
  }
});

hostedTest.describe("hosted runtime reload", () => {
  const profile = { id: "profile-runtime", auth_user_id: "auth-runtime", organization_id: "organization-1", first_name: "Hosted", last_name: "Admin", email: "hosted@example.com", role: "administrator", status: "approved", communication_preferences: {} };
  const game = { id: "game-runtime", organization_id: "organization-1", season_id: "season-1", location_id: "location-runtime", field_id: "field-runtime", game_date: "2099-09-10", game_time: "18:00:00", home_team: "Home", away_team: "Away", level: "12U", game_type: "single", lifecycle_status: "scheduled", review: {}, report: {}, source_metadata: {} };
  hostedTest.use({ supabaseScenario: { profile, crewId: null, initialSession: true, organization: { id: "organization-1", name: "Hosted", settings: {} }, locations: [{ id: "location-runtime", organization_id: "organization-1", name: "Complex", active: true }], fields: [{ id: "field-runtime", organization_id: "organization-1", location_id: "location-runtime", name: "Field 1", active: true }], games: [game], assignments: [] } });

  hostedTest("valid hosted config restores its session and snapshots after hard reload", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    await expect.poll(() => page.evaluate(() => window.BlueCrew.test.currentPage)).toBe("dashboard");
    expect(await page.evaluate(() => ({ mode: supabaseClientService.getRuntimeMode(), configured: supabaseClientService.isConfigured(), games: gameService.getAll().length, email: loginService.getCurrentAccount()?.email }))).toEqual({ mode: "hosted", configured: true, games: 1, email: "hosted@example.com" });
    await page.reload();
    await expect.poll(() => page.evaluate(() => window.BlueCrew.test.currentPage)).toBe("dashboard");
    expect(await page.evaluate(() => ({ configured: supabaseClientService.isConfigured(), games: gameService.getAll().length, email: loginService.getCurrentAccount()?.email }))).toEqual({ configured: true, games: 1, email: "hosted@example.com" });
  });
});

base("Playwright uses an isolated origin and does not serve the manual config file", async ({ page }) => {
  await page.goto("/");
  expect(new URL(page.url()).origin).toBe("http://127.0.0.1:5501");
  expect(await page.evaluate(() => supabaseClientService.getRuntimeMode())).toBe("local");
});

base("Playwright startup cannot overwrite the manual hosted configuration", () => {
  const setup = readFileSync("tests/global-setup.cjs", "utf8");
  const config = readFileSync("playwright.config.js", "utf8");
  expect(setup).not.toContain("generate-supabase-config");
  expect(config).toContain("http://127.0.0.1:5501");
  expect(config).toContain("scripts/playwright-server.cjs");
});
