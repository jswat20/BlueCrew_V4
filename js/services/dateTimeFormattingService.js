const dateTimeFormattingService = (() => {
  function formatDateShort(value, fallback = "—") {
    const text = String(value || "").trim();
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return fallback;
    return `${match[2]}/${match[3]}/${match[1].slice(-2)}`;
  }

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

  function formatDayDate(value, fallback = "—") {
    const text = String(value || "").trim();
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return fallback;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    if (Number.isNaN(date.getTime())) return fallback;
    return `${date.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })}, ${Number(match[2])}/${Number(match[3])}/${match[1].slice(-2)}`;
  }

  function toSortableDateTime(dateValue, timeValue) {
    const date = String(dateValue || "").trim();
    const time = String(timeValue || "").trim();
    const twelve = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    const twentyFour = time.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    let hour = 0;
    let minute = 0;
    if (twelve) {
      hour = Number(twelve[1]) % 12 + (twelve[3].toUpperCase() === "PM" ? 12 : 0);
      minute = Number(twelve[2]);
    } else if (twentyFour) {
      hour = Number(twentyFour[1]);
      minute = Number(twentyFour[2]);
    }
    const parsed = new Date(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`);
    return Number.isNaN(parsed.getTime()) ? Number.MAX_SAFE_INTEGER : parsed.getTime();
  }
  return { formatDateShort, formatDayDate, formatTime12Hour, toSortableDateTime };
})();
