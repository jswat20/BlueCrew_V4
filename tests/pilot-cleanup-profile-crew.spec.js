import { test, expect } from "./fixtures/supabase-auth.fixture.js";

const admin = { id:"admin-cleanup", auth_user_id:"auth-admin-cleanup", organization_id:"organization-1", first_name:"Admin", last_name:"Cleanup", email:"admin@example.com", role:"administrator", status:"approved", communication_preferences:{} };
const umpire = { id:"profile-cleanup", auth_user_id:"auth-profile-cleanup", organization_id:"organization-1", first_name:"Pat", last_name:"Official", email:"login@example.com", phone:"1234567890", home_phone:"2345678901", address:"42 Updated Lane", contact_preference:"call", emergency_contact:"Morgan Official", emergency_contact_phone:"3456789012", role:"umpire", status:"approved", communication_preferences:{} };
const crew = { id:"crew-cleanup", organization_id:"organization-1", profile_id:"profile-cleanup", first_name:"Pat", last_name:"Official", email:"crew-contact@example.com", phone:"4567890123", active:true, eligible_levels:["12U"], preferences:{}, notes:"" };

test.use({ supabaseScenario: { profile: admin, crewId:null, crewMembers:[crew], organizationProfiles:[umpire], identityDiagnostics:[{ crew_member_id:"crew-cleanup", identity_status:"linked", login_email:"login@example.com", linked_role:"umpire", linked_status:"approved" }] } });

test("hosted Crew card reads profile-owned fields and preserves email ownership", async ({ supabaseAuthApp }) => {
  const { page } = supabaseAuthApp;
  expect((await page.evaluate(() => loginService.loginWithPassword("admin@example.com", "password"))).success).toBe(true);
  await page.evaluate(async () => { await crewService.loadAdministrativeCrew(); });
  const model = await page.evaluate(() => getCrewCardModel("crew-cleanup"));
  expect(model).toMatchObject({ address:"42 Updated Lane", homePhone:"(234) 567-8901", emergencyContact:"Morgan Official", emergencyContactPhone:"(345) 678-9012", loginEmail:"login@example.com", email:"crew-contact@example.com", phone:"(123) 456-7890" });
  await page.evaluate(() => openCrewCredentialCard("crew-cleanup"));
  await expect(page.getByTestId("crew-card-emergency-contact")).toHaveText("Morgan Official");
  await expect(page.getByTestId("crew-card-emergency-phone")).toHaveText("(345) 678-9012");
});

test("phone presentation formats only 10-digit values", async ({ supabaseAuthApp }) => {
  const values = await supabaseAuthApp.page.evaluate(() => [
    sharedDomainMappingService.mapProfile({ id:"1", phone:"1234567890" }).phone,
    sharedDomainMappingService.mapProfile({ id:"2", phone:"(123) 456-7890" }).phone,
    sharedDomainMappingService.mapProfile({ id:"3", phone:"+44 20 7946 0958" }).phone,
    sharedDomainMappingService.mapProfile({ id:"4", phone:"555-EXT-12" }).phone
  ]);
  expect(values).toEqual(["(123) 456-7890", "(123) 456-7890", "+44 20 7946 0958", "555-EXT-12"]);
});

test("profile and Crew ID layouts remain contained across desktop and mobile", async ({ supabaseAuthApp }) => {
  const { page } = supabaseAuthApp;
  expect((await page.evaluate(() => loginService.loginWithPassword("admin@example.com", "password"))).success).toBe(true);
  await page.evaluate(() => renderPage("profile"));
  const desktop = await page.getByTestId("profile-crew-card-experience").evaluate(node => ({ width:node.getBoundingClientRect().width, viewport:innerWidth, columns:getComputedStyle(document.querySelector('[data-testid="communication-options"]')).gridTemplateColumns }));
  expect(desktop.width).toBeLessThanOrEqual(1121);
  expect(desktop.columns.split(" ")).toHaveLength(2);
  await page.setViewportSize({ width:390, height:844 });
  await expect(page.getByText("Browser notifications (not currently available)")).toBeVisible();
  expect(await page.getByTestId("communication-options").evaluate(node => getComputedStyle(node).gridTemplateColumns.split(" ").length)).toBe(1);
  expect(await page.getByTestId("profile-crew-card-experience").evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  await page.evaluate(async () => { await crewService.loadAdministrativeCrew(); openCrewCredentialCard("crew-cleanup"); });
  await expect(page.getByTestId("crew-card-flipper")).toHaveClass(/is-flipped/);
  const modalCrewId = page.getByTestId("crew-card-dialog").getByTestId("crew-card-id");
  await modalCrewId.evaluate(node => { node.textContent = "A-VERY-LONG-ALTERNATE-CREW-IDENTIFIER"; });
  const contained = await modalCrewId.evaluate(node => { const a=node.getBoundingClientRect(), b=node.parentElement.getBoundingClientRect(); return a.left >= b.left && a.right <= b.right && a.width <= b.width; });
  expect(contained).toBe(true);
  expect(await page.getByTestId("crew-card-dialog").evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  expect(await page.locator(".crew-credential-contact dd").evaluateAll(nodes => nodes.every(node => node.scrollWidth <= node.clientWidth))).toBe(true);
});

test("admin Crew edit writes linked primary phone to the profile and reloads it everywhere", async ({ supabaseAuthApp }) => {
  const { page, calls } = supabaseAuthApp;
  expect((await page.evaluate(() => loginService.loginWithPassword("admin@example.com", "password"))).success).toBe(true);
  await page.evaluate(async () => { await crewService.loadAdministrativeCrew(); openEditCrewDrawer("crew-cleanup"); });
  await expect(page.locator("#crew-phone")).toHaveValue("(123) 456-7890");
  await page.locator("#crew-phone").fill("9876543210");
  await page.getByRole("button", { name:"Save Changes" }).click();
  await page.evaluate(() => openEditCrewDrawer("crew-cleanup"));
  await expect(page.locator("#crew-phone")).toHaveValue("(987) 654-3210");
  expect((await page.evaluate(() => getCrewCardModel("crew-cleanup").phone))).toBe("(987) 654-3210");
  expect((await calls()).some(call => call.name === "update_crew_member_with_personnel" && call.args.p_primary_phone === "9876543210")).toBe(true);
});
