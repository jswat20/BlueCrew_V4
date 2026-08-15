import { test, expect } from "./fixtures/supabase-auth.fixture.js";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const migrationPath = "supabase/migrations/202608140004_personnel_data_foundation.sql";
const migration = fs.readFileSync(migrationPath, "utf8");
const exactHistoryMigration = fs.readFileSync("supabase/migrations/202608140005_official_history_exact_entry_uniqueness.sql", "utf8");

function dateForAge(years, dayOffset = 0) {
  const today = new Date();
  const date = new Date(today.getFullYear() - years, today.getMonth(), today.getDate() + dayOffset, 12);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

test.describe("DOB registration and calendar rules", () => {
  test.use({ supabaseScenario: { profileMissingUntilProvision: true } });

  test("exactly 13 and an adult can register while one day under 13 is rejected before sign-up", async ({ supabaseAuthApp }) => {
    const exactly13 = dateForAge(13);
    const under13 = dateForAge(13, 1);
    const adult = "1990-06-15";
    const results = await supabaseAuthApp.page.evaluate(async ({ exactly13, under13, adult }) => ({
      exact: await accountService.registerAuthenticatedAccount({ firstName: "Exact", lastName: "Thirteen", email: "exact@example.com", password: "password1234", birthdate: exactly13 }),
      under: accountService.isAtLeastAge(under13, 13),
      adult: accountService.isAtLeastAge(adult, 13)
    }), { exactly13, under13, adult });
    expect(results.exact.success).toBe(true);
    expect(results.under).toBe(false);
    expect(results.adult).toBe(true);
  });

  test("trusted provisioning independently rejects under-13 DOB without profile or email side effects", async ({ supabaseAuthApp }) => {
    const under13 = dateForAge(13, 1);
    const result = await supabaseAuthApp.page.evaluate(async birthdate => {
      const db = await supabaseClientService.getClient();
      const response = await db.rpc("provision_public_pending_umpire", { p_first_name: "Too", p_last_name: "Young", p_phone: "", p_birthdate: birthdate });
      return { response, events: window.__supabaseFixture.settings.communicationEvents, deliveries: window.__supabaseFixture.settings.communicationDeliveries };
    }, under13);
    expect(result.response.error?.message).toBe("minimum_age_13_required");
    expect(result.events).toHaveLength(0);
    expect(result.deliveries).toHaveLength(0);
  });

  test("age changes on the birthday and Feb 29 birthdays use Feb 28 in non-leap years", async ({ supabaseAuthApp }) => {
    const values = await supabaseAuthApp.page.evaluate(() => ({
      before: accountService.deriveAge("2013-08-15", new Date(2026, 7, 14, 12)),
      birthday: accountService.deriveAge("2013-08-15", new Date(2026, 7, 15, 12)),
      feb28: accountService.isBirthdayOn("2000-02-29", new Date(2026, 1, 28, 12)),
      march1: accountService.isBirthdayOn("2000-02-29", new Date(2026, 2, 1, 12)),
      leapDay: accountService.isBirthdayOn("2000-02-29", new Date(2028, 1, 29, 12))
    }));
    expect(values).toEqual({ before: 12, birthday: 13, feb28: true, march1: false, leapDay: true });
  });

  test("migration makes DOB authoritative and preserves legacy null values", () => {
    expect(migration).toContain("p_birthdate date");
    expect(migration).toContain("p_birthdate > (current_date - interval '13 years')::date");
    expect(migration).toContain("birthdate)\n  values");
    expect(migration).not.toMatch(/alter column birthdate set not null/i);
    expect(migration.indexOf("minimum_age_13_required")).toBeLessThan(migration.indexOf("insert into public.profiles"));
  });
});

test.describe("official history and authorized personnel correction", () => {
  const admin = { id:"admin-personnel",auth_user_id:"auth-admin-personnel",organization_id:"organization-1",first_name:"Admin",last_name:"Personnel",email:"admin@personnel.test",role:"administrator",status:"approved",communication_preferences:{} };
  const umpire = { id:"profile-personnel",auth_user_id:"auth-profile-personnel",organization_id:"organization-1",first_name:"History",last_name:"Umpire",email:"history@personnel.test",phone:"",birthdate:null,personnel_id:"UMP-001",official_history:[],role:"umpire",status:"approved",communication_preferences:{} };
  const crew = { id:"crew-personnel",organization_id:"organization-1",profile_id:umpire.id,first_name:"History",last_name:"Umpire",email:"history@personnel.test",phone:"",active:true,eligible_levels:["12U"],preferences:{},notes:"" };
  test.use({ supabaseScenario: { profile:admin,crewId:null,pendingProfiles:[umpire],crewMembers:[crew] } });
  async function addHistory(page, { year, season, role="umpire", level }) {
    const row = page.getByTestId("crew-history-add-row");
    await row.locator('[data-history-new="year"]').selectOption(String(year));
    await row.locator('[data-history-new="season"]').selectOption(season);
    await row.locator('[data-history-new="role"]').selectOption(role);
    await row.locator('[data-history-new="level"]').selectOption(level);
    await page.getByTestId("crew-history-add").click();
  }

  test("administrator records DOB and seasons while distinct years derive Years of Service", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    expect((await page.evaluate(()=>loginService.loginWithPassword("admin@personnel.test","password"))).success).toBe(true);
    await page.evaluate(async()=>{await crewService.loadAdministrativeCrew();renderPage("crew");openCrewCredentialCard("crew-personnel");});
    await page.getByTestId("crew-card-edit").click();
    await page.getByTestId("crew-birthdate").fill("2000-06-15");
    await addHistory(page,{year:2024,season:"Fall",level:"12U"});
    await addHistory(page,{year:2025,season:"Spring",level:"12U"});
    await addHistory(page,{year:2025,season:"Fall",level:"12U"});
    await page.getByRole("button",{name:"Save Changes"}).click();
    await expect(page.getByText("Crew member saved.")).toBeVisible();
    const stored=await page.evaluate(()=>window.__supabaseFixture.settings.pendingProfiles.find(profile=>profile.id==="profile-personnel"));
    expect(stored.birthdate).toBe("2000-06-15");
    expect(stored.official_history).toHaveLength(3);
    expect(await page.evaluate(history=>accountService.deriveYearsOfService(history),stored.official_history)).toBe(2);
  });

  test("duplicate year/season is rejected before mutation", async ({ supabaseAuthApp }) => {
    const { page }=supabaseAuthApp;
    expect((await page.evaluate(()=>loginService.loginWithPassword("admin@personnel.test","password"))).success).toBe(true);
    await page.evaluate(async()=>{await crewService.loadAdministrativeCrew();renderPage("crew");openCrewCredentialCard("crew-personnel");});
    await page.getByTestId("crew-card-edit").click();
    await addHistory(page,{year:2025,season:"Fall",level:"12U"});
    await addHistory(page,{year:2025,season:"Fall",level:"12U"});
    await expect(page.getByTestId("crew-mutation-error")).toContainText("exact Official History entry already exists");
  });

  test("single add row validates, clears, and Delete Selected persists", async ({ supabaseAuthApp }) => {
    const { page }=supabaseAuthApp;
    expect((await page.evaluate(()=>loginService.loginWithPassword("admin@personnel.test","password"))).success).toBe(true);
    await page.evaluate(async()=>{await crewService.loadAdministrativeCrew();renderPage("crew");openCrewCredentialCard("crew-personnel");});
    await page.getByTestId("crew-card-edit").click();
    await page.getByTestId("crew-history-add").click();
    await expect(page.getByTestId("crew-mutation-error")).toContainText("are required");
    await addHistory(page,{year:2025,season:"Spring",level:"8U"});
    await addHistory(page,{year:2025,season:"Fall",level:"10U"});
    await expect(page.getByTestId("crew-history-years")).toContainText("1 year");
    await expect(page.locator('[data-history-new="year"]')).toHaveValue("");
    await page.locator("[data-history-delete-index]").first().check();
    await page.getByTestId("crew-history-delete").click();
    await expect(page.getByTestId("crew-official-history-list").locator(".crew-history-list-row")).toHaveCount(1);
    expect(await page.evaluate(()=>window.__supabaseFixture.settings.pendingProfiles.find(profile=>profile.id==="profile-personnel").official_history)).toHaveLength(1);
  });

  test("schema restricts history to self/admin reads and administrator-only writes", () => {
    expect(migration).toContain("profile_id = public.current_profile_id() or public.is_administrator()");
    expect(migration).toContain("if not public.is_administrator() then raise exception 'administrator_required'");
    expect(migration).toContain("count(distinct service_year)::integer");
    expect(migration).not.toContain("years_of_service smallint");
    expect(exactHistoryMigration).toContain("unique (organization_id, profile_id, service_year, season_label, service_role, level)");
    expect(exactHistoryMigration).toContain("if not public.is_administrator()");
    expect(exactHistoryMigration).toContain("on conflict (organization_id, profile_id, service_year, season_label, service_role, level)");
  });
});

