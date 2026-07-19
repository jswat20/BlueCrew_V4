import { test, expect } from "./fixtures/app.fixture.js";

const SMALL_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=";

test.describe("Crew photo persistence", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.removeItem("bluecrew_accounts");
      localStorage.removeItem("bluecrew_session");
      authService.loginAsAdmin();
    });
  });

  test("accepts bounded JPEG, PNG, and WebP data URLs", async ({ page }) => {
    const result = await page.evaluate(photo => accountService.validatePhotoDataUrl(photo), SMALL_PNG);
    expect(result.success).toBe(true);
  });

  test("rejects unsupported and oversized persisted images", async ({ page }) => {
    const result = await page.evaluate(() => ({
      unsupported: accountService.validatePhotoDataUrl("data:image/gif;base64,R0lGODlhAQABAIAAAAUEBA=="),
      oversized: accountService.validatePhotoDataUrl(`data:image/png;base64,${"A".repeat(560000)}`)
    }));
    expect(result.unsupported.success).toBe(false);
    expect(result.oversized.success).toBe(false);
  });

  test("account creation rejects an unsupported photo", async ({ page }) => {
    const result = await page.evaluate(() => accountService.createAccount({ firstName: "Bad", lastName: "Photo", email: "bad-photo@test.com", photoDataUrl: "data:image/gif;base64,R0lGODlhAQABAIAAAAUEBA==" }));
    expect(result.success).toBe(false);
    expect(result.errors.photo).toBeTruthy();
  });

  test("crew member can update their own photo but not another account", async ({ page }) => {
    const result = await page.evaluate(photo => {
      const mine = accountService.createAccount({ firstName: "Photo", lastName: "Owner", email: "photo-owner@test.com" }).data;
      const other = accountService.createAccount({ firstName: "Other", lastName: "Owner", email: "other-owner@test.com" }).data;
      accountService.approveAccount(mine.id);
      accountService.approveAccount(other.id);
      loginService.login(mine.email);
      authService.loginAsUmpire();
      return {
        mine: accountService.updateCrewSelfServiceProfile(mine.id, { email: mine.email, photoDataUrl: photo }),
        other: accountService.updateCrewSelfServiceProfile(other.id, { email: other.email, photoDataUrl: photo })
      };
    }, SMALL_PNG);
    expect(result.mine.success).toBe(true);
    expect(result.mine.data.photoDataUrl).toBe(SMALL_PNG);
    expect(result.other.success).toBe(false);
  });
});
