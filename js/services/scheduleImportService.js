// js/services/scheduleImportService.js

window.scheduleImportService = (() => {
  const REQUIRED_FIELDS = [
    "date",
    "time",
    "awayTeam",
    "homeTeam"
  ];

  const SUPPORTED_FIELDS = [
    ...REQUIRED_FIELDS,
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
    return {
      date: String(data.date || "").trim(),
      time: String(data.time || "").trim(),
      awayTeam: String(data.awayTeam || "").trim(),
      homeTeam: String(data.homeTeam || "").trim(),
      gameType:
        String(data.gameType || "single").trim() || "single"
    };
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