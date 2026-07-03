// tests/factories/gameFactory.js

let counter = 1;

export class GameFactory {
  static create(overrides = {}) {
    const id = counter++;

    return {
      homeTeam: `Home ${id}`,
      awayTeam: `Away ${id}`,
      gameDate: "2026-07-15",
      gameTime: "18:00",
      field: `Field ${id}`,
      gameType: "Baseball",

      ...overrides
    };
  }

  static reset() {
    counter = 1;
  }
}