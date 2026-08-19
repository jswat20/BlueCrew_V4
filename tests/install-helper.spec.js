import { test, expect } from "@playwright/test";

async function overrideInstallEnvironment(page, { userAgent, platform = "", maxTouchPoints = 0, standalone = false } = {}) {
  await page.addInitScript(({ userAgent, platform, maxTouchPoints, standalone }) => {
    Object.defineProperty(navigator, "userAgent", { configurable: true, get: () => userAgent });
    Object.defineProperty(navigator, "platform", { configurable: true, get: () => platform });
    Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, get: () => maxTouchPoints });
    Object.defineProperty(navigator, "standalone", { configurable: true, get: () => standalone });
    if (standalone) {
      const original = window.matchMedia.bind(window);
      window.matchMedia = query => query === "(display-mode: standalone)" ? { matches: true, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } } : original(query);
    }
  }, { userAgent, platform, maxTouchPoints, standalone });
}

test("iPhone and iPad users receive the native Safari Home Screen steps", async ({ page }) => {
  await overrideInstallEnvironment(page, { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1", platform: "iPhone", maxTouchPoints: 5 });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const trigger = page.getByTestId("nav-install");
  await expect(trigger).toBeVisible();
  await trigger.click();
  const dialog = page.getByTestId("install-helper-dialog");
  await expect(dialog).toContainText("Tap the Share button");
  await expect(dialog).toContainText("Add to Home Screen");
  await expect(dialog).toContainText("Tap Add");
});

test("Android uses the direct browser install prompt when available", async ({ page }) => {
  await overrideInstallEnvironment(page, { userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36", platform: "Linux armv8l", maxTouchPoints: 5 });
  await page.goto("/");
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt");
    Object.defineProperties(event, {
      prompt: { value: () => { window.__slateInstallPrompted = true; return Promise.resolve(); } },
      userChoice: { value: Promise.resolve({ outcome: "accepted" }) }
    });
    window.dispatchEvent(event);
  });
  await page.getByTestId("nav-install").click();
  await expect.poll(() => page.evaluate(() => window.__slateInstallPrompted)).toBe(true);
  await expect(page.getByTestId("install-helper-dialog")).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
  await expect(page.getByTestId("nav-install")).toBeHidden();
});

test("an accepted choice never reports installed before appinstalled", async ({ page }) => {
  await overrideInstallEnvironment(page, { userAgent: "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36", platform: "Linux armv8l", maxTouchPoints: 5 });
  await page.goto("/");
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt");
    Object.assign(event, { prompt: async () => {}, userChoice: Promise.resolve({ outcome: "accepted" }) });
    window.dispatchEvent(event);
  });
  await page.getByTestId("nav-install").click();
  await expect(page.getByTestId("install-helper-dialog")).toHaveCount(0);
  await expect(page.getByTestId("nav-install")).toBeHidden();
});

test("a dismissed install choice gives retry-safe feedback", async ({ page }) => {
  await overrideInstallEnvironment(page, { userAgent: "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36", platform: "Linux armv8l", maxTouchPoints: 5 });
  await page.goto("/");
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt");
    Object.assign(event, { prompt: async () => {}, userChoice: Promise.resolve({ outcome: "dismissed" }) });
    window.dispatchEvent(event);
  });
  await page.getByTestId("nav-install").click();
  await expect(page.getByTestId("install-status")).toContainText("not completed");
});

test("Chromium Android does not show fallback instructions before the native event is available", async ({ page }) => {
  await overrideInstallEnvironment(page, { userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36", platform: "Linux armv8l", maxTouchPoints: 5 });
  await page.goto("/");
  await expect(page.getByTestId("nav-install")).toBeHidden();
  await expect(page.getByTestId("install-helper-dialog")).toHaveCount(0);
});

test("Android shows browser menu instructions when direct install is unavailable", async ({ page }) => {
  await overrideInstallEnvironment(page, { userAgent: "Mozilla/5.0 (Android 15; Mobile; rv:141.0) Gecko/141.0 Firefox/141.0", platform: "Linux armv8l", maxTouchPoints: 5 });
  await page.goto("/");
  await page.getByTestId("nav-install").click();
  await expect(page.getByTestId("install-instructions")).toContainText("Install app");
  await expect(page.getByTestId("install-instructions")).toContainText("Add to Home screen");
  await expect(page.getByTestId("install-confirm")).toHaveCount(0);
});

test("standalone mode suppresses install guidance", async ({ page }) => {
  await overrideInstallEnvironment(page, { userAgent: "Mozilla/5.0 (iPhone) Mobile Safari/604.1", platform: "iPhone", maxTouchPoints: 5, standalone: true });
  await page.goto("/");
  await expect(page.getByTestId("nav-install")).toBeHidden();
});

test("dismissal restores focus and the persistent action reopens help", async ({ page }) => {
  await overrideInstallEnvironment(page, { userAgent: "Mozilla/5.0 (iPhone) Mobile Safari/604.1", platform: "iPhone", maxTouchPoints: 5 });
  await page.goto("/");
  const trigger = page.getByTestId("nav-install");
  await trigger.click();
  await page.getByTestId("install-close").click();
  await expect(page.getByTestId("install-helper-dialog")).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(page.getByTestId("install-helper-dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("install-helper-dialog")).not.toBeVisible();
});

test("install help fits the smallest supported phone without page overflow", async ({ page }) => {
  await overrideInstallEnvironment(page, { userAgent: "Mozilla/5.0 (iPhone) Mobile Safari/604.1", platform: "iPhone", maxTouchPoints: 5 });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");
  await page.getByTestId("nav-install").click();
  const dialog = page.getByTestId("install-helper-dialog");
  const layout = await dialog.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const buttons = [...element.querySelectorAll("button")].map(button => button.getBoundingClientRect());
    return { width: rect.width, height: rect.height, viewportWidth: document.documentElement.clientWidth, viewportHeight: document.documentElement.clientHeight, pageWidth: document.documentElement.scrollWidth, minButtonHeight: Math.min(...buttons.map(rectangle => rectangle.height)) };
  });
  expect(layout.width).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.height).toBeLessThanOrEqual(layout.viewportHeight);
  expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
  expect(layout.minButtonHeight).toBeGreaterThanOrEqual(44);
});
