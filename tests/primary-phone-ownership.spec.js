import { readFileSync } from "node:fs";
import { test, expect } from "./fixtures/supabase-auth.fixture.js";

const profile = { id:"profile-phone-owner", auth_user_id:"auth-phone-owner", organization_id:"organization-1", first_name:"Phone", last_name:"Owner", email:"owner@example.com", phone:"1112223333", home_phone:"2223334444", emergency_contact:"Emergency", emergency_contact_phone:"3334445555", role:"umpire", status:"approved", communication_preferences:{} };
const crew = { id:"crew-phone-owner", organization_id:"organization-1", profile_id:profile.id, first_name:"Phone", last_name:"Owner", email:"crew-contact@example.com", phone:"9998887777", active:true, eligible_levels:["12U"], preferences:{}, notes:"" };

test.use({ supabaseScenario:{ profile, crewId:crew.id, crewMembers:[crew] } });

test("self-service primary phone update drives Profile and the umpire Crew card while other phones stay independent", async ({ supabaseAuthApp }) => {
  const { page } = supabaseAuthApp;
  expect((await page.evaluate(() => loginService.loginWithPassword("owner@example.com", "password"))).success).toBe(true);
  await page.evaluate(() => renderPage("profile"));
  await page.getByTestId("profile-card-back").click();
  await page.getByTestId("profile-edit-crew-card").click();
  await page.getByTestId("profile-phone").fill("5556667777");
  await page.getByTestId("profile-save").click();
  await expect(page.getByTestId("profile-success")).toHaveText("Profile saved.");
  await page.getByTestId("profile-edit-crew-card").click();
  await expect(page.getByTestId("profile-phone")).toHaveValue("(555) 666-7777");
  await expect(page.getByTestId("profile-home-phone")).toHaveValue("(222) 333-4444");
  await expect(page.getByTestId("profile-emergency-phone")).toHaveValue("(333) 444-5555");
  const model = await page.evaluate(() => getCrewCardModel(crewService.getAuthenticatedCrewMember()));
  expect(model.phone).toBe("(555) 666-7777");
  expect(crew.phone).toBe("9998887777");
});

test("forward migration uses profile phone for linked Crew and preserves unlinked Crew phone", async () => {
  const sql = readFileSync("supabase/migrations/202608140003_linked_crew_primary_phone.sql", "utf8");
  expect(sql).toContain("if target.profile_id is not null");
  expect(sql).toMatch(/update public\.profiles[\s\S]*set phone/);
  expect(sql).toContain("case when target.profile_id is null then target.phone else phone end");
  expect(sql).toContain("if not public.is_administrator()");
  expect(sql).toMatch(/where id = p_crew_member_id and organization_id = actor_org/);
  expect(sql).not.toMatch(/security definer/i);
});
