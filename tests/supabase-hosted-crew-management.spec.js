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
    expect((await calls()).some(call => call.operation === "rpc" && call.name === "create_crew_member")).toBe(true);
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
    expect((await calls()).some(call => call.operation === "rpc" && call.name === "update_crew_member_with_personnel")).toBe(true);
  });

  test("legacy Crew-card Edit activation opens one hosted editor before closing its dialog", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    await openCrew(page);
    await page.evaluate(() => {
      const dialog = document.createElement("dialog");
      dialog.id = "crew-card-dialog";
      dialog.innerHTML = '<button type="button" data-testid="crew-card-edit" data-crew-id="crew-existing">Edit Crew Member</button>';
      document.body.appendChild(dialog);
      dialog.showModal();
    });
    await page.getByRole("button", { name: "Edit Crew Member" }).click();
    await expect(page.locator("#crew-drawer")).toBeVisible();
    await expect(page.locator("#crew-drawer")).toHaveCount(1);
    await expect(page.locator("#crew-card-dialog")).not.toHaveAttribute("open", "");
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.locator("#crew-drawer")).toHaveCount(0);
  });

  test("accepts the production side-effect-only editor factory contract", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    await openCrew(page);
    await page.evaluate(() => {
      const actualFactory = window.openEditCrewDrawer;
      window.openEditCrewDrawer = crewMemberId => { actualFactory(crewMemberId); };
      const dialog = document.createElement("dialog");
      dialog.id = "crew-card-dialog";
      dialog.innerHTML = '<button type="button" data-testid="crew-card-edit" data-crew-id="crew-existing">Edit Crew Member</button>';
      document.body.appendChild(dialog);
      dialog.showModal();
    });
    await page.getByRole("button", { name: "Edit Crew Member" }).click();
    await expect(page.locator("#crew-drawer")).toBeVisible();
    await expect(page.locator("#crew-card-dialog")).not.toHaveAttribute("open", "");
    await expect(page.getByText(/Unable to open Crew editor/)).toHaveCount(0);
  });

  test("opens and persists from the E3 production shape with absent mapped eligibility", async ({ supabaseAuthApp }) => {
    const { page, calls } = supabaseAuthApp;
    await openCrew(page);
    await page.evaluate(() => {
      const actualGetAll = crewService.getAll.bind(crewService);
      crewService.getAll = () => actualGetAll().map(member => String(member.id) === "crew-existing"
        ? { ...member, levels: undefined, eligible_levels: [] }
        : member);
      const dialog = document.createElement("dialog");
      dialog.id = "crew-card-dialog";
      dialog.innerHTML = '<button type="button" data-testid="crew-card-edit" data-crew-id="crew-existing">Edit Crew Member</button>';
      document.body.appendChild(dialog);
      dialog.showModal();
    });
    await page.getByRole("button", { name: "Edit Crew Member" }).click();
    await expect(page.locator("#crew-drawer")).toBeVisible();
    await expect(page.locator(".crew-level-checkbox:checked")).toHaveCount(0);
    await page.locator("#crew-notes").fill("E3 normalized and persisted");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText("Crew member saved.")).toBeVisible();
    expect((await calls()).some(call => call.operation === "rpc" && call.name === "update_crew_member_with_personnel" && call.args.p_notes === "E3 normalized and persisted")).toBe(true);
  });

  test("opens the production editor when the local-only Crew name helper is absent", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    await openCrew(page);
    await page.evaluate(() => {
      window.getCrewFullName = undefined;
      const dialog = document.createElement("dialog");
      dialog.id = "crew-card-dialog";
      dialog.innerHTML = '<button type="button" data-testid="crew-card-edit" data-crew-id="crew-existing">Edit Crew Member</button>';
      document.body.appendChild(dialog);
      dialog.showModal();
    });
    await page.getByRole("button", { name: "Edit Crew Member" }).click();
    await expect(page.locator("#crew-drawer")).toBeVisible();
    await expect(page.locator("#crew-drawer .drawer-header p")).toHaveText("Jordan Umpire");
    await expect(page.getByText(/CREW-EDIT-E3/)).toHaveCount(0);
  });

  test("live delegated handler leaves the detail card open and reports editor-launch failure", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    await openCrew(page);
    await page.evaluate(() => {
      const dialog = document.createElement("dialog");
      dialog.id = "crew-card-dialog";
      dialog.innerHTML = '<article><button type="button" data-testid="crew-card-edit" data-crew-id="missing-crew">Edit Crew Member</button><footer></footer></article>';
      document.body.appendChild(dialog);
      dialog.showModal();
    });
    await page.getByRole("button", { name: "Edit Crew Member" }).click();
    await expect(page.locator("#crew-card-dialog")).toHaveAttribute("open", "");
    await expect(page.getByText("Unable to open Crew editor. Please try again. [CREW-EDIT-E1]")).toBeVisible();
    await expect(page.locator("#crew-drawer")).toHaveCount(0);
  });

});

test.describe("Hosted crew management failures", () => {
  test.use({ supabaseScenario: { profile: administrator, crewId: null, crewMembers: [existingCrew], failedRpc: "create_crew_member" } });

  test("shows save failures without optimistic roster changes", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    await openCrew(page);
    await page.getByRole("button", { name: "Add Crew Member" }).click();
    await page.locator("#crew-first-name").fill("Not");
    await page.locator("#crew-last-name").fill("Saved");
    await page.getByRole("button", { name: "Save Crew Member" }).click();
    await expect(page.getByTestId("crew-mutation-error")).toContainText("Transactional write failed");
    await expect(page.getByTestId("crew-roster-count")).toHaveText("1 crew members");
    await expect(page.getByText("Not Saved", { exact: true })).toHaveCount(0);
  });
});

