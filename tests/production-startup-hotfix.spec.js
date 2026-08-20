import { test as base, expect } from "@playwright/test";
import { test as hostedTest } from "./fixtures/supabase-auth.fixture.js";
import fs from "node:fs";
import crypto from "node:crypto";

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 }
]) {
  hostedTest(`Login initializes at ${viewport.name} width when third-party module hosts are blocked`, async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    const externalModuleRequests = [];
    await page.setViewportSize(viewport);
    await page.route(/https:\/\/(?:cdn\.jsdelivr\.net|esm\.sh|unpkg\.com)\//, route => {
      externalModuleRequests.push(route.request().url());
      return route.abort();
    });
    await page.goto("/");
    await expect(page.getByTestId("login-page")).toBeVisible();
    await expect(page.getByTestId("login-submit")).toBeEnabled();
    expect(await page.evaluate(() => typeof window.supabase?.createClient)).toBe("function");
    await page.getByTestId("login-email").fill("linked@example.com");
    await page.getByTestId("login-password").fill("wrong-password");
    await page.getByTestId("login-submit").click();
    await expect(page.getByTestId("login-message")).toContainText("Invalid login credentials");
    expect(externalModuleRequests).toEqual([]);
  });
}

base("source startup contains no remote Supabase module import", () => {
  const clientService = fs.readFileSync("js/services/supabaseClientService.js", "utf8");
  const index = fs.readFileSync("index.html", "utf8");
  const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
  expect(clientService).not.toMatch(/cdn\.jsdelivr\.net|esm\.sh|unpkg\.com|import\s*\(/i);
  expect(index).not.toMatch(/cdn\.jsdelivr\.net|esm\.sh|unpkg\.com/i);
  expect(index).toContain("node_modules/@supabase/supabase-js/dist/umd/supabase.js");
  expect(packageJson.dependencies["@supabase/supabase-js"]).toBe("2.112.2");
});

base("production artifact packages a fingerprinted same-origin Supabase client", () => {
  const index = fs.readFileSync("dist/index.html", "utf8");
  const reference = index.match(/vendor\/(supabase\.([a-f0-9]{12})\.js)/);
  expect(reference).toBeTruthy();
  const bundle = fs.readFileSync(`dist/vendor/${reference[1]}`);
  expect(crypto.createHash("sha256").update(bundle).digest("hex").slice(0, 12)).toBe(reference[2]);
  expect(index).not.toMatch(/cdn\.jsdelivr\.net|esm\.sh|unpkg\.com|node_modules\/@supabase/i);
  expect(index.indexOf(`vendor/${reference[1]}`)).toBeLessThan(index.indexOf("js/services/supabaseClientService.js"));
  expect(fs.readFileSync("dist/_headers", "utf8")).toMatch(/\/vendor\/\*[\s\S]*max-age=31536000,\s*immutable/i);
});

base("service worker rotates the shell cache and deletes incompatible predecessors", () => {
  const serviceWorker = fs.readFileSync("service-worker.js", "utf8");
  expect(serviceWorker).toContain('const SLATE_CACHE = "the-slate-shell-v2"');
  expect(serviceWorker).toContain("keys.filter(key => key !== SLATE_CACHE)");
  expect(serviceWorker).toContain("self.skipWaiting()");
  expect(serviceWorker).toContain("self.clients.claim()");
});
