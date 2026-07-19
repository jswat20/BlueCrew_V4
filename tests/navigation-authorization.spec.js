const { test, expect } = require("@playwright/test");

test.describe("Role-Aware Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("shows administrator navigation and hides umpire-only pages", async ({
    page
  }) => {
    await expect(page.getByTestId("nav-group-command")).toBeVisible();
    await expect(page.getByTestId("nav-group-scheduling")).toBeVisible();
    await expect(page.getByTestId("nav-group-organization")).toBeVisible();
    await expect(page.getByTestId("nav-group-account")).toBeVisible();

    await expect(page.getByTestId("nav-dashboard")).toBeVisible();
    await expect(page.getByTestId("nav-schedule")).toBeVisible();
    await expect(page.getByTestId("nav-crew")).toBeVisible();
    await expect(page.getByTestId("nav-reports")).toBeVisible();
    await expect(page.getByTestId("nav-settings")).toBeVisible();
    await expect(page.getByTestId("nav-admin")).toBeVisible();
    await expect(page.getByTestId("nav-accounts")).toBeVisible();
    await expect(page.getByTestId("nav-claims-queue")).toBeVisible();
    await expect(page.getByTestId("nav-claim-history")).toBeVisible();
    await expect(page.getByTestId("nav-availability")).toBeVisible();
    await expect(page.getByTestId("nav-notifications")).toBeVisible();

    await expect(page.getByTestId("nav-claim-games")).toBeHidden();
    await expect(page.getByTestId("nav-my-claims")).toBeHidden();
  });

  test("shows umpire navigation and hides administrative pages", async ({
    page
  }) => {
    await page.getByTestId("role-umpire").click();

    await expect(page.getByTestId("nav-group-command")).toBeVisible();
    await expect(page.getByTestId("nav-group-scheduling")).toBeVisible();
    await expect(page.getByTestId("nav-group-organization")).toBeHidden();
    await expect(page.getByTestId("nav-group-account")).toBeVisible();

    await expect(page.getByTestId("nav-dashboard")).toBeVisible();
    await expect(page.getByTestId("nav-claim-games")).toBeVisible();
    await expect(page.getByTestId("nav-my-claims")).toBeVisible();
    await expect(page.getByTestId("nav-availability")).toBeVisible();
    await expect(page.getByTestId("nav-notifications")).toBeVisible();
    await expect(page.getByTestId("nav-login")).toBeVisible();

    await expect(page.getByTestId("nav-schedule")).toBeHidden();
    await expect(page.getByTestId("nav-crew")).toBeHidden();
    await expect(page.getByTestId("nav-reports")).toBeHidden();
    await expect(page.getByTestId("nav-settings")).toBeHidden();
    await expect(page.getByTestId("nav-admin")).toBeHidden();
    await expect(page.getByTestId("nav-accounts")).toBeHidden();
    await expect(page.getByTestId("nav-claims-queue")).toBeHidden();
    await expect(page.getByTestId("nav-claim-history")).toBeHidden();
  });

  test("restores administrator navigation after switching back", async ({
    page
  }) => {
    await page.getByTestId("role-umpire").click();

    await expect(page.getByTestId("nav-accounts")).toBeHidden();
    await expect(page.getByTestId("nav-claim-games")).toBeVisible();

    await page.getByTestId("role-admin").click();

    await expect(page.getByTestId("nav-accounts")).toBeVisible();
    await expect(page.getByTestId("nav-claims-queue")).toBeVisible();
    await expect(page.getByTestId("nav-claim-games")).toBeHidden();
  });

  test("refreshes navigation after a programmatic role change", async ({
    page
  }) => {
    await page.evaluate(() => {
      authService.loginAsUmpire();
      renderPage("dashboard");
    });

    await expect(page.getByTestId("nav-claim-games")).toBeVisible();
    await expect(page.getByTestId("nav-accounts")).toBeHidden();

    await page.evaluate(() => {
      authService.loginAsAdmin();
      renderPage("dashboard");
    });

    await expect(page.getByTestId("nav-accounts")).toBeVisible();
    await expect(page.getByTestId("nav-claim-games")).toBeHidden();
  });
});

test("navigation groups collapse and expand accessibly", async ({ page }) => {
  await page.goto("/");

  const toggle = page.getByRole("button", { name: "Scheduling" });
  const schedule = page.getByTestId("nav-schedule");

  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(schedule).toBeHidden();

  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(schedule).toBeVisible();
});

test("role switch is explicitly labeled as preview mode", async ({ page }) => {
  await page.goto("/");
  const switcher = page.getByTestId("role-switcher");
  await expect(switcher).toContainText("Preview mode");
  await expect(page.getByTestId("role-admin")).toHaveText("Admin view");
  await expect(page.getByTestId("role-umpire")).toHaveText("Umpire view");
});

test("browser Back returns to the previous in-app page", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    authService.loginAsAdmin();
    navigateTo("schedule");
    navigateTo("operations-center");
  });

  await expect(page.locator("body")).toHaveAttribute("data-page", "operations-center");
  await page.goBack();
  await expect(page.locator("body")).toHaveAttribute("data-page", "schedule");
});
