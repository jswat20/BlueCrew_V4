const dateTimeFormattingService = (() => {
  function formatTime12Hour(value, fallback = "—") {
    const text = String(value || "").trim();
    if (!text) return fallback;
    const twelve = text.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (twelve) return `${Number(twelve[1])}:${twelve[2]} ${twelve[3].toUpperCase()}`;
    const twentyFour = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!twentyFour || Number(twentyFour[1]) > 23) return fallback;
    const hour = Number(twentyFour[1]);
    return `${hour % 12 || 12}:${twentyFour[2]} ${hour >= 12 ? "PM" : "AM"}`;
  }
  return { formatTime12Hour };
})();
