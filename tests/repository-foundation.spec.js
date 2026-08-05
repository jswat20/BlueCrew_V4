const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("accountService preserves the existing localStorage key", async ({ page }) => {
  const result = await page.evaluate(() => {
    localStorage.removeItem(REPOSITORY_STORAGE_KEYS.accounts);
    repositoryProvider.useLocalStorage();
    const created = accountService.createAccount({
      firstName: "Local",
      lastName: "Repository",
      email: "local-repository@example.com",
      phone: "555-0100"
    });
    return {
      created,
      stored: JSON.parse(localStorage.getItem("bluecrew_accounts") || "[]")
    };
  });

  expect(result.created.success).toBe(true);
  expect(result.stored).toHaveLength(1);
  expect(result.stored[0].email).toBe("local-repository@example.com");
});

test("services can use isolated in-memory persistence", async ({ page }) => {
  const result = await page.evaluate(() => {
    localStorage.removeItem("bluecrew_accounts");
    repositoryProvider.useMemory();
    const created = accountService.createAccount({
      firstName: "Memory",
      lastName: "Repository",
      email: "memory-repository@example.com",
      phone: "555-0101"
    });
    return {
      created,
      accounts: accountService.getAll(),
      localValue: localStorage.getItem("bluecrew_accounts")
    };
  });

  expect(result.created.success).toBe(true);
  expect(result.accounts).toHaveLength(1);
  expect(result.accounts[0].email).toBe("memory-repository@example.com");
  expect(result.localValue).toBeNull();
});

test("in-memory repository instances do not leak state", async ({ page }) => {
  const result = await page.evaluate(() => {
    const first = createMemoryRepositoryFactory();
    const second = createMemoryRepositoryFactory();
    first.getRepository("notifications").write([{ id: "first" }]);
    return {
      first: first.getRepository("notifications").read(),
      second: second.getRepository("notifications").read()
    };
  });

  expect(result.first).toEqual([{ id: "first" }]);
  expect(result.second).toBeNull();
});

test("all compatibility storage keys remain unchanged", async ({ page }) => {
  const keys = await page.evaluate(() => REPOSITORY_STORAGE_KEYS);

  expect(keys).toEqual({
    accounts: "bluecrew_accounts",
    activity: "bluecrew_activity",
    crew: "bluecrew-crew-v2",
    games: "bluecrew-games-v2",
    legacyDatabase: "bluecrewDatabase_v1",
    legacyGames: "bluecrew_games",
    locations: "bluecrew_location_catalog",
    notifications: "bluecrew_notifications",
    reportPresets: "bluecrew_report_presets",
    session: "bluecrew_session"
  });
});

test("game and crew persistence use the selected repository factory", async ({ page }) => {
  const result = await page.evaluate(() => {
    localStorage.removeItem("bluecrew-games-v2");
    localStorage.removeItem("bluecrew-crew-v2");
    repositoryProvider.useMemory();
    games = [{ id: "memory-game" }];
    crew = [{ id: "memory-crew" }];
    saveGames();
    saveCrew();
    return {
      games: repositoryProvider.get("games").read(),
      crew: repositoryProvider.get("crew").read(),
      localGames: localStorage.getItem("bluecrew-games-v2"),
      localCrew: localStorage.getItem("bluecrew-crew-v2")
    };
  });

  expect(result.games).toEqual([{ id: "memory-game" }]);
  expect(result.crew).toEqual([{ id: "memory-crew" }]);
  expect(result.localGames).toBeNull();
  expect(result.localCrew).toBeNull();
});

test("service APIs remain usable without repository access from UI", async ({ page }) => {
  const result = await page.evaluate(() => {
    repositoryProvider.useMemory({
      accounts: [{
        id: "approved-account",
        firstName: "Approved",
        lastName: "Umpire",
        email: "approved@example.com",
        role: "umpire",
        status: "approved"
      }]
    });
    const login = loginService.login("approved@example.com");
    notificationService.create({ title: "Repository boundary", message: "Visible through the service." });
    activityService.log({ type: "test", action: "repository_boundary" });
    return {
      login,
      session: loginService.getCurrentSession(),
      notifications: notificationService.getAll(),
      activity: activityService.getRecent(1)
    };
  });

  expect(result.login.success).toBe(true);
  expect(result.session.accountId).toBe("approved-account");
  expect(result.notifications).toHaveLength(1);
  expect(result.activity).toHaveLength(1);
});

test("presentation modules do not access repositories directly", () => {
  const roots = ["components", path.join("js", "ui")];
  const files = [];
  const visit = directory => {
    fs.readdirSync(directory, { withFileTypes: true }).forEach(entry => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(fullPath);
      else if (entry.isFile() && entry.name.endsWith(".js")) files.push(fullPath);
    });
  };
  roots.forEach(visit);

  const violations = files.filter(file =>
    /repositoryProvider|createMemoryRepositoryFactory|createLocalStorageRepositoryFactory/.test(
      fs.readFileSync(file, "utf8")
    )
  );
  expect(violations).toEqual([]);
});
