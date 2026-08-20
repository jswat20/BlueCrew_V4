import { test, expect } from "@playwright/test";

test("publishes installable mobile metadata and branded icons", async ({ page, request }) => {
  await page.goto("/");

  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "manifest.webmanifest");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", "assets/icons/apple-touch-icon.png");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#0b0d10");
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute("content", "yes");

  const manifestResponse = await request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest).toMatchObject({
    name: "The Slate",
    short_name: "The Slate",
    start_url: "/",
    scope: "/",
    display: "standalone",
    theme_color: "#0b0d10",
    background_color: "#0b0d10"
  });
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ src: "assets/icons/icon-192.png", sizes: "192x192", type: "image/png" }),
    expect.objectContaining({ src: "assets/icons/icon-512.png", sizes: "512x512", type: "image/png" })
  ]));
  expect(manifest.icons.some(icon => icon.purpose.split(/\s+/).includes("maskable"))).toBe(true);

  const serviceWorkerResponse = await request.get("/service-worker.js");
  expect(serviceWorkerResponse.ok()).toBe(true);
  const serviceWorker = await serviceWorkerResponse.text();
  expect(serviceWorker).toContain('const SLATE_CACHE = "the-slate-shell-v2"');
  expect(serviceWorker).toContain('addEventListener("fetch"');
  expect(serviceWorker).toContain("keys.filter(key => key !== SLATE_CACHE)");

  for (const icon of ["icon-192.png", "icon-512.png", "apple-touch-icon.png", "favicon-32.png"]) {
    const response = await request.get(`/assets/icons/${icon}`);
    expect(response.ok(), icon).toBe(true);
    expect(response.headers()["content-type"]).toContain("image/png");
  }
});
