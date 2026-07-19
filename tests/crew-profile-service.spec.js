import { test, expect } from "./fixtures/app.fixture.js";

test.describe("Crew profile permissions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.removeItem("bluecrew_accounts");
      localStorage.removeItem("bluecrew_session");
      authService.loginAsAdmin();
    });
  });

  test("admin updates structured crew profile fields and derives age and service", async ({ page }) => {
    const result = await page.evaluate(() => {
      const account = accountService.createAccount({ firstName: "Admin", lastName: "Managed", email: "managed@crew.test" }).data;
      const saved = accountService.updateCrewProfileAsAdmin(account.id, {
        birthdate: "1990-07-14",
        homePhone: "5552223333",
        contactPreference: "call",
        officialHistory: [{ year: 2025, label: "1st Year" }, { year: 2026, label: "2nd Year" }],
        adminNotes: "Internal note"
      });
      return saved;
    });
    expect(result.success).toBe(true);
    expect(result.data.age).toBeGreaterThan(30);
    expect(result.data.yearsOfService).toBe(2);
    expect(result.data.contactPreference).toBe("call");
  });

  test("self-service updates only owned contact fields", async ({ page }) => {
    const result = await page.evaluate(() => {
      const account = accountService.createAccount({ firstName: "Self", lastName: "Service", email: "self@crew.test", birthdate: "1995-01-01" }).data;
      accountService.approveAccount(account.id);
      loginService.login(account.email);
      authService.loginAsUmpire();
      const allowed = accountService.updateCrewSelfServiceProfile(account.id, { email: "self-updated@crew.test", phone: "5554447777", homePhone: "5553338888", address: "12 Home Plate Road", contactPreference: "text" });
      const restricted = accountService.updateCrewSelfServiceProfile(account.id, { email: "self-updated@crew.test", firstName: "Manipulated", birthdate: "2005-01-01", officialHistory: [{ year: 2026, label: "Veteran" }], adminNotes: "Changed", crewCode: "BC-1900-0001" });
      return { allowed, restricted, current: accountService.getById(account.id) };
    });
    expect(result.allowed.success).toBe(true);
    expect(result.current.email).toBe("self-updated@crew.test");
    expect(result.current.address).toBe("12 Home Plate Road");
    expect(result.restricted.success).toBe(false);
    expect(result.current.firstName).toBe("Self");
    expect(result.current.adminNotes).toBe("");
    expect(result.current.crewCode).not.toBe("BC-1900-0001");
  });

  test("one crew member cannot update another account", async ({ page }) => {
    const result = await page.evaluate(() => {
      const first = accountService.createAccount({ firstName: "First", lastName: "Crew", email: "first@crew.test" }).data;
      const second = accountService.createAccount({ firstName: "Second", lastName: "Crew", email: "second@crew.test" }).data;
      accountService.approveAccount(first.id);
      accountService.approveAccount(second.id);
      loginService.login(first.email);
      authService.loginAsUmpire();
      return accountService.updateCrewSelfServiceProfile(second.id, { email: "stolen@crew.test" });
    });
    expect(result.success).toBe(false);
    expect(result.errors.authorization).toBeTruthy();
  });

  test("admin cannot change immutable Crew ID through crew profile update", async ({ page }) => {
    const result = await page.evaluate(() => {
      const account = accountService.createAccount({ firstName: "Immutable", lastName: "Crew", email: "immutable-profile@crew.test" }).data;
      return accountService.updateCrewProfileAsAdmin(account.id, { crewCode: "BC-2000-0001" });
    });
    expect(result.success).toBe(false);
    expect(result.errors.crewCode).toBeTruthy();
  });
});
