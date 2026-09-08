const { test, expect } = require("@playwright/test");

const CANONICAL_KEY = "slate_report_presets";
const LEGACY_KEY = "bluecrew_report_presets";

function preset(id, name, level = "12U") {
  return {
    id,
    name,
    filters: {
      startDate: "2028-06-01",
      endDate: "2028-06-30",
      status: "approved",
      crewId: "crew-1",
      level,
      field: "North"
    },
    createdAt: "2028-05-01T12:00:00.000Z",
    updatedAt: "2028-05-02T12:00:00.000Z"
  };
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
});

test("fresh browser saves only to the canonical Slate key", async ({ page }) => {
  const result = await page.evaluate(({ canonicalKey, legacyKey }) => {
    const saved = reportPresetService.save({
      name: "Fresh Slate Preset",
      filters: { level: "12U" }
    });
    return {
      saved,
      canonical: localStorage.getItem(canonicalKey),
      legacy: localStorage.getItem(legacyKey)
    };
  }, { canonicalKey: CANONICAL_KEY, legacyKey: LEGACY_KEY });

  expect(result.saved.success).toBe(true);
  expect(JSON.parse(result.canonical)).toHaveLength(1);
  expect(result.legacy).toBeNull();
});

test("legacy-only browser silently copies forward and preserves legacy exactly", async ({ page }) => {
  const legacy = [preset("legacy-1", "Weekend 12U")];
  const rawLegacy = JSON.stringify(legacy);
  const result = await page.evaluate(({ legacyKey, canonicalKey, raw }) => {
    localStorage.setItem(legacyKey, raw);
    const active = reportPresetService.getAll();
    return {
      active,
      canonical: localStorage.getItem(canonicalKey),
      legacy: localStorage.getItem(legacyKey)
    };
  }, { legacyKey: LEGACY_KEY, canonicalKey: CANONICAL_KEY, raw: rawLegacy });

  expect(result.active).toEqual(legacy);
  expect(JSON.parse(result.canonical)).toEqual(legacy);
  expect(result.legacy).toBe(rawLegacy);
});

test("canonical-only browser reads without a legacy dependency", async ({ page }) => {
  const canonical = [preset("canonical-1", "Canonical")];
  const result = await page.evaluate(({ canonicalKey, value, legacyKey }) => {
    localStorage.setItem(canonicalKey, JSON.stringify(value));
    return {
      active: reportPresetService.getAll(),
      legacy: localStorage.getItem(legacyKey)
    };
  }, { canonicalKey: CANONICAL_KEY, legacyKey: LEGACY_KEY, value: canonical });

  expect(result.active).toEqual(canonical);
  expect(result.legacy).toBeNull();
});

test("valid canonical state wins over different valid legacy state", async ({ page }) => {
  const canonical = [preset("canonical-1", "Preset B")];
  const legacy = [preset("legacy-1", "Preset A")];
  const result = await page.evaluate(({ canonicalKey, legacyKey, canonicalValue, legacyValue }) => {
    localStorage.setItem(canonicalKey, JSON.stringify(canonicalValue));
    localStorage.setItem(legacyKey, JSON.stringify(legacyValue));
    return {
      active: reportPresetService.getAll(),
      legacy: JSON.parse(localStorage.getItem(legacyKey))
    };
  }, { canonicalKey: CANONICAL_KEY, legacyKey: LEGACY_KEY, canonicalValue: canonical, legacyValue: legacy });

  expect(result.active).toEqual(canonical);
  expect(result.legacy).toEqual(legacy);
});

test("valid canonical state ignores corrupt legacy state", async ({ page }) => {
  const canonical = [preset("canonical-1", "Canonical")];
  const result = await page.evaluate(({ canonicalKey, legacyKey, value }) => {
    localStorage.setItem(canonicalKey, JSON.stringify(value));
    localStorage.setItem(legacyKey, "{corrupt");
    return reportPresetService.getAll();
  }, { canonicalKey: CANONICAL_KEY, legacyKey: LEGACY_KEY, value: canonical });

  expect(result).toEqual(canonical);
});

