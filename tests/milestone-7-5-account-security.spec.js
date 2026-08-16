const { test, expect } = require("./fixtures/supabase-auth.fixture");
const AxeBuilder = require("@axe-core/playwright").default;

test("forgot password is hosted-only, generic, and calls Supabase recovery", async ({ supabaseAuthApp }) => {
  const { page, calls } = supabaseAuthApp;
  await expect(page.getByTestId("forgot-password-link")).toBeVisible();
  await page.getByTestId("forgot-password-link").click();
  await page.getByTestId("forgot-password-email").fill("person@example.com");
  await page.getByTestId("forgot-password-submit").click();
  await expect(page.getByTestId("forgot-password-message")).toHaveText("If an account exists for that email, a password reset link has been sent.");
  const reset = (await calls()).find(call => call.operation === "resetPasswordForEmail");
  expect(reset.email).toBe("person@example.com");
  expect(reset.options.redirectTo).toBe("https://app.worktheslate.com/");
});

test("local development recovery uses the current local origin", async ({ supabaseAuthApp }) => {
  const { page } = supabaseAuthApp;
  const redirect = await page.evaluate(() => {
    window.BLUECREW_RUNTIME_CONFIG = Object.freeze({ mode: "local" });
    return passwordSecurityService.recoveryRedirectUrl();
  });
  expect(redirect).toBe(`${new URL(page.url()).origin}/`);
  expect(redirect).toMatch(/^http:\/\/(?:127\.0\.0\.1|localhost):\d+\/$/);
});

test("password policy requires twelve characters and matching confirmation", async ({ supabaseAuthApp }) => {
  const result = await supabaseAuthApp.page.evaluate(() => ({ short: passwordSecurityService.validate("short", "short"), mismatch: passwordSecurityService.validate("valid-password-12", "different-password"), valid: passwordSecurityService.validate("valid-password-12", "valid-password-12") }));
  expect(result.short.success).toBe(false); expect(result.mismatch.success).toBe(false); expect(result.valid.success).toBe(true);
});

test("PASSWORD_RECOVERY isolates navigation and successful update signs out", async ({ supabaseAuthApp }) => {
  const { page, calls } = supabaseAuthApp;
  await page.evaluate(() => window.history.replaceState({}, "", "/recovery?code=temporary#type=recovery"));
  await page.evaluate(() => window.__bluecrewAuthCallback("PASSWORD_RECOVERY", { user: { id: "auth-user-1" } }));
  await expect(page.getByTestId("password-recovery-page")).toBeVisible();
  await expect(page.getByTestId("dashboard")).toHaveCount(0);
  await page.getByTestId("recovery-new-password").fill("new-password-123");
  await page.getByTestId("recovery-confirm-password").fill("new-password-123");
  await page.getByTestId("recovery-submit").click();
  await expect(page.getByTestId("login-page")).toBeVisible();
  expect(page.url()).toBe(`${new URL(page.url()).origin}/`);
  expect(await page.evaluate(() => supabaseAuthService.isRecoveringPassword())).toBe(false);
  expect((await calls()).some(call => call.operation === "updateUser")).toBe(true);
  expect((await calls()).some(call => call.operation === "signOut")).toBe(true);
});

test("Profile exposes Account Security and rejects a wrong current password", async ({ supabaseAuthApp }) => {
  const { page } = supabaseAuthApp;
  await page.evaluate(async () => { await loginService.loginWithPassword("linked@example.com", "password1234"); renderPage("profile"); });
  await expect(page.getByTestId("profile-account-security")).toBeVisible();
  await expect(page.getByTestId("profile-login-email")).toHaveText("linked@example.com");
  await page.getByTestId("profile-change-password").click();
  await page.getByTestId("current-password").fill("wrong-password");
  await page.getByTestId("change-new-password").fill("new-password-123");
  await page.getByTestId("change-confirm-password").fill("new-password-123");
  await page.getByTestId("change-password-submit").click();
  await expect(page.getByTestId("change-password-message")).toHaveText("Current password is incorrect.");
});

test("authenticated password change updates Supabase and signs out", async ({ supabaseAuthApp }) => {
  const { page, calls } = supabaseAuthApp;
  await page.evaluate(async () => { await loginService.loginWithPassword("linked@example.com", "password1234"); renderPage("profile"); });
  await page.getByTestId("profile-change-password").click();
  await page.getByTestId("current-password").fill("password1234");
  await page.getByTestId("change-new-password").fill("new-password-123");
  await page.getByTestId("change-confirm-password").fill("new-password-123");
  await page.getByTestId("change-password-submit").click();
  await expect(page.getByTestId("login-page")).toBeVisible();
  const operations = await calls();
  expect(operations.some(call => call.operation === "updateUser")).toBe(true);
  expect(operations.some(call => call.operation === "signOut")).toBe(true);
});

test("administrator reset sends only a profile id to the trusted function", async ({ supabaseAuthApp }) => {
  const { page, calls } = supabaseAuthApp;
  const result = await page.evaluate(async () => { await loginService.loginWithPassword("linked@example.com", "password1234"); const actor = loginService.getCurrentAccount(); actor.role = "administrator"; authService.useAuthenticatedAccount(actor); return passwordSecurityService.requestAdministrativeReset(actor.id); });
  expect(result.success).toBe(true);
  const reset = (await calls()).find(call => call.operation === "functions.invoke");
  expect(reset.name).toBe("send-account-password-reset");
  expect(reset.options.body.profileId).toBeTruthy();
  expect(reset.options.body.email).toBeUndefined();
  expect(reset.options.body.redirectTo).toBe("https://app.worktheslate.com/");
});

test("trusted admin reset function enforces actor role, organization, and profile email", async () => {
  const source = require("fs").readFileSync("supabase/functions/send-account-password-reset/index.ts", "utf8");
  expect(source).toContain('actor.role !== "administrator"');
  expect(source).toContain('.eq("organization_id", actor.organization_id)');
  expect(source).toContain("target.email");
  const browserSource = require("fs").readFileSync("js/services/passwordSecurityService.js", "utf8");
  expect(browserSource).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
});

test("non-administrators cannot initiate another account reset", async ({ supabaseAuthApp }) => {
  const result = await supabaseAuthApp.page.evaluate(async () => { await loginService.loginWithPassword("linked@example.com", "password1234"); return passwordSecurityService.requestAdministrativeReset("other-profile"); });
  expect(result).toMatchObject({ success: false, message: "Administrator access is required." });
});

test("forgot and change-password forms remain mobile usable and WCAG A/AA clean", async ({ supabaseAuthApp }) => {
  const { page } = supabaseAuthApp;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("forgot-password-link").click();
  await expect(page.getByTestId("forgot-password-submit")).toBeVisible();
  let scan = await new AxeBuilder({ page }).include("#app-content").withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(scan.violations).toEqual([]);
  await page.evaluate(async () => { await loginService.loginWithPassword("linked@example.com", "password1234"); renderPage("profile"); });
  await page.getByTestId("profile-change-password").click();
  await expect(page.getByTestId("change-password-submit")).toBeVisible();
  scan = await new AxeBuilder({ page }).include("[data-testid='change-password-dialog']").withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(scan.violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("change-password-dialog")).not.toBeVisible();
});
