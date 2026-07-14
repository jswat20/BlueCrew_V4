// js/services/reportPresetService.js

const reportPresetService = (() => {
  const STORAGE_KEY =
    "bluecrew_report_presets";

  const FILTER_KEYS = [
    "startDate",
    "endDate",
    "status",
    "crewId",
    "level",
    "field"
  ];

  function getAll() {
    const stored = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ||
        "[]"
    );

    return Array.isArray(stored)
      ? stored
          .map(normalizePreset)
          .sort((a, b) =>
            a.name.localeCompare(b.name)
          )
      : [];
  }

  function getById(presetId) {
    return (
      getAll().find(
        preset =>
          String(preset.id) ===
          String(presetId)
      ) || null
    );
  }

  function normalizeFilters(filters = {}) {
    return FILTER_KEYS.reduce(
      (result, key) => {
        result[key] = String(
          filters[key] || ""
        );

        return result;
      },
      {}
    );
  }

  function normalizePreset(preset = {}) {
    return {
      id: String(preset.id || ""),
      name: String(preset.name || ""),
      filters: normalizeFilters(
        preset.filters
      ),
      createdAt: String(
        preset.createdAt || ""
      ),
      updatedAt: String(
        preset.updatedAt ||
        preset.createdAt ||
        ""
      )
    };
  }

  function save({
    id = "",
    name = "",
    filters = {}
  } = {}) {
    const normalizedName =
      String(name || "").trim();

    if (!normalizedName) {
      return {
        success: false,
        message:
          "Preset name is required.",
        data: null
      };
    }

    const presets = getAll();

    const duplicate = presets.find(
      preset =>
        preset.name.toLowerCase() ===
          normalizedName.toLowerCase() &&
        String(preset.id) !== String(id)
    );

    if (duplicate) {
      return {
        success: false,
        message:
          "A report preset with this name already exists.",
        data: duplicate
      };
    }

    const now =
      new Date().toISOString();

    const existing = presets.find(
      preset =>
        String(preset.id) === String(id)
    );

    let savedPreset;

    if (existing) {
      existing.name = normalizedName;
      existing.filters =
        normalizeFilters(filters);
      existing.updatedAt = now;

      savedPreset = existing;
    } else {
      savedPreset = {
        id: crypto.randomUUID(),
        name: normalizedName,
        filters:
          normalizeFilters(filters),
        createdAt: now,
        updatedAt: now
      };

      presets.push(savedPreset);
    }

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(presets)
    );

    return {
      success: true,
      message: existing
        ? "Report preset updated."
        : "Report preset saved.",
      data: normalizePreset(savedPreset)
    };
  }

  function remove(presetId) {
    const presets = getAll();

    const nextPresets = presets.filter(
      preset =>
        String(preset.id) !==
        String(presetId)
    );

    if (
      nextPresets.length === presets.length
    ) {
      return {
        success: false,
        message:
          "Report preset not found.",
        data: null
      };
    }

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(nextPresets)
    );

    return {
      success: true,
      message: "Report preset deleted.",
      data: {
        id: String(presetId)
      }
    };
  }

  return {
    getAll,
    getById,
    save,
    remove
  };
})();
