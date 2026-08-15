// tests/helpers/GameFactory.js

let counter = 1;

export function buildGame(overrides = {}) {
  const id = counter++;
  const now = Date.now();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);

  return {
    date: futureDate.toISOString().split("T")[0],
    time: "6:00 PM",
    field: "Field 1",
    level: "12U",
    gameType: "single",

    homeTeam: `QA Home ${now}-${id}`,
    awayTeam: `QA Away ${now}-${id}`,

    ...overrides
  };
}

export function resetGameFactory() {
  counter = 1;
}
