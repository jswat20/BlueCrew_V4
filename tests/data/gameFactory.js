export function buildGame(overrides = {}) {
  const timestamp = Date.now();

  return {
    date: new Date().toISOString().split("T")[0],
    time: "6:00 PM",
    field: "Field 1",
    level: "12U",
    homeTeam: `QA Home ${timestamp}`,
    awayTeam: `QA Away ${timestamp}`,
    gameType: "single",
    ...overrides
  };
}