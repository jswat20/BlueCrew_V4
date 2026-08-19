import { test, expect } from "./fixtures/app.fixture.js";

async function seedClaimableGame(app) {
  await app.loginAsApprovedUmpire();
  return app.page.evaluate(() => {
    const account = loginService.getCurrentAccount();
    const game = gameService.create({
      date: "2099-09-12", time: "10:00", level: "8U",
      locationComplex: "Lake Shore Youth Baseball", locationField: "Field 6", field: "Field 6",
      homeTeam: "Home", awayTeam: "Away", gameType: "single"
    }).data;
    authService.loginAsAdmin();
    assignmentService.openForClaims(game.id);
    authService.useAuthenticatedAccount(account);
    renderPage("claim-games");
    return game.id;
  });
}

async function expectPageContained(page) {
  const geometry = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth
  }));
  expect(geometry.page).toBeLessThanOrEqual(geometry.viewport + 1);
}

for (const viewport of [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 }
]) {
  test(`Claim Games deliberately reflows at ${viewport.width}px portrait`, async ({ app }) => {
    await app.page.setViewportSize(viewport);
    const gameId = await seedClaimableGame(app);
    const row = app.page.getByTestId(`claim-game-row-${gameId}`);
    await expect(row).toHaveCSS("display", "grid");
    await expect(app.page.locator(".claim-games-table thead")).toHaveCSS("display", "none");
    await expect(row).toContainText("Lake Shore Youth Baseball");
    await expect(row).toContainText("Field 6");
    const claim = row.getByTestId(`claim-game-${gameId}`);
    await expect(claim).toHaveText("Claim");
    await expect(claim).toHaveCSS("white-space", "nowrap");
    expect((await claim.boundingBox()).height).toBeGreaterThanOrEqual(44);
    const layout = await row.evaluate(element => {
      const cells = [...element.querySelectorAll("td")].map(cell => cell.getBoundingClientRect());
      const bounds = element.getBoundingClientRect();
      return {
        contained: cells.every(rect => rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1 && rect.top >= bounds.top - 1 && rect.bottom <= bounds.bottom + 1),
        height: bounds.height,
        dateWordBreak: getComputedStyle(element.querySelector(".claim-game-date")).wordBreak,
        levelWordBreak: getComputedStyle(element.querySelector(".claim-game-level")).wordBreak
      };
    });
    expect(layout.contained).toBe(true);
    expect(layout.height).toBeGreaterThan(120);
    expect(layout.dateWordBreak).toBe("normal");
    expect(layout.levelWordBreak).toBe("normal");
    await expect(app.page.locator(".game-list-filters summary")).toBeVisible();
    await expectPageContained(app.page);
  });
}

test("Claim Games keeps a compact card in common phone landscape", async ({ app }) => {
  await app.page.setViewportSize({ width: 844, height: 390 });
  const gameId = await seedClaimableGame(app);
  const row = app.page.getByTestId(`claim-game-row-${gameId}`);
  await expect(row).toHaveCSS("display", "grid");
  await expect(app.page.locator(".claim-games-table thead")).toHaveCSS("display", "none");
  await expect(row.getByTestId(`claim-game-${gameId}`)).toHaveCSS("white-space", "nowrap");
  expect((await row.boundingBox()).height).toBeLessThan(180);
  await expectPageContained(app.page);
});

