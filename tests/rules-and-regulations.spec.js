const { test, expect } = require("@playwright/test");

const SOURCE_URL = "https://cdn2.sportngin.com/attachments/document/60a0-3547856/LSYB_Playing_Rules_3-17-2026__1_.pdf";
const RESPONSIBILITIES_PDF = "assets/rules/umpire-responsibilities/junior-umpire-responsibilities-august-2026.pdf";
const COOP_NOTICE = "The Lake Shore playing rules will be in effect for all in-house games. Games between Lake Shore teams and Co-Op teams will be governed by the Co-Op rules and Lake Shore Rule Extensions, Additions, and Exceptions will not apply.";
const LAST_INNING_RULE = "When the time limit is approaching, a “Last Inning” may be declared if both managers agree before the start of the top of that inning.";
const PLATE_MEETING_RULE = "“5-run max per inning” except the last inning where it’s unlimited”";
const SIGNALS = ["out", "safe", "fair", "foul", "strike", "time", "play"];

async function openRules(page, role = "administrator") {
  await page.goto("/");
  await page.evaluate(selectedRole => {
    const logins = {
      administrator: () => authService.loginAsAdmin(),
      assigner: () => authService.loginAsAssigner(),
      umpire: () => authService.loginAsUmpire()
    };
    logins[selectedRole]();
    renderPage("rules-and-regulations");
  }, role);
}

