const { test, expect } = require("@playwright/test");

test.describe("Authorization Service", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("loads the authorization service", async ({ page }) => {
    const available = await page.evaluate(() => {
      return typeof authorizationService !== "undefined";
    });

    expect(available).toBe(true);
  });

  test("grants administrator permissions", async ({ page }) => {
    const permissions = await page.evaluate(() => ({
      editSchedule:
        authorizationService.canEditSchedule("administrator"),

      approveClaims:
        authorizationService.canApproveClaims("administrator"),

      manageAccounts:
        authorizationService.canManageAccounts("administrator"),

      assignGames:
        authorizationService.canAssignGames("administrator"),

      manageCrew:
        authorizationService.canManageCrew("administrator"),

      claimGames:
        authorizationService.canClaimGames("administrator")
    }));

    expect(permissions).toEqual({
      editSchedule: true,
      approveClaims: true,
      manageAccounts: true,
      assignGames: true,
      manageCrew: true,
      claimGames: false
    });
  });

  test("grants assigner permissions", async ({ page }) => {
    const permissions = await page.evaluate(() => ({
      editSchedule:
        authorizationService.canEditSchedule("assigner"),

      approveClaims:
        authorizationService.canApproveClaims("assigner"),

      manageAccounts:
        authorizationService.canManageAccounts("assigner"),

      assignGames:
        authorizationService.canAssignGames("assigner"),

      manageCrew:
        authorizationService.canManageCrew("assigner"),

      claimGames:
        authorizationService.canClaimGames("assigner")
    }));

    expect(permissions).toEqual({
      editSchedule: true,
      approveClaims: true,
      manageAccounts: false,
      assignGames: true,
      manageCrew: false,
      claimGames: false
    });
  });

  test("grants umpire permissions", async ({ page }) => {
    const permissions = await page.evaluate(() => ({
      editSchedule:
        authorizationService.canEditSchedule("umpire"),

      approveClaims:
        authorizationService.canApproveClaims("umpire"),

      manageAccounts:
        authorizationService.canManageAccounts("umpire"),

      assignGames:
        authorizationService.canAssignGames("umpire"),

      manageCrew:
        authorizationService.canManageCrew("umpire"),

      claimGames:
        authorizationService.canClaimGames("umpire")
    }));

    expect(permissions).toEqual({
      editSchedule: false,
      approveClaims: false,
      manageAccounts: false,
      assignGames: false,
      manageCrew: false,
      claimGames: true
    });
  });

  test("supports the legacy admin role", async ({ page }) => {
    const permissions = await page.evaluate(() => ({
      manageAccounts:
        authorizationService.canManageAccounts("admin"),

      editSchedule:
        authorizationService.canEditSchedule("admin"),

      crew:
        authorizationService.canView("crew", "admin")
    }));

    expect(permissions).toEqual({
      manageAccounts: true,
      editSchedule: true,
      crew: true
    });
  });

  test("defaults unknown roles to umpire permissions", async ({ page }) => {
    const permissions = await page.evaluate(() => ({
      claimGames:
        authorizationService.canClaimGames("unknown-role"),

      editSchedule:
        authorizationService.canEditSchedule("unknown-role"),

      accounts:
        authorizationService.canView(
          "accounts",
          "unknown-role"
        ),

      availability:
        authorizationService.canView(
          "availability",
          "unknown-role"
        )
    }));

    expect(permissions).toEqual({
      claimGames: true,
      editSchedule: false,
      accounts: false,
      availability: true
    });
  });

  test("authorizes administrator pages", async ({ page }) => {
    const access = await page.evaluate(() => ({
      dashboard:
        authorizationService.canView(
          "dashboard",
          "administrator"
        ),

      schedule:
        authorizationService.canView(
          "schedule",
          "administrator"
        ),

      accounts:
        authorizationService.canView(
          "accounts",
          "administrator"
        ),

      crew:
        authorizationService.canView(
          "crew",
          "administrator"
        ),

      claimsQueue:
        authorizationService.canView(
          "claims-queue",
          "administrator"
        ),

      claimGames:
        authorizationService.canView(
          "claim-games",
          "administrator"
        )
    }));

    expect(access).toEqual({
      dashboard: true,
      schedule: true,
      accounts: true,
      crew: true,
      claimsQueue: true,
      claimGames: false
    });
  });

  test("authorizes assigner pages", async ({ page }) => {
    const access = await page.evaluate(() => ({
      dashboard:
        authorizationService.canView(
          "dashboard",
          "assigner"
        ),

      schedule:
        authorizationService.canView(
          "schedule",
          "assigner"
        ),

      claimsQueue:
        authorizationService.canView(
          "claims-queue",
          "assigner"
        ),

      accounts:
        authorizationService.canView(
          "accounts",
          "assigner"
        ),

      crew:
        authorizationService.canView(
          "crew",
          "assigner"
        ),

      claimGames:
        authorizationService.canView(
          "claim-games",
          "assigner"
        )
    }));

    expect(access).toEqual({
      dashboard: true,
      schedule: true,
      claimsQueue: true,
      accounts: false,
      crew: false,
      claimGames: false
    });
  });

  test("authorizes umpire pages", async ({ page }) => {
    const access = await page.evaluate(() => ({
      dashboard:
        authorizationService.canView(
          "dashboard",
          "umpire"
        ),

      availability:
        authorizationService.canView(
          "availability",
          "umpire"
        ),

      notifications:
        authorizationService.canView(
          "notifications",
          "umpire"
        ),

      claimGames:
        authorizationService.canView(
          "claim-games",
          "umpire"
        ),

      myClaims:
        authorizationService.canView(
          "my-claims",
          "umpire"
        ),

      schedule:
        authorizationService.canView(
          "schedule",
          "umpire"
        ),

      accounts:
        authorizationService.canView(
          "accounts",
          "umpire"
        ),

      claimsQueue:
        authorizationService.canView(
          "claims-queue",
          "umpire"
        )
    }));

    expect(access).toEqual({
      dashboard: true,
      availability: true,
      notifications: true,
      claimGames: true,
      myClaims: true,
      schedule: false,
      accounts: false,
      claimsQueue: false
    });
  });

  test("denies unknown pages", async ({ page }) => {
    const access = await page.evaluate(() => {
      return authorizationService.canView(
        "not-a-real-page",
        "administrator"
      );
    });

    expect(access).toBe(false);
  });

  test("denies unknown permissions", async ({ page }) => {
    const allowed = await page.evaluate(() => {
      return authorizationService.can(
        "notARealPermission",
        "administrator"
      );
    });

    expect(allowed).toBe(false);
  });
});