test.describe("Hosted linked Crew card editing", () => {
  const linkedProfile = {
    id: "profile-linked-1", auth_user_id: "auth-linked-1", organization_id: "organization-1",
    first_name: "Linked", last_name: "Official", email: "linked@example.com", phone: "5550103000",
    role: "umpire", status: "approved", communication_preferences: {}, crew_code: "BC-2026-0204",
    personnel_id: "UMP-204", personnel_id_issued_at: "2026-08-14T00:00:00.000Z",
    photo_path: "auth-linked-1/profile"
  };
  const linkedCrew = {
    ...existingCrew, id: "crew-linked", profile_id: linkedProfile.id, first_name: "Linked",
    last_name: "Official", email: linkedProfile.email, phone: linkedProfile.phone
  };

  test.use({ supabaseScenario: { profile: administrator, crewId: null, pendingProfiles: [linkedProfile], crewMembers: [linkedCrew] } });

  test("hydrates the linked profile photo into the administrator Crew detail", async ({ supabaseAuthApp }) => {
    const { page, calls } = supabaseAuthApp;
    await openCrew(page);
    await page.getByRole("button", { name: "Open Crew Card for Linked Official" }).click();
    const photo = page.getByTestId("crew-card-dialog").locator(".crew-credential-modal-photo").first();
    await expect(photo).toHaveAttribute("src", /profile-photos\/auth-linked-1\/profile\?token=fixture/);
    await expect(page.getByTestId("crew-card-id")).toHaveText("UMP-204");
    const recordedCalls = await calls();
    expect(recordedCalls.some(call => call.operation === "storage.createSignedUrl" && call.path === "auth-linked-1/profile")).toBe(true);
    const profileProjection = recordedCalls.find(call => call.operation === "selectColumns" && call.table === "profiles" && call.columns.includes("photo_path"));
    expect(profileProjection).toBeTruthy();
    expect(profileProjection.columns).toContain("crew_code");
    expect(profileProjection.columns).toContain("crew_code_issued_at");
    expect(profileProjection.columns).toContain("personnel_id");
    expect(profileProjection.columns).toContain("personnel_id_issued_at");
  });

  test("uses the permanent Personnel ID as the read-only Crew ID in both card and editor", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    await openCrew(page);
    await page.getByRole("button", { name: "Open Crew Card for Linked Official" }).click();
    await expect(page.getByTestId("crew-card-id")).toHaveText("UMP-204");
    await page.getByTestId("crew-card-edit").press("Enter");
    await expect(page.getByTestId("crew-personnel-id")).toHaveValue("UMP-204");
    await expect(page.getByTestId("crew-personnel-id")).toHaveAttribute("readonly", "");
    await expect(page.locator(".crew-field-personnel-id label")).toHaveText("Crew ID");
    await expect(page.getByTestId("crew-card-admin-edit-mode")).not.toContainText("BC-2026-0204");
    await expect(page.getByTestId("crew-card-admin-edit-mode")).not.toContainText(linkedProfile.id);
    await expect(page.getByTestId("crew-card-admin-edit-mode")).not.toContainText(linkedProfile.auth_user_id);
  });

  test("persists a linked Crew edit through the hosted repository and retains identity linkage", async ({ supabaseAuthApp }) => {
    const { page, calls } = supabaseAuthApp;
    await openCrew(page);
    await page.getByRole("button", { name: "Open Crew Card for Linked Official" }).click();
    await page.getByTestId("crew-card-edit").press("Enter");
    await expect(page.locator("#crew-first-name")).toBeVisible();
    await expect(page.getByTestId("crew-card-admin-edit-mode")).toBeVisible();
    await expect(page.locator("#crew-drawer")).toHaveCount(0);
    await expect(page.getByTestId("crew-card-dialog")).toBeVisible();
    await page.locator("#crew-first-name").fill("Persisted");
    await page.locator("#crew-notes").fill("Hosted linked edit");
    await page.getByRole("button", { name: "Save Changes" }).click();

    await expect(page.getByText("Crew member saved.")).toBeVisible();
    await page.evaluate(async () => { crewService.clearAllSharedCrew(); await crewService.loadAdministrativeCrew(); renderPage("crew"); });
    await expect(page.getByTestId("crew-roster-member").getByText("Persisted Official", { exact: true })).toBeVisible();
    const update = (await calls()).find(call => call.operation === "rpc" && call.name === "update_crew_member_with_personnel");
    expect(update).toBeTruthy();
    expect(update.args).not.toHaveProperty("p_profile_id");
    expect(linkedCrew.profile_id).toBe(linkedProfile.id);
  });
});

test.describe("Hosted linked Crew edit failures", () => {
  const linkedProfile = { ...administrator, id: "profile-linked-failure", auth_user_id: "auth-linked-failure", role: "umpire", email: "failure@example.com" };
  const linkedCrew = { ...existingCrew, id: "crew-linked-failure", profile_id: linkedProfile.id, email: linkedProfile.email };
  test.use({ supabaseScenario: { profile: administrator, crewId: null, pendingProfiles: [linkedProfile], crewMembers: [linkedCrew], failedRpc: "update_crew_member_with_personnel" } });

  test("surfaces a rejected linked Crew update without changing the roster", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    await openCrew(page);
    await page.getByRole("button", { name: /Open Crew Card/ }).click();
    await page.getByTestId("crew-card-edit").click();
    await page.locator("#crew-first-name").fill("Not Persisted");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByTestId("crew-mutation-error")).toContainText("Transactional write failed");
    await expect(page.locator("#crew-first-name")).toBeVisible();
  });
});
