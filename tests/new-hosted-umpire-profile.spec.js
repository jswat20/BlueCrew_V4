import { test, expect } from "./fixtures/supabase-auth.fixture.js";

const newlyApprovedProfile = {
  id: "profile-new-umpire",
  auth_user_id: "auth-new-umpire",
  organization_id: "organization-1",
  first_name: "New",
  last_name: "Umpire",
  email: "new.umpire@example.com",
  phone: "5550102000",
  home_phone: null,
  address: null,
  contact_preference: "text",
  birthdate: "1990-04-15",
  emergency_contact: null,
  emergency_contact_phone: null,
  personnel_id: "CREW-NEW-1",
  personnel_id_issued_at: "2026-08-16",
  official_history: [],
  role: "umpire",
  status: "approved",
  communication_preferences: {}
};

const newlyLinkedCrew = {
  id: "crew-new-umpire",
  organization_id: "organization-1",
  profile_id: "profile-new-umpire",
  first_name: "New",
  last_name: "Umpire",
  email: "new.umpire@example.com",
  phone: "5550102000",
  active: true,
  eligible_levels: ["12U"],
  preferences: {},
  notes: ""
};

test.use({
  supabaseScenario: {
    profile: newlyApprovedProfile,
    crewId: newlyLinkedCrew.id,
    crewMembers: [newlyLinkedCrew]
  }
});

test("newly registered and approved hosted umpire receives persistent Profile self-service", async ({ supabaseAuthApp }) => {
  const { page } = supabaseAuthApp;
  await page.evaluate(async () => {
    await loginService.loginWithPassword("new.umpire@example.com", "password1234");
    renderPage("profile");
  });

  await expect(page.getByTestId("profile-card-back")).toHaveText("View My Information");
  await expect(page.getByTestId("profile-card-flipper")).not.toHaveClass(/is-flipped/);
  await page.getByTestId("profile-card-back").click();
  await expect(page.getByTestId("profile-card-flipper")).toHaveClass(/is-flipped/);
  await expect(page.getByTestId("profile-edit-crew-card")).toBeVisible();
  await page.getByTestId("profile-edit-crew-card").click();
  await expect(page.getByTestId("crew-card-self-edit-mode")).toBeVisible();
  await expect(page.getByTestId("profile-photo-input")).toBeVisible();

  await page.getByTestId("profile-phone").fill("5553334444");
  await page.getByTestId("profile-address").fill("42 Rookie Lane");
  await page.getByTestId("profile-emergency-contact").fill("Casey Umpire");
  await page.getByTestId("profile-emergency-phone").fill("5557778888");
  await page.getByTestId("profile-save").click();
  await expect(page.getByTestId("profile-success")).toHaveText("Profile saved.");

  await page.evaluate(async () => {
    await loginService.logoutAuthenticated();
    await loginService.loginWithPassword("new.umpire@example.com", "password1234");
    renderPage("profile");
  });
  if (await page.getByTestId("profile-card-back").count()) await page.getByTestId("profile-card-back").click();
  await expect(page.getByTestId("profile-edit-crew-card")).toBeVisible();
  await expect(page.getByTestId("crew-card-back")).toContainText("42 Rookie Lane");
  await expect(page.getByTestId("crew-card-back")).toContainText("Casey Umpire");
  await page.getByTestId("profile-edit-crew-card").click();
  await expect(page.getByTestId("profile-phone")).toHaveValue("(555) 333-4444");
  await expect(page.getByTestId("profile-address")).toHaveValue("42 Rookie Lane");
  await expect(page.getByTestId("profile-emergency-contact")).toHaveValue("Casey Umpire");
  await expect(page.getByTestId("profile-photo-input")).toBeVisible();
});
