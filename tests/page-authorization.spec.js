const { test, expect } = require("@playwright/test");

test.describe("Page Authorization", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("allows administrators to render protected pages", async ({
    page
  }) => {
    await page.evaluate(() => {
      authService.loginAsAdmin();
      renderPage("accounts");
    });

    await expect(
      page.getByTestId("page-accounts")
    ).toBeVisible();

    await expect(
      page.getByTestId("access-denied")
    ).toHaveCount(0);

    await expect(
      page.getByTestId("page-title")
    ).toHaveText("Accounts");
  });

  test("blocks umpires from rendering the Accounts page", async ({
    page
  }) => {
    await page.evaluate(() => {
      authService.loginAsUmpire();
      renderPage("accounts");
    });

    await expect(
      page.getByTestId("access-denied")
    ).toBeVisible();

    await expect(
      page.getByTestId("access-denied-title")
    ).toHaveText("Access Denied");

    await expect(
      page.getByTestId("access-denied-message")
    ).toContainText("Accounts");

    await expect(
      page.getByTestId("page-title")
    ).toHaveText("Access Denied");
  });

  test("blocks umpires from rendering Claims Queue", async ({
    page
  }) => {
    await page.evaluate(() => {
      authService.loginAsUmpire();
      renderPage("claims-queue");
    });

    await expect(
      page.getByTestId("access-denied")
    ).toBeVisible();

    await expect(
      page.getByTestId("access-denied-message")
    ).toContainText("Claims Queue");

    await expect(
      page.getByTestId("claims-queue")
    ).toHaveCount(0);
  });

  test("blocks administrators from rendering Claim Games", async ({
    page
  }) => {
    await page.evaluate(() => {
      authService.loginAsAdmin();
      renderPage("claim-games");
    });

    await expect(
      page.getByTestId("access-denied")
    ).toBeVisible();

    await expect(
      page.getByTestId("access-denied-message")
    ).toContainText("Claim Games");
  });

  test("allows umpires to render Claim Games", async ({
    page
  }) => {
    await page.evaluate(() => {
      authService.loginAsUmpire();
      renderPage("claim-games");
    });

    await expect(
      page.getByTestId("page-claim-games")
    ).toBeVisible();

    await expect(
      page.getByTestId("access-denied")
    ).toHaveCount(0);
  });

  test("denies unknown pages for every role", async ({
    page
  }) => {
    await page.evaluate(() => {
      authService.loginAsAdmin();
      renderPage("not-a-real-page");
    });

    await expect(
      page.getByTestId("access-denied")
    ).toBeVisible();

    await expect(
      page.getByTestId("access-denied-message")
    ).toContainText("not-a-real-page");
  });

  test("restores normal rendering after an unauthorized request", async ({
    page
  }) => {
    await page.evaluate(() => {
      authService.loginAsUmpire();
      renderPage("accounts");
    });

    await expect(
      page.getByTestId("access-denied")
    ).toBeVisible();

    await page.evaluate(() => {
      renderPage("claim-games");
    });

    await expect(
      page.getByTestId("access-denied")
    ).toHaveCount(0);

    await expect(
      page.getByTestId("page-claim-games")
    ).toBeVisible();
  });
});
