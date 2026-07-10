// js/services/scheduleExportService.js

const scheduleExportService = (() => {
  const HEADERS = [
    "date",
    "time",
    "awayTeam",
    "homeTeam",
    "field",
    "level",
    "gameType"
  ];

  function escapeCsvValue(value) {
    if (value === null || value === undefined) {
      return "";
    }

    const text = String(value);

    if (!/[",\r\n]/.test(text)) {
      return text;
    }

    return `"${text.replace(/"/g, '""')}"`;
  }

  function normalizeGame(game = {}) {
    return {
      date: game.date || "",
      time: game.time || "",
      awayTeam: game.awayTeam || "",
      homeTeam: game.homeTeam || "",
      field: game.field || "",
      level: game.level || "",
      gameType: game.gameType || "single"
    };
  }

  function toCsv(games = []) {
    const sourceGames =
      Array.isArray(games) ? games : [];

    const rows = sourceGames.map(game => {
      const normalizedGame =
        normalizeGame(game);

      return HEADERS
        .map(header =>
          escapeCsvValue(normalizedGame[header])
        )
        .join(",");
    });

    return [
      HEADERS.join(","),
      ...rows
    ].join("\r\n");
  }

  function formatExportDate(date = new Date()) {
    return date
      .toISOString()
      .split("T")[0];
  }

  function createExport(games = [], options = {}) {
    const sourceGames =
      Array.isArray(games) ? games : [];

    const exportDate =
      options.date instanceof Date
        ? options.date
        : new Date();

    return {
      filename:
        `bluecrew-schedule-${formatExportDate(exportDate)}.csv`,

      csv: toCsv(sourceGames),

      count: sourceGames.length
    };
  }

  function getHeaders() {
    return [...HEADERS];
  }

  return {
    escapeCsvValue,
    normalizeGame,
    toCsv,
    createExport,
    getHeaders
  };
})();