test.describe("permanent personnel IDs and birthday support", () => {
  test("uses independent per-organization role counters and immutable trigger assignment", () => {
    expect(migration).toContain("primary key (organization_id, role_prefix)");
    expect(migration).toContain("on conflict (organization_id, role_prefix) do update");
    expect(migration).toContain("next_value = public.personnel_id_counters.next_value + 1");
    expect(migration).toContain("when 'administrator' then 'ADM' when 'assigner' then 'ASN' else 'UMP'");
    expect(migration).toContain("where status = 'approved' and personnel_id is null");
    expect(migration).toContain("order by organization_id, role, created_at, id");
    expect(migration).toContain("new.status <> 'approved' or new.personnel_id is not null");
    expect(migration).toContain("profiles_organization_personnel_id_key");
  });

  test("birthday support is annual-idempotent, private, and Feb-29 deterministic", () => {
    expect(migration).toContain("birthday:', target.id, ':', extract(year from p_on_date)");
    expect(migration).toContain("grant execute on function public.enqueue_due_birthday_communications(date) to service_role");
    expect(migration).toContain("then extract(month from p_on_date) = 2 and extract(day from p_on_date) = 28");
    expect(migration).not.toContain("p_birthdate =>");
  });

  test("birthday email is friendly and does not expose DOB", async () => {
    const moduleUrl = `${pathToFileURL(path.resolve("supabase/functions/_shared/communication-template.mjs")).href}?personnel=${Date.now()}`;
    const { renderCommunicationEmail } = await import(moduleUrl);
    const message = renderCommunicationEmail({ event_type:"birthday", recipient_display_name:"Birthday Umpire", metadata:{ firstName:"Birthday", birthdate:"2000-02-29" }, organization_settings:{} });
    expect(message.subject).toContain("Happy Birthday");
    expect(message.text).toContain("Happy birthday");
    expect(message.text).not.toContain("2000-02-29");
    expect(message.html).not.toContain("2000-02-29");
  });
});