test.describe("Rules & Regulations", () => {
  test("is available to administrator, assigner, and umpire roles while Availability stays disabled", async ({ page }) => {
    await page.goto("/");
    const access = await page.evaluate(() => ({
      rules: ["administrator", "assigner", "umpire"].map(role => authorizationService.canView("rules-and-regulations", role)),
      availability: ["administrator", "assigner", "umpire"].map(role => authorizationService.canView("availability", role)),
      availabilityDisabled: authorizationService.isPageDisabled("availability")
    }));
    expect(access).toEqual({ rules: [true, true, true], availability: [false, false, false], availabilityDisabled: true });

    for (const role of ["administrator", "assigner", "umpire"]) {
      await openRules(page, role);
      await expect(page.getByTestId("rules-and-regulations-content")).toBeVisible();
      await expect(page.getByTestId("nav-rules-and-regulations")).toBeVisible();
      await expect(page.getByTestId("nav-availability")).toHaveCount(0);
    }
  });

  test("opens Umpire Responsibilities first and selected by default", async ({ page }) => {
    await openRules(page);
    const tabs = page.locator('[role="tab"]');
    await expect(tabs).toHaveCount(3);
    await expect(tabs.nth(0)).toHaveText("Umpire Responsibilities");
    await expect(tabs.nth(1)).toHaveText("Clinic");
    await expect(tabs.nth(2)).toHaveText("Pinto");
    await expect(page.getByTestId("rules-tab-umpire-responsibilities")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("rules-tab-umpire-responsibilities")).toHaveAttribute("tabindex", "0");
    await expect(page.getByTestId("rules-panel-umpire-responsibilities")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Jr. Umpire Responsibilities" })).toBeVisible();
  });

  test("returns to Umpire Responsibilities through ordinary navigation", async ({ page }) => {
    await openRules(page, "umpire");
    await page.getByTestId("rules-tab-pinto").click();
    await page.evaluate(() => navigateTo("profile"));
    await page.evaluate(() => navigateTo("rules-and-regulations"));
    await expect(page.getByTestId("rules-panel-umpire-responsibilities")).toBeVisible();
    await expect(page.getByTestId("rules-tab-umpire-responsibilities")).toHaveAttribute("aria-selected", "true");
  });

  test("renders every responsibilities section and preserves supplied wording", async ({ page }) => {
    await openRules(page, "umpire");
    const panel = page.getByTestId("rules-panel-umpire-responsibilities");
    for (const heading of ["PREGAME", "IN-GAME", "Professionalism & Mechanics", "UNIFORM", "Proper Hand Signals", "POSTGAME"]) {
      await expect(panel.getByText(heading, { exact: true }).first()).toBeVisible();
    }
    await expect(panel).toContainText("Before the season, take some time and read thru the official rules a couple times.");
    await expect(panel).toContainText("Walk out and stand at the point of home plate and yell “COACHES!!”");
    await expect(panel).toContainText(PLATE_MEETING_RULE);
    await expect(panel).toContainText("Log back in to The Slate app, navigate to the game you just finished, and press the “Complete Game” button.");
    await expect(panel).toContainText("And that’s it!  From that point if you feel like you need to reach out and talk about something, discuss a situation, or just vent about something or someone, feel free to reach out at any time.");
    await expect(panel).toContainText("John Switala");
    await expect(panel).toContainText("(410) 627-6250");
    await expect(panel).toContainText("Juniorumps@gmail.com");
  });

  test("renders all seven exact locally hosted signal graphics with meaningful alternatives", async ({ page }) => {
    await openRules(page);
    await expect(page.locator(".responsibilities-signal img")).toHaveCount(7);
    for (const signal of SIGNALS) {
      const card = page.getByTestId(`responsibilities-signal-${signal}`);
      const image = card.locator("img");
      await expect(image).toHaveAttribute("src", `assets/rules/umpire-responsibilities/${signal}.jpg?v=20260821`);
      const alt = await image.getAttribute("alt");
      expect(alt.length).toBeGreaterThan(20);
      await expect(card.locator("figcaption strong")).toHaveText(new RegExp(`^${signal}$`, "i"));
    }
  });

  test("uses a safe locally hosted responsibilities PDF and keeps the official rules PDF", async ({ page }) => {
    await openRules(page);
    const responsibilitiesSource = page.getByTestId("responsibilities-pdf-link");
    await expect(responsibilitiesSource).toHaveText("View/Download Umpire Responsibilities PDF");
    await expect(responsibilitiesSource).toHaveAttribute("href", RESPONSIBILITIES_PDF);
    await expect(responsibilitiesSource).toHaveAttribute("target", "_blank");
    await expect(responsibilitiesSource).toHaveAttribute("rel", /noopener/);
    await expect(responsibilitiesSource).toHaveAttribute("rel", /noreferrer/);
    const officialSource = page.getByTestId("rules-source-link");
    await expect(officialSource).toHaveAttribute("href", SOURCE_URL);
    await expect(officialSource).toHaveAttribute("target", "_blank");
    await expect(officialSource).toHaveAttribute("rel", /noopener/);
    await expect(officialSource).toHaveAttribute("rel", /noreferrer/);
    const response = await page.request.get(`/${RESPONSIBILITIES_PDF}`);
    expect(response.ok()).toBeTruthy();
    expect((await response.body()).subarray(0, 5).toString()).toBe("%PDF-");
  });

  test("switches among all tabs while preserving Clinic and Pinto content", async ({ page }) => {
    await openRules(page, "umpire");
    await page.getByTestId("rules-tab-clinic").click();
    await expect(page.getByTestId("rules-panel-clinic")).toBeVisible();
    await expect(page.getByTestId("rules-panel-clinic").getByText("Coach Pitch", { exact: true })).toBeVisible();
    await expect(page.getByTestId("rules-coop-notice")).toContainText(COOP_NOTICE);
    await expect(page.locator(".rules-section")).toHaveCount(6);
    await expect(page.locator(".rules-source-note")).toHaveText("Source: Lake Shore Youth Baseball Playing Rules, revised March 19, 2026.");
    await page.getByTestId("rules-tab-pinto").click();
    await expect(page.getByTestId("rules-panel-pinto")).toBeVisible();
    await expect(page.getByTestId("rules-panel-pinto").getByText("Kid Pitch", { exact: true })).toBeVisible();
    await expect(page.getByTestId("rules-panel-pinto")).toContainText(LAST_INNING_RULE);
    await expect(page.locator(".rules-section")).toHaveCount(6);
    await page.getByTestId("rules-tab-umpire-responsibilities").click();
    await expect(page.getByTestId("rules-panel-umpire-responsibilities")).toBeVisible();
    await expect(page.locator("body")).toHaveAttribute("data-page", "rules-and-regulations");
  });

  test("keeps the complete Clinic and Pinto rules unchanged in the shared data source", async ({ page }) => {
    await page.goto("/");
    const contract = await page.evaluate(() => ({
      divisions: RULES_AND_REGULATIONS.divisions.map(division => ({
        id: division.id,
        sections: division.sections.map(section => section.title),
        ruleCounts: division.sections.map(section => section.rules.length)
      })),
      pintoLastInning: RULES_AND_REGULATIONS.divisions[1].sections[2].rules[3]
    }));
    expect(contract.divisions).toEqual([
      { id: "clinic", sections: ["General", "Field & Equipment", "Game & Innings", "Batting & Base running", "Pitching", "Fielding"], ruleCounts: [5, 11, 5, 13, 4, 11] },
      { id: "pinto", sections: ["General", "Field & Equipment", "Game & Innings", "Batting & Base running", "Pitching", "Fielding"], ruleCounts: [5, 12, 6, 12, 6, 6] }
    ]);
    expect(contract.pintoLastInning).toContain(LAST_INNING_RULE);
  });

  test("supports arrow, Home, and End keyboard navigation with correct ARIA state", async ({ page }) => {
    await openRules(page);
    const responsibilitiesTab = page.getByTestId("rules-tab-umpire-responsibilities");
    await responsibilitiesTab.focus();
    await responsibilitiesTab.press("ArrowRight");
    await expect(page.getByTestId("rules-tab-clinic")).toBeFocused();
    await expect(page.getByTestId("rules-tab-clinic")).toHaveAttribute("aria-selected", "true");
    await page.getByTestId("rules-tab-clinic").press("End");
    await expect(page.getByTestId("rules-tab-pinto")).toBeFocused();
    await expect(page.getByTestId("rules-panel-pinto")).toBeVisible();
    await page.getByTestId("rules-tab-pinto").press("Home");
    await expect(page.getByTestId("rules-tab-umpire-responsibilities")).toBeFocused();
    await expect(page.getByTestId("rules-panel-umpire-responsibilities")).toBeVisible();
  });

  for (const [name, viewport] of [
    ["desktop", { width: 1280, height: 900 }],
    ["mobile portrait", { width: 390, height: 844 }],
    ["phone landscape", { width: 844, height: 390 }],
    ["tablet portrait", { width: 768, height: 1024 }]
  ]) {
    test(`keeps Responsibilities readable without horizontal overflow on ${name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await openRules(page, "umpire");
      const geometry = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        document: document.documentElement.scrollWidth,
        tabs: Array.from(document.querySelectorAll(".rules-tab")).map(tab => tab.getBoundingClientRect().height),
        images: Array.from(document.querySelectorAll(".responsibilities-signal img")).map(image => ({
          width: image.getBoundingClientRect().width,
          clipped: image.getBoundingClientRect().right > document.documentElement.clientWidth + 1
        }))
      }));
      expect(geometry.document).toBeLessThanOrEqual(geometry.viewport + 1);
      expect(geometry.tabs.every(height => height >= 44)).toBeTruthy();
      expect(geometry.images.every(image => image.width >= 150 && !image.clipped)).toBeTruthy();
    });
  }

  test("does not add a Quick Start Guide asset, tab, navigation item, or link", async ({ page }) => {
    await openRules(page);
    await expect(page.getByText(/Quick Start Guide/i)).toHaveCount(0);
    await expect(page.locator('[href*="quick-start" i], [data-page*="quick-start" i]')).toHaveCount(0);
  });
});
