// js/services/scheduleImportService.js

window.scheduleImportService = (() => {
  const REQUIRED_FIELDS = [
    "date",
    "time"
  ];

  const SUPPORTED_FIELDS = [
    ...REQUIRED_FIELDS,
    "awayTeam",
    "homeTeam",
    "locationComplex",
    "locationField",
    "field",
    "locationName",
    "matchupDescription",
    "sport",
    "officialsRequested",
    "level",
    "canonicalLevel",
    "levelAlias",
    "displayLevel",
    "externalGameId", "timezone", "lifecycleStatus", "assignmentStatus", "notes",
    "gameType"
  ];

  const HEADER_ALIASES = {
    date: "date",
    gamedate: "date",

    time: "time",
    gametime: "time",

    away: "awayTeam",
    awayteam: "awayTeam",
    visitingteam: "awayTeam",
    visitor: "awayTeam",

    home: "homeTeam",
    hometeam: "homeTeam",

    locationcomplex: "locationComplex",
    complex: "locationComplex",
    venue: "locationComplex",
    locationfield: "locationField",
    field: "field",
    location: "locationComplex",
    locationname: "locationName",
    locationtext: "locationName",
    matchup: "matchupDescription",
    matchupdescription: "matchupDescription",
    sport: "sport",
    officials: "officialsRequested",
    officialsrequested: "officialsRequested",
    level: "level",
    agelevel: "level",
    canonicallevel: "canonicalLevel",
    lakeshorealias: "levelAlias",
    levelalias: "levelAlias",
    displaylevel: "displayLevel",
    externalgameid: "externalGameId",
    timezone: "timezone",
    lifecyclestatus: "lifecycleStatus",
    initialassignmentstatus: "assignmentStatus",
    notes: "notes",

    type: "gameType",
    gametype: "gameType"
  };

  function normalizeHeader(value = "") {
    const key = String(value)
      .replace(/^\uFEFF/, "")
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, "");

    return HEADER_ALIASES[key] || null;
  }

  function parseLine(line = "") {
    const values = [];
    let value = "";
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      if (ch === '"') {
        if (insideQuotes && line[i + 1] === '"') {
          value += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
        continue;
      }

      if (ch === "," && !insideQuotes) {
        values.push(value.trim());
        value = "";
        continue;
      }

      value += ch;
    }

    values.push(value.trim());

    return values;
  }

  function parse(csvText = "") {
    if (!csvText.trim()) {
      return {
        headers: [],
        rows: []
      };
    }

    const lines = csvText
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .filter(line => line.trim());

    if (!lines.length) {
      return {
        headers: [],
        rows: []
      };
    }

    const headers = parseLine(lines[0]).map((header, index) => ({
      index,
      raw: header,
      normalized: normalizeHeader(header)
    }));

    const rows = lines.slice(1).map((line, rowIndex) => {
      const values = parseLine(line);
      const data = {};

      headers.forEach(header => {
        if (!header.normalized) return;
        if (!SUPPORTED_FIELDS.includes(header.normalized)) return;

        data[header.normalized] =
          values[header.index] !== undefined
            ? values[header.index].trim()
            : "";
      });

      return {
        rowNumber: rowIndex + 2,
        data
      };
    });

    return {
      headers,
      rows
    };
  }

  function getMissingHeaders(headers) {
    const available = new Set(
      headers
        .map(h => h.normalized)
        .filter(Boolean)
    );

    return REQUIRED_FIELDS.filter(
      field => !available.has(field)
    );
  }

  function normalizeGame(data = {}) {
    const requestedOfficials = Number.parseInt(String(data.officialsRequested || ""), 10);
    const requestedGameType = Number.isInteger(requestedOfficials) && requestedOfficials > 0
      ? ({ 1: "single", 2: "twoMan", 3: "threeMan", 4: "fourMan" }[requestedOfficials] || String(data.gameType || "single"))
      : String(data.gameType || "single").trim() || "single";
    const normalized = {
      date: String(data.date || "").trim(),
      time: String(data.time || "").trim(),
      awayTeam: String(data.awayTeam || "").trim(),
      homeTeam: String(data.homeTeam || "").trim(),
      gameType: requestedGameType
    };
    if (Object.hasOwn(data, "matchupDescription")) normalized.matchupDescription = String(data.matchupDescription || "").trim();
    if (Object.hasOwn(data, "sport")) normalized.sport = String(data.sport || "").trim();
    if (Object.hasOwn(data, "locationName")) normalized.locationName = String(data.locationName || "").trim();
    ["externalGameId", "timezone", "lifecycleStatus", "assignmentStatus", "notes"].forEach(field => {
      if (Object.hasOwn(data, field)) normalized[field] = String(data[field] || "").trim();
    });
    if (Object.hasOwn(data, "locationComplex") || Object.hasOwn(data, "locationField") || Object.hasOwn(data, "field")) {
      normalized.locationComplex = String(data.locationComplex || "").trim();
      normalized.locationField = String(data.locationField || data.field || "").trim();
      normalized.field = normalized.locationField;
    }
    const levelSource = String(data.canonicalLevel || data.level || data.levelAlias || data.displayLevel || "").trim();
    if (levelSource) {
      const displayCanonical = levelSource.includes("-") ? levelSource.split("-")[0].trim() : levelSource;
      normalized.level = levelTerminologyService.canonicalize(displayCanonical);
      normalized.levelSource = levelSource;
    }
    return normalized;
  }

  function validateRow(row) {
    const game = normalizeGame(row.data);
    const errors = [];

    REQUIRED_FIELDS.forEach(field => {
      if (!game[field]) {
        errors.push({
          row: row.rowNumber,
          field,
          message: `Missing ${field}.`
        });
      }
    });

    if (!game.matchupDescription && !game.awayTeam && !game.homeTeam) {
      errors.push({
        row: row.rowNumber,
        field: "matchupDescription",
        message: "Enter a matchup description or at least one participant name."
      });
    }

    const suppliedLevelField = ["level", "canonicalLevel", "levelAlias", "displayLevel"].some(field => Object.hasOwn(row.data, field));
    if (suppliedLevelField && !game.level) {
      errors.push({ row: row.rowNumber, field: "level", message: "Missing canonical or recognized alias level." });
    } else if (game.level && !settings.levels.includes(game.level)) {
      errors.push({ row: row.rowNumber, field: "level", message: `Unknown level: ${game.levelSource || game.level}.` });
    }
    delete game.levelSource;

    if (
      game.awayTeam &&
      game.homeTeam &&
      game.awayTeam.toLowerCase() ===
        game.homeTeam.toLowerCase()
    ) {
      errors.push({
        row: row.rowNumber,
        field: "homeTeam",
        message: "Away team and home team must be different."
      });
    }

    return {
      game,
      errors
    };
  }

  function preview(csvText = "") {
    const parsed = parse(csvText);

    const missingHeaders = getMissingHeaders(parsed.headers);

    const errors = missingHeaders.map(field => ({
      row: 1,
      field,
      message: `Missing required header: ${field}.`
    }));

    const games = [];
    let invalidRows = 0;

    if (!missingHeaders.length) {
      parsed.rows.forEach(row => {
        const result = validateRow(row);

        if (result.errors.length) {
          invalidRows++;
          errors.push(...result.errors);
        } else {
          games.push(result.game);
        }
      });
    } else {
      invalidRows = parsed.rows.length;
    }

    return {
      success: errors.length === 0,
      totalRows: parsed.rows.length,
      validRows: games.length,
      invalidRows,
      games,
      errors
    };
  }

  return {
    parse,
    preview
  };
})();
