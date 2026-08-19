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
  await expect(page.getByTestId("profile-front-eligibility").locator(".settings-pill")).toHaveText(["12U"]);
  await expect(page.locator(".unified-profile-card .crew-credential-face-front")).toBeVisible();
  await expect(page.getByTestId("crew-card-back")).toHaveAttribute("aria-hidden", "true");
  const frontDimensions = await page.locator(".profile-card-stage").evaluate(node => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height }));
  expect(frontDimensions.width / frontDimensions.height).toBeCloseTo(5 / 7, 2);
  await expect(page.getByTestId("profile-portrait-front").locator('img[src="assets/the-slate-logo.png"]')).toHaveCount(1);
  await expect(page.getByTestId("profile-portrait-front")).not.toContainText("THE SLATE");
  await expect(page.getByTestId("profile-card-role")).toHaveText("UMPIRE");
  await expect(page.getByTestId("profile-card-name-block")).toContainText("New Umpire");
  await expect(page.getByTestId("profile-card-crew-id-inset")).toContainText("Crew ID");
  await expect(page.getByTestId("profile-card-crew-id-inset")).toContainText("CREW-NEW-1");
  const frontIdentityGeometry = await page.getByTestId("profile-portrait-front").evaluate(card => {
    const rect = element => element.getBoundingClientRect();
    const cardBounds = rect(card);
    const nameBounds = rect(card.querySelector(".profile-card-name-block"));
    const crewIdBounds = rect(card.querySelector(".profile-card-crew-id-inset"));
    const roleBounds = rect(card.querySelector(".profile-card-role-tab"));
    const photoBounds = rect(card.querySelector(".profile-card-front-photo"));
    const eligibilityBounds = rect(card.querySelector(".crew-credential-front-eligibility"));
    return {
      nameHeightRatio: nameBounds.height / cardBounds.height,
      crewIdWidthRatio: crewIdBounds.width / cardBounds.width,
      roleWidthRatio: roleBounds.width / cardBounds.width,
      roleHeightRatio: roleBounds.height / cardBounds.height,
      photoHeightRatio: photoBounds.height / cardBounds.height,
      eligibilityHeightRatio: eligibilityBounds.height / cardBounds.height
    };
  });
  expect(frontIdentityGeometry.nameHeightRatio).toBeGreaterThan(0.11);
  expect(frontIdentityGeometry.nameHeightRatio).toBeLessThan(0.18);
  expect(frontIdentityGeometry.crewIdWidthRatio).toBeGreaterThan(0.4);
  expect(frontIdentityGeometry.crewIdWidthRatio).toBeLessThan(0.6);
  expect(frontIdentityGeometry.roleWidthRatio).toBeGreaterThan(0.49);
  expect(frontIdentityGeometry.roleWidthRatio).toBeLessThan(0.64);
  expect(frontIdentityGeometry.roleHeightRatio).toBeLessThan(0.07);
  expect(frontIdentityGeometry.photoHeightRatio).toBeGreaterThan(0.64);
  expect(frontIdentityGeometry.eligibilityHeightRatio).toBeGreaterThan(0.06);
  expect(frontIdentityGeometry.eligibilityHeightRatio).toBeLessThan(0.1);
  expect(await page.locator(".unified-profile-card").evaluate(card => {
    const front = card.querySelector(".crew-credential-face-front");
    const bounds = front.getBoundingClientRect();
    return front.contains(document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2));
  })).toBe(true);
  await page.getByTestId("profile-card-back").click();
  await expect(page.getByTestId("profile-card-flipper")).toHaveClass(/is-flipped/);
  await expect(page.locator(".unified-profile-card .crew-credential-face-front")).toHaveAttribute("aria-hidden", "true");
  await expect(page.getByTestId("crew-card-back")).toBeVisible();
  await expect.poll(() => page.locator(".profile-card-stage").evaluate(node => node.getBoundingClientRect().width / node.getBoundingClientRect().height)).toBeCloseTo(7 / 5, 2);
  const backDimensions = await page.locator(".profile-card-stage").evaluate(node => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height }));
  expect(frontDimensions.width / frontDimensions.height).toBeCloseTo(backDimensions.height / backDimensions.width, 2);
  await expect(page.getByTestId("crew-card-back")).toContainText("Contact Information");
  await expect(page.getByTestId("crew-card-view-official-history")).toBeVisible();
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
    renderPage("login");
    await loginService.loginWithPassword("new.umpire@example.com", "password1234");
    renderPage("profile");
  });
  await expect(page.getByTestId("profile-card-flipper")).not.toHaveClass(/is-flipped/);
  await expect(page.getByTestId("profile-front-eligibility").locator(".settings-pill")).toHaveText(["12U"]);
  await page.getByTestId("profile-card-back").click();
  await expect(page.getByTestId("profile-edit-crew-card")).toBeVisible();
  await expect(page.getByTestId("crew-card-back")).toContainText("42 Rookie Lane");
  await expect(page.getByTestId("crew-card-back")).toContainText("Casey Umpire");
  await page.getByTestId("profile-edit-crew-card").click();
  await expect(page.getByTestId("profile-phone")).toHaveValue("(555) 333-4444");
  await expect(page.getByTestId("profile-address")).toHaveValue("42 Rookie Lane");
  await expect(page.getByTestId("profile-emergency-contact")).toHaveValue("Casey Umpire");
  await expect(page.getByTestId("profile-photo-input")).toBeVisible();
});

