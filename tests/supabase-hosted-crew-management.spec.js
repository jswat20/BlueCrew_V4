import { test, expect } from "./fixtures/supabase-auth.fixture.js";

const administrator = {
  id: "profile-admin-1",
  auth_user_id: "auth-admin-1",
  organization_id: "organization-1",
  first_name: "Avery",
  last_name: "Admin",
  email: "avery@example.com",
  phone: "",
  role: "administrator",
  status: "approved",
  communication_preferences: {}
};

const existingCrew = {
  id: "crew-existing",
  organization_id: "organization-1",
  profile_id: null,
  legacy_crew_id: null,
  first_name: "Jordan",
  last_name: "Umpire",
  email: "jordan@example.com",
  phone: "5550102000",
  active: true,
  eligible_levels: ["12U"],
  preferences: {},
  notes: ""
};

async function openCrew(page) {
  const login = await page.evaluate(() => loginService.loginWithPassword("avery@example.com", "password"));
  expect(login.success).toBe(true);
  await page.evaluate(() => renderPage("crew"));
  await expect(page.getByTestId("crew-page-workload")).toBeVisible();
}

test.describe("Hosted crew management", () => {
  test.use({ supabaseScenario: { profile: administrator, crewId: null, crewMembers: [existingCrew] } });

  test("creates and reloads an authoritative hosted roster", async ({ supabaseAuthApp }) => {
    const { page, calls } = supabaseAuthApp;
    await openCrew(page);
    await expect(page.getByTestId("crew-roster-count")).toHaveText("1 crew members");
    await expect(page.getByTestId("crew-active-count")).toHaveText("1");
    await expect(page.getByTestId("crew-inactive-count")).toHaveText("0");

    await page.getByRole("button", { name: "Add Crew Member" }).click();
    await page.locator("#crew-first-name").fill("Casey");
    await page.locator("#crew-last-name").fill("Official");
    await page.locator("#crew-email").fill("casey@example.com");
    await page.getByTestId("crew-level-select-all").check();
    await page.getByRole("button", { name: "Save Crew Member" }).click();

    await expect(page.getByTestId("crew-roster-count")).toHaveText("2 crew members");
    await expect(page.getByTestId("crew-active-count")).toHaveText("2");
    await expect(page.getByTestId("crew-total-count")).toHaveText("2");
    await expect(page.getByText("Casey Official", { exact: true })).toBeVisible();
    await page.evaluate(async () => { crewService.clearAllSharedCrew(); await crewService.loadAdministrativeCrew(); renderPage("crew"); });
    await expect(page.getByText("Casey Official", { exact: true })).toBeVisible();
    expect((await calls()).some(call => call.table === "crew_members" && call.operation === "insert")).toBe(true);
  });

  test("updates and deactivates through the hosted repository", async ({ supabaseAuthApp }) => {
    const { page, calls } = supabaseAuthApp;
    await openCrew(page);
    const result = await page.evaluate(async () => {
      const update = await crewService.updateMember("crew-existing", { firstName: "Updated", active: false, levels: ["10U", "12U"] });
      renderPage("crew");
      return update;
    });
    expect(result.success).toBe(true);
    await expect(page.getByText("Updated Umpire", { exact: true })).toBeVisible();
    await expect(page.getByTestId("crew-active-count")).toHaveText("0");
    await expect(page.getByTestId("crew-inactive-count")).toHaveText("1");
    expect((await calls()).some(call => call.table === "crew_members" && call.operation === "update")).toBe(true);
  });

});

test.describe("Hosted crew management failures", () => {
  test.use({ supabaseScenario: { profile: administrator, crewId: null, crewMembers: [existingCrew], failedMutationTable: "crew_members" } });

  test("shows save failures without optimistic roster changes", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    await openCrew(page);
    await page.getByRole("button", { name: "Add Crew Member" }).click();
    await page.locator("#crew-first-name").fill("Not");
    await page.locator("#crew-last-name").fill("Saved");
    await page.getByRole("button", { name: "Save Crew Member" }).click();
    await expect(page.getByTestId("crew-mutation-error")).toContainText("RLS denied");
    await expect(page.getByTestId("crew-roster-count")).toHaveText("1 crew members");
    await expect(page.getByText("Not Saved", { exact: true })).toHaveCount(0);
  });
});
