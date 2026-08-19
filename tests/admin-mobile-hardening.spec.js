import { test, expect } from "./fixtures/app.fixture.js";

async function expectViewportContained(page) {
  const result = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect(result.scrollWidth).toBeLessThanOrEqual(result.viewport + 1);
}

test("portal identity follows administrator, assigner, and umpire context", async ({ app }) => {
  const labels = await app.page.evaluate(() => {
    const result = [];
    for (const [role, login] of [
      ["administrator", () => authService.loginAsAdmin()],
      ["assigner", () => authService.loginAsAssigner()],
      ["umpire", () => authService.loginAsUmpire()]
    ]) {
      login();
      document.body.dataset.role = role;
      updateHeader("dashboard");
      result.push(document.querySelector('[data-testid="portal-identity"]').textContent);
    }
    return result;
  });
  expect(labels).toEqual(["Administrator Portal", "Assigner Portal", "Umpire Portal"]);
});

test("shared Crew Card role presentation does not default privileged roles to Umpire", async ({ app }) => {
  const roles = await app.page.evaluate(() => [
    getCrewCardModel({ id: "admin-role", firstName: "Avery", lastName: "Admin", role: "administrator" }).role,
    getCrewCardModel({ id: "assigner-role", firstName: "Alex", lastName: "Assigner", role: "assigner" }).role,
    getCrewCardModel({ id: "umpire-role", firstName: "Uma", lastName: "Umpire", role: "umpire" }).role
  ]);
  expect(roles).toEqual(["Administrator", "Assigner", "Umpire"]);
});

for (const viewport of [
  { width: 360, height: 800 },
  { width: 430, height: 932 },
  { width: 844, height: 390 }
]) {
  test(`Assigner Workbench uses readable mobile composition at ${viewport.width}x${viewport.height}`, async ({ app }) => {
    await app.page.setViewportSize(viewport);
    await app.page.evaluate(() => {
      authService.loginAsAdmin();
      document.body.dataset.role = "administrator";
      gameService.create({
        date: new Date().toISOString().split("T")[0],
        time: "6:30 PM",
        level: "12U",
        locationComplex: "Lake Shore Athletic Complex",
        locationField: "Field 12",
        field: "Field 12",
        homeTeam: "Mobile Home",
        awayTeam: "Mobile Away",
        gameType: "twoMan"
      });
      renderPage("assigner-workbench");
    });
    const row = app.page.locator(".workbench-mini-game .workbench-item-action").first();
    await expect(row).toHaveCSS("display", "grid");
    const layout = await row.evaluate(element => ({
      width: element.getBoundingClientRect().width,
      parentWidth: element.parentElement.getBoundingClientRect().width,
      mainWordBreak: getComputedStyle(element.querySelector(".workbench-mini-game-main strong")).wordBreak,
      mainOverflowWrap: getComputedStyle(element.querySelector(".workbench-mini-game-main strong")).overflowWrap,
      badgeWhiteSpace: getComputedStyle(element.querySelector(".status-badge")).whiteSpace
    }));
    expect(layout.width).toBeLessThanOrEqual(layout.parentWidth + 1);
    expect(layout.mainWordBreak).toBe("normal");
    expect(layout.mainOverflowWrap).toBe("normal");
    expect(layout.badgeWhiteSpace).toBe("nowrap");
    const notificationLayout = await app.page.getByTestId("workbench-notifications").locator(".workbench-section-header").evaluate(element => {
      const title = element.querySelector("h2").getBoundingClientRect();
      const count = element.querySelector(".workbench-count").getBoundingClientRect();
      const actions = [...element.querySelectorAll(".workbench-notification-actions .button")].map(button => ({
        width: button.getBoundingClientRect().width,
        whiteSpace: getComputedStyle(button).whiteSpace
      }));
      return { titleCountSameRow: Math.abs(title.top - count.top) < 8, actions };
    });
    expect(notificationLayout.titleCountSameRow).toBe(true);
    expect(notificationLayout.actions).toHaveLength(2);
    expect(notificationLayout.actions.every(action => action.width >= 100 && action.whiteSpace === "nowrap")).toBe(true);
    await expect(app.page.locator(".workbench-mini-game").first()).toHaveCSS("list-style-type", "none");
    await expect(app.page.locator(".workbench-mini-game .workbench-item-action").first()).toHaveCSS("border-left-width", "0px");
    await expectViewportContained(app.page);
  });
}

