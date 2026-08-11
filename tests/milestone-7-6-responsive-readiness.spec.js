import { test, expect } from "@playwright/test";

const devices = [
  ["320 phone", 320, 568], ["360 phone", 360, 800], ["375 phone", 375, 667],
  ["iPhone 15 Pro", 390, 844], ["Pixel 8", 414, 896], ["600 compact tablet", 600, 960],
  ["iPad", 768, 1024], ["iPad landscape", 1024, 768], ["iPad Pro", 820, 1180],
  ["laptop", 1366, 768], ["desktop", 1440, 900], ["large desktop", 1920, 1080]
];

async function expectContained(page, label = "page") {
  const size = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    offenders: [...document.querySelectorAll("body *")].filter(element => element.getBoundingClientRect().right > document.documentElement.clientWidth + 1).slice(0, 5).map(element => `${element.tagName}.${element.className}`)
  }));
  expect(size.document, `${label}: ${size.offenders.join(", ")}`).toBeLessThanOrEqual(size.viewport + 1);
}

for (const [name, width, height] of devices) {
  test(`${name} keeps the application shell contained`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await page.evaluate(() => { authService.loginAsAdmin(); renderPage("dashboard"); });
    await expect(page.getByTestId("page-dashboard")).toBeVisible();
    await expectContained(page);
    const firstNav = page.locator(".nav-link:visible").first();
    const box = await firstNav.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(width <= 1000 ? 44 : 34);
  });
}

test("phone portrait and landscape contain every pilot navigation destination", async ({ page }) => {
  const pages = ["dashboard", "operations-center", "assigner-workbench", "schedule", "claims-queue", "claim-history", "notifications", "crew", "accounts", "settings", "profile"];
  for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    for (const destination of pages) {
      await page.evaluate(value => { authService.loginAsAdmin(); renderPage(value); }, destination);
      await expect(page.locator(`[data-testid="page-${destination}"]`)).toBeVisible();
      await expectContained(page, `${destination} at ${viewport.width}x${viewport.height}`);
    }
  }
});

test("umpire phone workflows reflow without page-level horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  for (const destination of ["dashboard", "claim-games", "my-schedule", "availability", "notifications", "profile"]) {
    await page.evaluate(value => { authService.loginAsUmpire(); renderPage(value); }, destination);
    await expect(page.locator(`[data-testid="page-${destination}"]`)).toBeVisible();
    await expectContained(page);
  }
});

test("scrolling table regions are keyboard focusable and labelled", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/");
  await page.evaluate(() => { authService.loginAsAdmin(); renderPage("schedule"); });
  await page.getByRole("button", { name: "All Games" }).click();
  await page.waitForTimeout(50);
  const regions = page.locator(".schedule-table-wrap, .schedule-table-wrapper, .presentation-table-wrapper, .table-wrapper");
  const count = await regions.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    await expect(regions.nth(index)).toHaveAttribute("tabindex", "0");
    await expect(regions.nth(index)).toHaveAttribute("role", "region");
    await expect(regions.nth(index)).toHaveAttribute("aria-label", /table/i);
  }
});

test("crew and password dialogs fit the smallest supported phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");
  await page.evaluate(() => { authService.loginAsAdmin(); renderPage("crew"); });
  const crewButton = page.locator('[data-testid="crew-roster-member"]').first();
  if (await crewButton.count()) {
    await crewButton.click();
    const dialog = page.getByTestId("crew-card-dialog");
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box.width).toBeLessThanOrEqual(320);
    expect(box.height).toBeLessThanOrEqual(568);
    await page.keyboard.press("Escape");
    await expect(crewButton).toBeFocused();
  }
  await page.evaluate(() => { document.body.dataset.role = "administrator"; openChangePasswordDialog(); });
  const password = page.getByTestId("change-password-dialog");
  await expect(password).toBeVisible();
  const passwordBox = await password.boundingBox();
  expect(passwordBox.width).toBeLessThanOrEqual(320);
  expect(passwordBox.height).toBeLessThanOrEqual(568);
});

test("desktop density and two-column shell remain unchanged", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const layout = await page.evaluate(() => ({
    direction: getComputedStyle(document.querySelector(".app-shell")).flexDirection,
    sidebar: document.querySelector(".sidebar").getBoundingClientRect().width
  }));
  expect(layout.direction).toBe("row");
  expect(layout.sidebar).toBe(220);
});
