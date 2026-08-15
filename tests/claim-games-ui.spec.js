import { test, expect } from "./fixtures/app.fixture.js";

test.describe("Claim Games UI", () => {
  test("shows an empty state when there are no claimable games", async ({ app }) => {
    await app.page.evaluate(() => {
      const accountResult = accountService.createAccount({
        firstName: "UI",
        lastName: "Tester",
        email: "ui@example.com",
        password: "password123"
      });

      const crew = crewService.getAll()[0];

      accountService.approveAccount(accountResult.data.id);

      accountService.updateAccount(accountResult.data.id, {
        crewId: crew.id
      });

      loginService.login("ui@example.com", "password123");
    });

await app.page.evaluate(() => {
  authService.loginAsUmpire();
  renderPage("claim-games");
});

    await expect(
      app.page.getByTestId("claim-games-empty")
    ).toBeVisible();

    await expect(
      app.page.getByTestId("page-title")
    ).toHaveText("Claim Games");

    await expect(
      app.page.getByTestId("page-subtitle")
    ).toHaveText(
      "Review and claim available assignments."
    );
  });

  test("shows claimable games", async ({ app }) => {
    await app.page.evaluate(() => {
      const accountResult = accountService.createAccount({
        firstName: "Claim",
        lastName: "UI",
        email: "claimui@example.com",
        password: "password123"
      });

const crew = crewService.getAll()[1];

      accountService.approveAccount(accountResult.data.id);

      accountService.updateAccount(accountResult.data.id, {
        crewId: crew.id
      });

      loginService.login(
        "claimui@example.com",
        "password123"
      );

      const result = gameService.create({
        date: "2099-05-01",
        time: "6:30 PM",
        field: "Field 5",
        level: "12U",
        homeTeam: "Home Team",
        awayTeam: "Away Team",
        gameType: "single"
      });

      authService.loginAsAdmin();
      assignmentService.openForClaims(result.data.id);
    });

await app.page.evaluate(() => {
  authService.useAuthenticatedAccount(loginService.getCurrentAccount());
  renderPage("claim-games");
});
    await expect(
      app.page.getByTestId("claim-games")
    ).toBeVisible();

    await expect(app.page.getByRole("columnheader", { name: "Teams" })).toHaveCount(0);
    await expect(app.page.getByText("Away Team @ Home Team")).toHaveCount(0);

    await expect(
app.page.locator('button[data-testid^="claim-game-"]')
    ).toBeVisible();

    await expect(app.page.getByRole("columnheader", { name: "Location" })).toBeVisible();
    await expect(app.page.getByRole("columnheader", { name: "Status", exact: true })).toBeVisible();
    await expect(app.page.getByText(/0 \/ \d+ filled/)).toBeVisible();
    await app.page.locator('button[data-testid^="claim-game-"]').click();
    await expect(app.page.getByTestId("game-hub")).toBeVisible();
    await app.page.evaluate(() => renderPage("my-claims"));
    await expect(app.page.getByTestId("my-claims-empty")).toBeVisible();
  });

  test("keeps only weekday, multi-select level, and location browsing filters", async ({ app }) => {
    await app.loginAsApprovedUmpire();
    await app.page.evaluate(() => {
      const account = loginService.getCurrentAccount();
      const create = ({ id, date, level, locationComplex, locationField }) => {
        const game = gameService.create({ id, date, time: "18:30", level, locationComplex, locationField, field: locationField, homeTeam: "Home", awayTeam: "Away", gameType: "single" }).data;
        assignmentService.openForClaims(game.id);
      };
      authService.loginAsAdmin();
      create({ id: "claim-filter-10u", date: "2099-05-04", level: "10U", locationComplex: "North Complex", locationField: "North Complex - Field 1" });
      create({ id: "claim-filter-8u", date: "2099-05-05", level: "8U", locationComplex: "South Complex", locationField: "Field 2" });
      authService.useAuthenticatedAccount(account);
      renderPage("claim-games");
    });
    const filters = app.page.locator(".game-list-filters");
    await expect(filters.getByRole("group", { name: "Weekday" })).toBeVisible();
    await expect(filters.getByRole("group", { name: "Level" })).toBeVisible();
    await expect(filters.getByLabel("Location")).toBeVisible();
    await expect(filters.getByLabel(/From date|To date|From time|To time|Field/)).toHaveCount(0);
    await filters.getByRole("checkbox", { name: "10U" }).check();
    await filters.getByRole("checkbox", { name: "8U" }).check();
    await expect(app.page.locator('[data-testid^="claim-game-row-"]')).toHaveCount(2);
    await filters.getByRole("checkbox", { name: "Monday" }).check();
    await expect(app.page.locator('[data-testid^="claim-game-row-"]')).toHaveCount(1);
    await expect(app.page.locator('[data-testid^="claim-game-row-"]').first()).toContainText("Field 1");
    await expect(app.page.locator('[data-testid^="claim-game-row-"]').first()).not.toContainText("North Complex - Field 1");
    await filters.getByLabel("Location").selectOption("North Complex");
    await expect(filters.locator("summary")).toContainText("4 active");
    const desktopLayout = await filters.evaluate(element => {
      const weekday = element.querySelector("fieldset");
      const level = element.querySelectorAll("fieldset")[1];
      const actions = element.querySelector(".game-list-filter-actions");
      return { weekdayTop: weekday.getBoundingClientRect().top, levelTop: level.getBoundingClientRect().top, actionsLeft: actions.getBoundingClientRect().left, optionsRight: element.querySelector(".game-list-filter-options").getBoundingClientRect().right };
    });
    expect(desktopLayout.levelTop).toBeGreaterThan(desktopLayout.weekdayTop);
    expect(desktopLayout.actionsLeft).toBeGreaterThanOrEqual(desktopLayout.optionsRight);
    await expect(filters.locator(".game-list-filter-actions")).toHaveCSS("gap", "24px");
  });
});
