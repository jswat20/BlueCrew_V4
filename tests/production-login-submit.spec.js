import { test as base, expect } from "@playwright/test";
import { test as hostedTest } from "./fixtures/supabase-auth.fixture.js";
import fs from "node:fs";

function navigationCounter(page) {
  let count = 0;
  page.on("framenavigated", frame => {
    if (frame === page.mainFrame()) count += 1;
  });
  return {
    reset() { count = 0; },
    value() { return count; }
  };
}

hostedTest("Login button prevents native navigation and keeps invalid credentials on Login", async ({ supabaseAuthApp }) => {
  const { page } = supabaseAuthApp;
  const navigations = navigationCounter(page);
  await page.goto("/");
  navigations.reset();
  await page.getByTestId("login-email").fill("linked@example.com");
  await page.getByTestId("login-password").fill("wrong-password");
  await page.getByTestId("login-submit").click();
  await expect(page.getByTestId("login-message")).toContainText("Invalid login credentials");
  await expect(page.getByTestId("login-page")).toBeVisible();
  expect(page.url()).not.toMatch(/\?$/);
  expect(navigations.value()).toBe(0);
});

hostedTest("Enter-key submit prevents native navigation and calls hosted login", async ({ supabaseAuthApp }) => {
  const { page } = supabaseAuthApp;
  const navigations = navigationCounter(page);
  await page.goto("/");
  navigations.reset();
  await page.getByTestId("login-email").fill("linked@example.com");
  await page.getByTestId("login-password").fill("wrong-password");
  await page.getByTestId("login-password").press("Enter");
  await expect(page.getByTestId("login-message")).toContainText("Invalid login credentials");
  expect(page.url()).not.toMatch(/\?$/);
  expect(navigations.value()).toBe(0);
  const calls = await supabaseAuthApp.calls();
  expect(calls.filter(call => call.operation === "signInWithPassword")).toHaveLength(1);
});

hostedTest("valid hosted form login reaches the authenticated dashboard without reloading", async ({ supabaseAuthApp }) => {
  const { page } = supabaseAuthApp;
  const navigations = navigationCounter(page);
  await page.goto("/");
  navigations.reset();
  await page.getByTestId("login-email").fill("linked@example.com");
  await page.getByTestId("login-password").fill("correct horse battery staple");
  await page.getByTestId("login-submit").click();
  await expect.poll(() => page.evaluate(() => window.BlueCrew.test.currentPage)).toBe("dashboard");
  await expect(page.getByTestId("login-page")).toBeHidden();
  expect(navigations.value()).toBe(0);
});

base("curated production build contains CSP-compatible login wiring", () => {
  const login = fs.readFileSync("js/ui/login.js", "utf8");
  const app = fs.readFileSync("app.js", "utf8");
  const build = fs.readFileSync("scripts/build-production.cjs", "utf8");
  expect(login).toContain('form.addEventListener("submit", handleLoginSubmit)');
  expect(login).toContain("event.preventDefault()");
  expect(login).not.toContain('onsubmit="handleLoginSubmit(event)"');
  expect(app).toContain('page === "login" && typeof setupLoginForm === "function"');
  expect(build).toContain("script-src 'self' 'unsafe-inline';");
  expect(build).not.toContain("cdn.jsdelivr.net");
  expect(build).toContain('for (const entry of ["index.html", "manifest.webmanifest", "service-worker.js", "app.js", "styles.css", "assets", "components", "css", "data", "js"])');
});

base("production CSP permits the established inline interaction bindings", () => {
  const build = fs.readFileSync("scripts/build-production.cjs", "utf8");
  const settings = fs.readFileSync("components/settings.js", "utf8");
  expect(settings).toContain('onclick="addLocationComplexFromSettings()"');
  expect(build).toContain("script-src 'self' 'unsafe-inline';");
  expect(build).not.toContain("cdn.jsdelivr.net");
  expect(build).toContain("object-src 'none'");
  expect(build).toContain("frame-ancestors 'none'");
});

hostedTest.describe("production logout", () => {
  hostedTest.use({ supabaseScenario: { initialSession: true } });
  hostedTest("uses external wiring and signs out without navigation", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    await page.goto("/");
    await expect.poll(() => page.evaluate(() => window.BlueCrew.test.currentPage)).toBe("dashboard");
    await page.getByTestId("nav-logout").click();
    await expect(page.getByTestId("login-page")).toBeVisible();
    expect(page.url()).not.toMatch(/\?$/);
    expect((await supabaseAuthApp.calls()).some(call => call.operation === "signOut")).toBe(true);
  });
});

base("production shell has no CSP-blocked inline logout handler", () => {
  const index = fs.readFileSync("index.html", "utf8");
  const app = fs.readFileSync("app.js", "utf8");
  expect(index).not.toContain('onclick="logoutFromNavigation()"');
  expect(app).toContain('addEventListener("click", logoutFromNavigation)');
});

base("production recovery forms use CSP-compatible external listeners", () => {
  const security = fs.readFileSync("js/ui/accountSecurity.js", "utf8");
  expect(security).toContain('addEventListener("submit", handleForgotPassword)');
  expect(security).toContain('addEventListener("submit", handlePasswordRecovery)');
  expect(security).not.toContain('onsubmit="handleForgotPassword(event)"');
  expect(security).not.toContain('onsubmit="handlePasswordRecovery(event)"');
});

base("production Profile renderer uses a content-addressed script", () => {
  const build = fs.readFileSync("scripts/build-production.cjs", "utf8");
  const verify = fs.readFileSync("scripts/verify-production-artifact.cjs", "utf8");
  expect(build).toContain('"js/ui/crewCard.js", "js/ui/profile.js"');
  expect(verify).toContain('"js/ui/crewCard", "js/ui/profile"');
});
