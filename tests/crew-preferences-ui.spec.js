const { test, expect } = require("@playwright/test");

async function seedCrew(page) {
  await page.goto("/");

  await page.evaluate(() => {
    crew.splice(
      0,
      crew.length,
      {
        id: 1,
        firstName: "Alex",
        lastName: "Official",
        email: "alex@test.com",
        phone: "",
        active: true,
        notes: "",
        levels: ["10U"],
        preferences: {
          preferredCrewIds: ["2"],
          avoidedCrewIds: [],
          preferredLevels: ["12U"]
        }
      },
      {
        id: 2,
        firstName: "Blake",
        lastName: "Partner",
        email: "blake@test.com",
        phone: "",
        active: true,
        notes: "",
        levels: ["10U", "12U"]
      },
      {
        id: 3,
        firstName: "Casey",
        lastName: "Partner",
        email: "casey@test.com",
        phone: "",
        active: true,
        notes: "",
        levels: ["12U", "14U"]
      }
    );

    saveCrew();
    renderPage("crew");
    openEditCrewDrawer(1);
  });
}

test.describe("Crew Preference Management UI", () => {
  test.beforeEach(async ({ page }) => {
    await seedCrew(page);
  });

  test("renders existing preferences and excludes self", async ({ page }) => {
    const preferredBlake = page.locator(
      '.crew-preferred-checkbox[value="2"]'
    );

    const preferredAlex = page.locator(
      '.crew-preferred-checkbox[value="1"]'
    );

    const preferredLevel = page.locator(
      '.crew-preferred-level-checkbox[value="12U"]'
    );

    await expect(preferredBlake).toBeChecked();
    await expect(preferredLevel).toBeChecked();
    await expect(preferredAlex).toHaveCount(0);
  });

  test("saves partner and level preferences", async ({ page }) => {
    await page
      .locator('.crew-preferred-checkbox[value="2"]')
      .uncheck();

    await page
      .locator('.crew-preferred-checkbox[value="3"]')
      .check();

    await page
      .locator('.crew-avoided-checkbox[value="2"]')
      .check();

    await page
      .locator('.crew-preferred-level-checkbox[value="12U"]')
      .uncheck();

    await page
      .locator('.crew-preferred-level-checkbox[value="14U"]')
      .check();

    await page
      .getByRole("button", { name: "Save Changes" })
      .click();

    const preferences = await page.evaluate(() =>
      crewService.getPreferences(1)
    );

    expect(preferences).toEqual({
      preferredCrewIds: ["3"],
      avoidedCrewIds: ["2"],
      preferredLevels: ["14U"]
    });
  });

  test("preferences persist after reopening the drawer", async ({ page }) => {
    await page
      .locator('.crew-preferred-checkbox[value="3"]')
      .check();

    await page
      .locator('.crew-preferred-level-checkbox[value="14U"]')
      .check();

    await page
      .getByRole("button", { name: "Save Changes" })
      .click();

    await page.evaluate(() => {
      openEditCrewDrawer(1);
    });

    await expect(
      page.locator('.crew-preferred-checkbox[value="3"]')
    ).toBeChecked();

    await expect(
      page.locator('.crew-preferred-level-checkbox[value="14U"]')
    ).toBeChecked();
  });

  test("crew without stored preferences renders safely", async ({ page }) => {
    await page.evaluate(() => {
      const member = crewService.getById(3);
      delete member.preferences;

      closeCrewDrawer();
      openEditCrewDrawer(3);
    });

    await expect(
      page.locator('.crew-preferred-checkbox[value="1"]')
    ).not.toBeChecked();

    await expect(
      page.locator('.crew-avoided-checkbox[value="2"]')
    ).not.toBeChecked();

    await expect(
      page.locator('.crew-preferred-level-checkbox[value="14U"]')
    ).not.toBeChecked();
  });
});