test("newly approved hosted umpire starts on the front face at mobile width", async ({ supabaseAuthApp }) => {
  const { page } = supabaseAuthApp;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(async () => {
    await loginService.loginWithPassword("new.umpire@example.com", "password1234");
    renderPage("profile");
  });

  await expect(page.getByTestId("profile-card-flipper")).not.toHaveClass(/is-flipped/);
  await expect(page.locator(".unified-profile-card .crew-credential-face-front")).toBeVisible();
  await expect(page.getByTestId("crew-card-back")).toHaveAttribute("aria-hidden", "true");
  await expect(page.getByTestId("profile-card-back")).toBeVisible();
  expect(await page.locator(".profile-card-stage").evaluate(node => node.getBoundingClientRect().width / node.getBoundingClientRect().height)).toBeCloseTo(5 / 7, 2);
  await page.getByTestId("profile-card-back").click();
  await expect(page.getByTestId("crew-card-back")).toBeVisible();
  await expect.poll(() => page.locator(".profile-card-stage").evaluate(node => node.getBoundingClientRect().height / node.getBoundingClientRect().width)).toBeGreaterThan(2);
  await expect(page.getByTestId("profile-edit-crew-card")).toBeVisible();
  await page.getByTestId("profile-edit-crew-card").click();
  const dialog = page.getByTestId("crew-card-dialog");
  const editor = page.getByTestId("crew-card-self-edit-mode");
  await expect(editor).toBeVisible();
  const dialogBounds = await dialog.boundingBox();
  expect(dialogBounds.width).toBeLessThanOrEqual(390);
  expect(dialogBounds.height).toBeLessThanOrEqual(844);
  await editor.getByTestId("profile-photo-input").scrollIntoViewIfNeeded();
  await expect(editor.getByTestId("profile-photo-input")).toBeVisible();
  await expect(editor.getByTestId("profile-photo-upload")).toBeVisible();
  await expect(editor.getByTestId("profile-photo-remove")).toBeVisible();
  await editor.getByTestId("profile-save").scrollIntoViewIfNeeded();
  await expect(editor.getByTestId("profile-save")).toBeVisible();
});

test("Profile card respects reduced motion while preserving front and back state", async ({ supabaseAuthApp }) => {
  const { page } = supabaseAuthApp;
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(async () => {
    await loginService.loginWithPassword("new.umpire@example.com", "password1234");
    renderPage("profile");
  });
  expect(await page.locator(".profile-card-orientation").evaluate(node => getComputedStyle(node).transitionDuration)).toBe("0s");
  await page.getByTestId("profile-card-back").click();
  await expect(page.getByTestId("profile-card-flipper")).toHaveClass(/is-flipped/);
  await page.getByTestId("profile-card-front").click();
  await expect(page.getByTestId("profile-card-flipper")).not.toHaveClass(/is-flipped/);
});