test("corrupt canonical state falls back to valid legacy and repairs canonical", async ({ page }) => {
  const legacy = [preset("legacy-1", "Recovered")];
  const result = await page.evaluate(({ canonicalKey, legacyKey, value }) => {
    localStorage.setItem(canonicalKey, "not-json");
    localStorage.setItem(legacyKey, JSON.stringify(value));
    return {
      active: reportPresetService.getAll(),
      canonical: JSON.parse(localStorage.getItem(canonicalKey)),
      legacy: JSON.parse(localStorage.getItem(legacyKey))
    };
  }, { canonicalKey: CANONICAL_KEY, legacyKey: LEGACY_KEY, value: legacy });

  expect(result.active).toEqual(legacy);
  expect(result.canonical).toEqual(legacy);
  expect(result.legacy).toEqual(legacy);
});

test("both corrupt values fail safely without wiping unrelated storage", async ({ page }) => {
  const result = await page.evaluate(({ canonicalKey, legacyKey }) => {
    localStorage.setItem(canonicalKey, "not-json");
    localStorage.setItem(legacyKey, "also-not-json");
    localStorage.setItem("unrelated", "preserve-me");
    return {
      active: reportPresetService.getAll(),
      canonical: localStorage.getItem(canonicalKey),
      legacy: localStorage.getItem(legacyKey),
      unrelated: localStorage.getItem("unrelated")
    };
  }, { canonicalKey: CANONICAL_KEY, legacyKey: LEGACY_KEY });

  expect(result.active).toEqual([]);
  expect(result.canonical).toBe("not-json");
  expect(result.legacy).toBe("also-not-json");
  expect(result.unrelated).toBe("preserve-me");
});

test("copy-forward write failure still returns valid legacy presets", async ({ page }) => {
  const legacy = [preset("legacy-1", "Quota Safe")];
  const result = await page.evaluate(({ canonicalKey, legacyKey, legacyValue }) => {
    const values = new Map([[legacyKey, JSON.stringify(legacyValue)]]);
    const restrictedStorage = {
      getItem(key) { return values.has(key) ? values.get(key) : null; },
      setItem(key, value) {
        if (key === canonicalKey) throw new DOMException("Quota exceeded", "QuotaExceededError");
        values.set(key, value);
      },
      removeItem(key) { values.delete(key); }
    };
    repositoryProvider.use(createLocalStorageRepositoryFactory(restrictedStorage));
    return {
      active: reportPresetService.getAll(),
      canonical: restrictedStorage.getItem(canonicalKey),
      legacy: restrictedStorage.getItem(legacyKey)
    };
  }, { canonicalKey: CANONICAL_KEY, legacyKey: LEGACY_KEY, legacyValue: legacy });

  expect(result.active).toEqual(legacy);
  expect(result.canonical).toBeNull();
  expect(JSON.parse(result.legacy)).toEqual(legacy);
});

test("repeated initialization is idempotent and does not rewrite canonical", async ({ page }) => {
  const legacy = [preset("legacy-1", "Stable")];
  const result = await page.evaluate(({ canonicalKey, legacyKey, value }) => {
    localStorage.setItem(legacyKey, JSON.stringify(value));
    const first = reportPresetService.getAll();
    const firstCanonical = localStorage.getItem(canonicalKey);
    const second = reportPresetService.getAll();
    return {
      first,
      second,
      firstCanonical,
      secondCanonical: localStorage.getItem(canonicalKey)
    };
  }, { canonicalKey: CANONICAL_KEY, legacyKey: LEGACY_KEY, value: legacy });

  expect(result.first).toEqual(legacy);
  expect(result.second).toEqual(legacy);
  expect(result.secondCanonical).toBe(result.firstCanonical);
});

