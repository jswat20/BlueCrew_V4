import { test, expect } from "./fixtures/supabase-auth.fixture.js";
import { test as localTest } from "./fixtures/app.fixture.js";

const adminProfile = {
  id: "profile-admin-logout",
  auth_user_id: "auth-admin-logout",
  organization_id: "organization-1",
  first_name: "Avery",
  last_name: "Admin",
  email: "admin-logout@example.com",
  role: "administrator",
  status: "approved",
  communication_preferences: {}
};

async function loginAndRender(page, email) {
  const result = await page.evaluate(async value => {
    const login = await loginService.loginWithPassword(value, "password");
    renderPage("dashboard");
    return login;
  }, email);
  expect(result.success).toBe(true);
}

test("hosted umpire can globally log out", async ({ supabaseAuthApp }) => {
  const { page, calls } = supabaseAuthApp;
  await loginAndRender(page, "linked@example.com");
  await expect(page.getByTestId("nav-logout")).toBeVisible();
  await expect(page.getByTestId("page-dashboard")).toBeVisible();
  await page.getByTestId("nav-logout").click();
  await expect(page.getByTestId("login-page")).toBeVisible();
  await expect(page.getByTestId("page-dashboard")).toHaveCount(0);
  expect((await calls()).some(call => call.operation === "signOut")).toBe(true);
  const state = await page.evaluate(() => ({
    account: loginService.getCurrentAccount(),
    crew: crewService.getAll(),
    notifications: notificationService.getAll(),
    selectedGame: uiStateService.getSelectedGame()
  }));
  expect(state).toEqual({ account: null, crew: [], notifications: [], selectedGame: null });
});

localTest("local mode retains global logout behavior", async ({ app }) => {
  const result = await app.page.evaluate(() => {
    const created = accountService.createAccount({ firstName: "Local", lastName: "Logout", email: "local-logout@example.com" });
    accountService.approveAccount(created.data.id);
    const login = loginService.login("local-logout@example.com");
    refreshNavigationAuthorization();
    return login;
  });
  expect(result.success).toBe(true);
  await expect(app.page.getByTestId("nav-logout")).toBeVisible();
  await app.page.getByTestId("nav-logout").click();
  await expect(app.page.getByTestId("login-page")).toBeVisible();
  expect(await app.page.evaluate(() => loginService.isLoggedIn())).toBe(false);
});

test.describe("administrator logout", () => {
  test.use({ supabaseScenario: { profile: adminProfile, crewId: null } });
  test("is visible and Back cannot restore authenticated content", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    await loginAndRender(page, adminProfile.email);
    await expect(page.getByTestId("nav-logout")).toBeVisible();
    await page.getByTestId("nav-notifications").click();
    await page.getByTestId("nav-logout").click();
    await page.goBack();
    await expect(page.getByTestId("login-page")).toBeVisible();
    await expect(page.getByTestId("page-notifications")).toHaveCount(0);
  });
});
