import { test, expect } from "./fixtures/supabase-auth.fixture.js";

const administrator = {
  id: "profile-admin-1",
  auth_user_id: "auth-admin-1",
  organization_id: "organization-1",
  first_name: "John",
  last_name: "Admin",
  email: "admin@example.com",
  phone: "",
  role: "administrator",
  status: "approved",
  communication_preferences: {}
};

const spring = {
  id: "season-spring",
  organization_id: "organization-1",
  legacy_season_id: null,
  name: "LSYB Spring 2026",
  starts_on: "2026-03-01",
  ends_on: "2026-06-30",
  active: true,
  created_at: "2026-02-01T12:00:00Z",
  updated_at: "2026-02-01T12:00:00Z"
};

test.describe("admin season settings", () => {
  test.use({
    supabaseScenario: {
      profile: administrator,
      initialSession: true,
      seasons: [spring]
    }
  });

  test("shows the active season and creates a new inactive season without changing imports", async ({ supabaseAuthApp }) => {
    const { page, calls } = supabaseAuthApp;
    await page.getByTestId("nav-settings").click();

    const seasonCard = page.getByTestId("settings-seasons");
    await expect(seasonCard).toContainText("LSYB Spring 2026");
    await expect(seasonCard.getByTestId("active-season-badge")).toHaveText("Active");

    await page.getByTestId("add-season").click();
    await expect(page.getByTestId("season-entry-active-warning")).toContainText("LSYB Spring 2026 is currently active");
    await expect(page.getByTestId("season-entry-active")).not.toBeChecked();

    await page.getByTestId("season-entry-name").fill("LSYB Fall 2026");
    await page.getByTestId("season-entry-start").fill("2026-08-15");
    await page.getByTestId("season-entry-end").fill("2026-11-15");
    await page.getByTestId("season-entry-save").click();

    await expect(page.getByTestId("season-entry-dialog")).not.toBeVisible();
    await expect(seasonCard).toContainText("LSYB Fall 2026");
    await expect(seasonCard.locator('[data-season-id="season-spring"]')).toContainText("Active");

    const recordedCalls = await calls();
    const creation = recordedCalls.find(call => call.operation === "rpc" && call.name === "create_season");
    expect(creation?.args).toEqual({
      p_name: "LSYB Fall 2026",
      p_starts_on: "2026-08-15",
      p_ends_on: "2026-11-15",
      p_active: false
    });
  });

  test("requires confirmation and atomically switches the active season", async ({ supabaseAuthApp }) => {
    const { page, calls } = supabaseAuthApp;
    await page.getByTestId("nav-settings").click();
    await page.getByTestId("add-season").click();
    await page.getByTestId("season-entry-name").fill("LSYB Fall 2026");
    await page.getByTestId("season-entry-start").fill("2026-08-15");
    await page.getByTestId("season-entry-end").fill("2026-11-15");
    await page.getByTestId("season-entry-save").click();

    const fallRow = page.getByTestId("season-row").filter({ hasText: "LSYB Fall 2026" });
    page.once("dialog", dialog => {
      expect(dialog.message()).toContain("LSYB Spring 2026");
      dialog.accept();
    });
    await fallRow.getByTestId("activate-season").click();

    await expect(fallRow).toContainText("Active");
    const springRow = page.getByTestId("season-row").filter({ hasText: "LSYB Spring 2026" });

await expect(springRow.getByTestId("active-season-badge")).toHaveCount(0);
await expect(springRow).toContainText("Make Active");

    const recordedCalls = await calls();
    expect(recordedCalls.some(call => call.operation === "rpc" && call.name === "activate_season" && call.args.p_season_id === "season-2")).toBeTruthy();
  });
});

test.describe("admin season settings failure", () => {
  test.use({
    supabaseScenario: {
      profile: administrator,
      initialSession: true,
      seasons: [],
      failedRpc: "create_season"
    }
  });

  test("keeps the create dialog open and reports the error", async ({ supabaseAuthApp }) => {
    const { page, calls } = supabaseAuthApp;
    await page.getByTestId("nav-settings").click();
    await page.getByTestId("add-season").click();
    await page.getByTestId("season-entry-name").fill("LSYB Fall 2026");
    await page.getByTestId("season-entry-start").fill("2026-08-15");
    await page.getByTestId("season-entry-end").fill("2026-11-15");
    await page.getByTestId("season-entry-save").click();

    await expect(page.getByTestId("season-entry-dialog")).toBeVisible();
    await expect(page.getByTestId("season-entry-error")).toContainText("Transactional write failed");
  });
});