test("Schedule phone calendar remains one aligned seven-column grid", async ({ app }) => {
  await app.page.setViewportSize({ width: 360, height: 800 });
  await app.page.evaluate(() => {
    authService.loginAsAdmin();
    document.body.dataset.role = "administrator";
    renderPage("schedule");
  });
  const calendar = app.page.getByTestId("schedule-calendar");
  const geometry = await calendar.evaluate(element => {
    const headings = [...element.querySelectorAll(".schedule-calendar-weekdays span")].map(node => node.getBoundingClientRect());
    const days = [...element.querySelectorAll(".schedule-calendar-day")].slice(0, 7).map(node => node.getBoundingClientRect());
    return {
      columns: getComputedStyle(element.querySelector(".schedule-calendar-grid")).gridTemplateColumns.split(" ").length,
      aligned: headings.every((heading, index) => Math.abs(heading.left - days[index].left) < 1 && Math.abs(heading.width - days[index].width) < 1),
      contained: element.scrollWidth <= element.clientWidth + 1
    };
  });
  expect(geometry).toEqual({ columns: 7, aligned: true, contained: true });
  await expectViewportContained(app.page);
});

for (const viewport of [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 430, height: 932 },
  { width: 844, height: 390 }
]) {
test(`Operations Center restores the aligned upcoming-work list at ${viewport.width}x${viewport.height}`, async ({ app }) => {
  await app.page.setViewportSize(viewport);
  await app.page.evaluate(() => {
    authService.loginAsAdmin();
    document.body.dataset.role = "administrator";
    const today = new Date().toISOString().split("T")[0];
    for (let index = 0; index < 20; index += 1) {
      gameService.create({
        date: today,
        time: `${8 + (index % 10)}:30 AM`,
        level: index % 2 ? "12U" : "8U",
        locationComplex: "Lake Shore Athletic Complex",
        locationField: `Field ${index + 1}`,
        homeTeam: `Home ${index + 1}`,
        awayTeam: `Away ${index + 1}`,
        gameType: "twoMan"
      });
    }
    renderPage("operations-center");
  });
  const layout = await app.page.getByTestId("operations-upcoming-work").evaluate(element => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    overflowY: getComputedStyle(element).overflowY,
    widthContained: element.scrollWidth <= element.clientWidth + 1,
    headings: [...element.querySelectorAll("thead th")].filter(node => getComputedStyle(node).display !== "none").map(node => node.textContent.trim()),
    hiddenMetadata: [...element.querySelectorAll("tbody .operations-column-location, tbody .operations-column-umpires")].every(node => getComputedStyle(node).display === "none"),
    rowHeights: [...element.querySelectorAll(".operations-staffing-row")].slice(0, 6).map(row => row.getBoundingClientRect().height),
    visibleRows: [...element.querySelectorAll(".operations-staffing-row")].filter(row => {
      const rowRect = row.getBoundingClientRect();
      const panelRect = element.getBoundingClientRect();
      return rowRect.top >= panelRect.top && rowRect.bottom <= panelRect.bottom;
    }).length
  }));
  expect(layout.scrollHeight).toBeGreaterThan(layout.clientHeight);
  expect(layout.clientHeight).toBeLessThanOrEqual(480);
  expect(layout.overflowY).toBe("auto");
  expect(layout.widthContained).toBe(true);
  expect(layout.headings).toEqual(["Time", "Level", "Matchup"]);
  expect(layout.hiddenMetadata).toBe(true);
  expect(Math.max(...layout.rowHeights)).toBeLessThanOrEqual(76);
  expect(layout.visibleRows).toBeGreaterThanOrEqual(4);
  await expectViewportContained(app.page);
});
}