test("save after migration updates canonical and leaves rollback snapshot untouched", async ({ page }) => {
  const legacy = [preset("legacy-1", "Rollback Snapshot")];
  const rawLegacy = JSON.stringify(legacy);
  const result = await page.evaluate(({ canonicalKey, legacyKey, raw }) => {
    localStorage.setItem(legacyKey, raw);
    reportPresetService.getAll();
    const saved = reportPresetService.save({
      name: "Post Migration",
      filters: { level: "14U" }
    });
    return {
      saved,
      canonical: JSON.parse(localStorage.getItem(canonicalKey)),
      legacyRaw: localStorage.getItem(legacyKey),
      rollbackValue: JSON.parse(localStorage.getItem(legacyKey))
    };
  }, { canonicalKey: CANONICAL_KEY, legacyKey: LEGACY_KEY, raw: rawLegacy });

  expect(result.saved.success).toBe(true);
  expect(result.canonical).toHaveLength(2);
  expect(result.legacyRaw).toBe(rawLegacy);
  expect(result.rollbackValue).toEqual(legacy);
});

test("delete after migration updates canonical and preserves the legacy rollback snapshot", async ({ page }) => {
  const legacy = [preset("legacy-1", "Delete Forward")];
  const rawLegacy = JSON.stringify(legacy);
  const result = await page.evaluate(({ canonicalKey, legacyKey, raw }) => {
    localStorage.setItem(legacyKey, raw);
    reportPresetService.getAll();
    const removed = reportPresetService.remove("legacy-1");
    return {
      removed,
      canonical: JSON.parse(localStorage.getItem(canonicalKey)),
      legacy: localStorage.getItem(legacyKey)
    };
  }, { canonicalKey: CANONICAL_KEY, legacyKey: LEGACY_KEY, raw: rawLegacy });

  expect(result.removed.success).toBe(true);
  expect(result.canonical).toEqual([]);
  expect(result.legacy).toBe(rawLegacy);
});

test("logout leaves both report-preset keys and unrelated storage unchanged", async ({ page }) => {
  const canonical = [preset("canonical-1", "Canonical")];
  const legacy = [preset("legacy-1", "Legacy")];
  const result = await page.evaluate(({ canonicalKey, legacyKey, canonicalValue, legacyValue }) => {
    localStorage.setItem(canonicalKey, JSON.stringify(canonicalValue));
    localStorage.setItem(legacyKey, JSON.stringify(legacyValue));
    localStorage.setItem("unrelated", "preserve-me");
    loginService.logout();
    return {
      canonical: JSON.parse(localStorage.getItem(canonicalKey)),
      legacy: JSON.parse(localStorage.getItem(legacyKey)),
      unrelated: localStorage.getItem("unrelated")
    };
  }, { canonicalKey: CANONICAL_KEY, legacyKey: LEGACY_KEY, canonicalValue: canonical, legacyValue: legacy });

  expect(result.canonical).toEqual(canonical);
  expect(result.legacy).toEqual(legacy);
  expect(result.unrelated).toBe("preserve-me");
});

test("production-shaped legacy user migrates silently before first report read", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  const legacy = [preset("legacy-production-1", "Summer Schedule", "14U")];
  const rawLegacy = JSON.stringify(legacy);
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
    key: LEGACY_KEY,
    value: rawLegacy
  });

  await page.goto("/");
  const result = await page.evaluate(({ canonicalKey, legacyKey }) => ({
    active: reportPresetService.getAll(),
    canonical: localStorage.getItem(canonicalKey),
    legacy: localStorage.getItem(legacyKey),
    migrationPrompt: document.body.innerText.includes("migrat")
  }), { canonicalKey: CANONICAL_KEY, legacyKey: LEGACY_KEY });

  await page.evaluate(() => {
    authService.loginAsAdmin();
    document.body.dataset.role = "admin";
    renderPage("reports");
  });

  expect(result.active).toEqual(legacy);
  expect(JSON.parse(result.canonical)).toEqual(legacy);
  expect(result.legacy).toBe(rawLegacy);
  expect(result.migrationPrompt).toBe(false);
  await expect(page.getByTestId("reports-preset-select")).toContainText("Summer Schedule");
  expect(consoleErrors).toEqual([]);
  await context.close();
});