for (const viewport of [
  { width: 360, height: 800 },
  { width: 430, height: 932 },
  { width: 780, height: 412 },
  { width: 844, height: 390 },
  { width: 890, height: 430 }
]) {
  test(`My Schedule uses contained compact cards at ${viewport.width}x${viewport.height}`, async ({ app }) => {
    await app.page.setViewportSize(viewport);
    await app.loginAsApprovedUmpire();
    await app.page.evaluate(() => renderPage("my-schedule"));
    const row = app.page.locator('[data-testid^="my-schedule-row-"]').first();
    await expect(row).toHaveCSS("display", "grid");
    const layout = await row.evaluate(element => {
      const bounds = element.getBoundingClientRect();
      const cells = [...element.querySelectorAll("td")].map(cell => ({
        rect: cell.getBoundingClientRect(),
        text: cell.textContent.trim(),
        whiteSpace: getComputedStyle(cell).whiteSpace
      }));
      return {
        height: bounds.height,
        contained: cells.every(({ rect }) => rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1),
        hiddenPopulatedCells: cells.filter(({ rect, text }) => text && (rect.width === 0 || rect.height === 0)).map(({ text }) => text)
      };
    });
    expect(layout.contained).toBe(true);
    expect(layout.hiddenPopulatedCells).toEqual([]);
    expect(layout.height).toBeLessThan(viewport.width < 700 ? 260 : 180);
    const open = row.locator('[data-testid^="my-schedule-open-game-"]');
    await expect(open).toHaveCSS("white-space", "nowrap");
    expect((await open.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await expectPageContained(app.page);
  });
}

test("Profile back uses the available common phone landscape width", async ({ app }) => {
  await app.page.setViewportSize({ width: 844, height: 390 });
  await app.page.emulateMedia({ reducedMotion: "reduce" });
  await app.loginAsApprovedUmpire();
  await app.page.evaluate(() => renderPage("profile"));
  await app.page.getByTestId("profile-card-back").click();
  const back = app.page.getByTestId("crew-card-back");
  await expect(back).toContainText("Official History");
  await expect(back).toContainText("Eligibility");
  await expect(back).toContainText("Contact Information");
  const stage = await app.page.locator(".profile-card-stage").boundingBox();
  expect(stage.width).toBeGreaterThan(700);
  expect(stage.height).toBeGreaterThan(500);
  const columns = await back.locator(".profile-card-back-body").evaluate(element => getComputedStyle(element).gridTemplateColumns.split(" ").length);
  expect(columns).toBe(2);
  await expectPageContained(app.page);
});

for (const width of [360, 390, 430]) {
  test(`Profile back and self editor reflow at ${width}px`, async ({ app }) => {
    await app.page.setViewportSize({ width, height: 844 });
    await app.page.emulateMedia({ reducedMotion: "reduce" });
    await app.loginAsApprovedUmpire();
    await app.page.evaluate(() => renderPage("profile"));
    await app.page.getByTestId("profile-card-back").click();
    const back = app.page.getByTestId("crew-card-back");
    await expect(back).toBeVisible();
    await expect(back).toContainText("Official History");
    await expect(back).toContainText("Eligibility");
    await expect(back).toContainText("Contact Information");
    const backLayout = await back.evaluate(element => {
      const bounds = element.getBoundingClientRect();
      const visible = [...element.querySelectorAll("*")].filter(child => {
        const style = getComputedStyle(child); const rect = child.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width && rect.height;
      });
      const offenders = visible.filter(child => { const rect = child.getBoundingClientRect(); return rect.left < bounds.left - 2 || rect.right > bounds.right + 2 || rect.top < bounds.top - 2 || rect.bottom > bounds.bottom + 2; });
      return {
        height: bounds.height,
        contained: offenders.length === 0,
        offenders: offenders.slice(0,5).map(child => `${child.tagName}.${child.className}`)
      };
    });
    expect(backLayout.height).toBeGreaterThanOrEqual(700);
    expect(backLayout.contained, backLayout.offenders.join(", ")).toBe(true);
    await app.page.getByTestId("profile-edit-crew-card").click();
    const dialog = app.page.getByTestId("crew-card-dialog");
    const editor = app.page.getByTestId("crew-card-self-edit-mode");
    await expect(editor).toBeVisible();
    const dialogBounds = await dialog.boundingBox();
    expect(dialogBounds.width).toBeLessThanOrEqual(width);
    expect(dialogBounds.height).toBeLessThanOrEqual(844);
    const headerLayout = await dialog.evaluate(element => {
      const shell = element.querySelector('[data-testid="crew-card-self-edit-shell"]');
      const header = shell.querySelector(".crew-card-edit-header").getBoundingClientRect();
      const title = shell.querySelector("h2").getBoundingClientRect();
      const subtitle = shell.querySelector("p").getBoundingClientRect();
      const cancel = shell.querySelector("header .button").getBoundingClientRect();
      return {
        scrollTop: shell.scrollTop,
        titleSubtitleSeparated: title.bottom <= subtitle.top + 1,
        cancelSeparated: cancel.left >= title.right - 1 || cancel.top >= subtitle.bottom - 1
      };
    });
    expect(headerLayout.scrollTop).toBe(0);
    expect(headerLayout.titleSubtitleSeparated).toBe(true);
    expect(headerLayout.cancelSeparated).toBe(true);
    await editor.getByTestId("profile-save").scrollIntoViewIfNeeded();
    await expect(editor.getByTestId("profile-save")).toBeVisible();
    expect((await editor.getByTestId("profile-save").boundingBox()).height).toBeGreaterThanOrEqual(44);
    await expectPageContained(app.page);
  });
}

test("navigation group headings present an interactive visual hierarchy", async ({ app }) => {
  await app.page.setViewportSize({ width: 390, height: 844 });
  await app.page.goto("/");
  const toggle = app.page.getByTestId("nav-group-scheduling").locator(".nav-group-toggle");
  await expect(toggle).toHaveCSS("cursor", "pointer");
  await expect(toggle).not.toHaveCSS("background-image", "none");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
});

test("self editor landscape header and content do not collide", async ({ app }) => {
  await app.page.setViewportSize({ width: 844, height: 390 });
  await app.page.emulateMedia({ reducedMotion: "reduce" });
  await app.loginAsApprovedUmpire();
  await app.page.evaluate(() => renderPage("profile"));
  await app.page.getByTestId("profile-card-back").click();
  await app.page.getByTestId("profile-edit-crew-card").click();
  const shell = app.page.getByTestId("crew-card-self-edit-shell");
  const layout = await shell.evaluate(element => {
    const title = element.querySelector("h2").getBoundingClientRect();
    const subtitle = element.querySelector("header p").getBoundingClientRect();
    const cancel = element.querySelector("header .button").getBoundingClientRect();
    const header = element.querySelector(".crew-card-edit-header").getBoundingClientRect();
    const form = element.querySelector(".unified-crew-self-editor").getBoundingClientRect();
    const firstSectionHeading = element.querySelector(".unified-crew-self-editor section h3").getBoundingClientRect();
    return {
      scrollTop: element.scrollTop,
      titleSubtitleSeparated: title.bottom <= subtitle.top + 1,
      cancelSeparated: cancel.left >= title.right - 1,
      formBelowHeader: form.top >= header.bottom - 1,
      firstHeadingBelowHeader: firstSectionHeading.top >= header.bottom - 1
    };
  });
  expect(layout).toEqual({ scrollTop: 0, titleSubtitleSeparated: true, cancelSeparated: true, formBelowHeader: true, firstHeadingBelowHeader: true });
  await expectPageContained(app.page);
});
