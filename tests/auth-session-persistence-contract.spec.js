const { test, expect } = require("@playwright/test");
const { readFileSync } = require("node:fs");

const client = readFileSync("js/services/supabaseClientService.js", "utf8");
const login = readFileSync("js/services/loginService.js", "utf8");
const app = readFileSync("app.js", "utf8");

test("hosted authentication is configured to persist and restore on startup", () => {
  expect(client).toContain("persistSession: true");
  expect(client).toContain("autoRefreshToken: true");
  expect(login).toContain("await supabaseAuthService.startSessionListener()");
  expect(login).toContain("return supabaseAuthService.restoreSession()");
  expect(app).toContain("loginService.initializeAuthenticatedIdentity()");
  expect(app).toContain("renderSessionRestoringState()");
  expect(app).toContain('window.BlueCrew.test.currentPage = "session-restoring"');
});
