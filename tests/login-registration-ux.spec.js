import { test, expect } from "./fixtures/supabase-auth.fixture.js";

test("unauthenticated login presents the focused pilot entry experience", async ({ supabaseAuthApp }) => {
  const { page } = supabaseAuthApp;

  await expect(page.locator("#page-title")).toHaveText("The Slate - Login");
  await expect(page.getByText("Access your umpire portal", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Umpire Login", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("nav-notifications")).toBeHidden();

  const toggle = page.getByTestId("registration-toggle");
  const panel = page.getByTestId("account-registration-panel");
  await expect(toggle).toHaveText("New Here? Create a New Account");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(panel).toBeHidden();

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("heading", { name: "Become an Umpire" })).toBeVisible();

  const inputOrder = await panel.locator("input").evaluateAll(inputs =>
    inputs.map(input => input.getAttribute("data-testid"))
  );
  expect(inputOrder).toEqual([
    "account-first-name",
    "account-last-name",
    "account-email",
    "account-phone",
    "account-birthdate",
    "account-password"
  ]);
  await expect(page.getByText("Registration Code", { exact: true })).toHaveCount(0);

  await page.getByTestId("account-first-name").fill("Keeps");
  await toggle.click();
  await expect(panel).toBeHidden();
  await expect(page.getByTestId("account-first-name")).toHaveValue("Keeps");
  await toggle.click();
  await toggle.focus();
  await page.keyboard.press("Tab");
  await expect(page.getByTestId("account-first-name")).toBeFocused();
});

test("notifications return after authentication", async ({ supabaseAuthApp }) => {
  const { page } = supabaseAuthApp;
  await page.getByTestId("login-email").fill("linked@example.com");
  await page.getByTestId("login-password").fill("correct horse battery staple");
  await page.getByTestId("login-submit").click();
  await expect(page.getByTestId("nav-notifications")).toBeVisible();
});

test("mobile install guidance remains available before and after login", async ({ supabaseAuthApp }) => {
  const { page } = supabaseAuthApp;
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      get: () => "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1"
    });
    Object.defineProperty(navigator, "platform", { configurable: true, get: () => "iPhone" });
    Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, get: () => 5 });
  });
  await page.reload();
  await expect(page.getByTestId("nav-install")).toBeVisible();

  await page.getByTestId("login-email").fill("linked@example.com");
  await page.getByTestId("login-password").fill("correct horse battery staple");
  await page.getByTestId("login-submit").click();
  await expect(page.getByTestId("nav-install")).toBeVisible();
});
