const { test, expect } = require("@playwright/test");

const SOURCE_URL = "https://cdn2.sportngin.com/attachments/document/60a0-3547856/LSYB_Playing_Rules_3-17-2026__1_.pdf";
const COOP_NOTICE = "The Lake Shore playing rules will be in effect for all in-house games. Games between Lake Shore teams and Co-Op teams will be governed by the Co-Op rules and Lake Shore Rule Extensions, Additions, and Exceptions will not apply.";
const LAST_INNING_RULE = "When the time limit is approaching, a “Last Inning” may be declared if both managers agree before the start of the top of that inning.";

async function openRules(page, role = "admin") {
  await page.goto("/");
  await page.evaluate(selectedRole => {
    selectedRole === "umpire" ? authService.loginAsUmpire() : authService.loginAsAdmin();
    renderPage("rules-and-regulations");
  }, role);
}

test.describe("Rules & Regulations", () => {
  test("is available in administrator and umpire navigation", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("nav-rules-and-regulations")).toBeVisible();

    await page.getByTestId("role-umpire").click();
    await expect(page.getByTestId("nav-rules-and-regulations")).toBeVisible();
    await page.getByTestId("nav-rules-and-regulations").click();
    await expect(page.getByTestId("rules-and-regulations-content")).toBeVisible();
  });

  test("opens Clinic by default with complete section structure and source metadata", async ({ page }) => {
    await openRules(page);

    await expect(page.getByTestId("page-title")).toHaveText("Rules & Regulations");
    await expect(page.getByTestId("rules-panel-clinic")).toBeVisible();
    await expect(page.getByTestId("rules-tab-clinic")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("rules-panel-clinic").getByText("Coach Pitch", { exact: true })).toBeVisible();
    await expect(page.getByTestId("rules-coop-notice")).toContainText(COOP_NOTICE);
    await expect(page.locator(".rules-section")).toHaveCount(6);
    await expect(page.locator(".rules-source-note")).toHaveText("Source: Lake Shore Youth Baseball Playing Rules, revised March 19, 2026.");

    const source = page.getByTestId("rules-source-link");
    await expect(source).toHaveAttribute("href", SOURCE_URL);
    await expect(source).toHaveAttribute("target", "_blank");
    await expect(source).toHaveAttribute("rel", /noopener/);
    await expect(source).toHaveAttribute("rel", /noreferrer/);
  });

  test("switches to Pinto without changing routes and preserves the exact Last Inning rule", async ({ page }) => {
    await openRules(page, "umpire");
    await page.getByTestId("rules-tab-pinto").click();

    await expect(page.locator("body")).toHaveAttribute("data-page", "rules-and-regulations");
    await expect(page.getByTestId("rules-panel-pinto")).toBeVisible();
    await expect(page.getByTestId("rules-panel-pinto").getByText("Kid Pitch", { exact: true })).toBeVisible();
    await expect(page.getByTestId("rules-tab-pinto")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("rules-panel-pinto")).toContainText(LAST_INNING_RULE);
    await expect(page.locator(".rules-section")).toHaveCount(6);
  });

  test("keeps the complete Clinic and Pinto rules in the shared data source", async ({ page }) => {
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

  test("is readable without horizontal overflow on a mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openRules(page, "umpire");
    await page.getByTestId("rules-tab-pinto").click();

    const geometry = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      tabs: Array.from(document.querySelectorAll(".rules-tab")).map(tab => tab.getBoundingClientRect().height)
    }));
    expect(geometry.document).toBeLessThanOrEqual(geometry.viewport + 1);
    expect(geometry.tabs.every(height => height >= 44)).toBeTruthy();
  });
});