test("administrator Profile front fills the approved portrait frame without affecting role mapping", async ({ app }) => {
  await app.page.setViewportSize({ width: 390, height: 844 });
  const geometry = await app.page.evaluate(() => {
    authService.loginAsAdmin();
    document.body.dataset.role = "administrator";
    document.body.dataset.page = "profile";
    const model = getCrewCardModel({ id: "admin-front", role: "administrator", firstName: "Alex", lastName: "Administrator", status: "approved" });
    document.querySelector("main").innerHTML = `<section class="unified-profile-page"><div class="unified-profile-card profile-baseball-card is-front"><div class="profile-card-stage"><div class="profile-card-orientation"><div class="crew-credential-flipper">${renderCrewCredentialFrontFace(model, { profileDesign: true })}</div></div></div></div></section>`;
    const face = document.querySelector(".profile-crew-card-front").getBoundingClientRect();
    const photo = document.querySelector(".profile-card-front-photo").getBoundingClientRect();
    const stage = document.querySelector(".profile-card-stage").getBoundingClientRect();
    return {
      aspect: stage.width / stage.height,
      faceFill: face.width / stage.width,
      photoFill: photo.width / face.width,
      role: document.querySelector('[data-testid="profile-card-role"]').textContent
    };
  });
  expect(geometry.aspect).toBeCloseTo(5 / 7, 2);
  expect(geometry.faceFill).toBeGreaterThan(.98);
  expect(geometry.photoFill).toBeGreaterThan(.8);
  expect(geometry.role).toBe("ADMINISTRATOR");
  await expectViewportContained(app.page);
});

test("Crew detail actions and administrator editor remain in normal mobile flow", async ({ app }) => {
  await app.page.setViewportSize({ width: 390, height: 844 });
  await app.page.evaluate(() => {
    authService.loginAsAdmin();
    document.body.dataset.role = "administrator";
    renderPage("crew");
  });
  await app.page.getByRole("button", { name: /Open Crew Card/ }).first().click();
  const dialog = app.page.getByTestId("crew-card-dialog");
  const footer = dialog.locator(".crew-credential-modal-footer");
  await expect(footer).toHaveCSS("position", "relative");
  const overlap = await dialog.evaluate(element => {
    const footerRect = element.querySelector(".crew-credential-modal-footer").getBoundingClientRect();
    const structuralOverlap = [
      [element.querySelector(".crew-credential-photo-column"), element.querySelector(".crew-credential-identity-details")],
      [element.querySelector(".crew-credential-identity-panel"), element.querySelector(".crew-credential-contact")]
    ].some(([first, second]) => {
      const left = first.getBoundingClientRect();
      const right = second.getBoundingClientRect();
      return left.bottom > right.top + 1 && left.top < right.bottom - 1;
    });
    const footerOverlap = [...element.querySelectorAll(".crew-credential-face-back section, .crew-credential-face-back header")]
      .filter(node => getComputedStyle(node).display !== "none")
      .some(node => {
        const rect = node.getBoundingClientRect();
        return rect.bottom > footerRect.top && rect.top < footerRect.bottom;
      });
    return structuralOverlap || footerOverlap;
  });
  expect(overlap).toBe(false);
  await app.page.evaluate(() => {
    const crewId = crewService.getAll()[0]?.id;
    if (!openCrewCardAdminEditMode(crewId)) throw new Error("Administrator editor did not open.");
  });
  const editor = app.page.getByTestId("crew-card-admin-edit-mode");
  await expect(editor).toBeVisible();
  await expect(editor.locator(".crew-card-edit-header > div > span")).toHaveCount(0);
  const header = await editor.evaluate(element => {
    const title = element.querySelector("h2").getBoundingClientRect();
    const subtitle = element.querySelector("header p").getBoundingClientRect();
    const cancel = element.querySelector("header .button").getBoundingClientRect();
    return {
      titleSeparated: title.bottom <= subtitle.top + 1,
      cancelSeparated: cancel.top >= subtitle.bottom - 1,
      width: element.getBoundingClientRect().width
    };
  });
  expect(header.titleSeparated).toBe(true);
  expect(header.cancelSeparated).toBe(true);
  expect(header.width).toBeLessThanOrEqual(390);
  await expectViewportContained(app.page);
});
