
const demoGameData = (() => {
  const TEAMS = [
    "Orioles", "Yankees", "Mets", "Phillies",
    "Blue Jays", "Red Sox", "Braves", "Nationals",
    "Guardians", "Tigers", "Cubs", "Cardinals",
    "Rays", "Twins", "Dodgers", "Giants",
    "Pirates", "Rangers", "Astros", "Mariners",
    "Brewers", "Royals", "Athletics", "Padres"
  ];

  const FIELDS = [
    "East Field 1",
    "East Field 2",
    "West Field 1",
    "West Field 2",
    "Central Complex A",
    "Central Complex B",
    "Riverside Park",
    "Memorial Field"
  ];

  const LEVELS = [
    "8U",
    "10U",
    "12U",
    "14U",
    "16U",
    "18U"
  ];

  const TIMES = [
    "9:00 AM",
    "11:30 AM",
    "1:00 PM",
    "3:30 PM",
    "6:00 PM",
    "7:30 PM"
  ];

  function gameTypeForLevel(level) {
    return level === "8U"
      ? "single"
      : "twoMan";
  }

  function buildGame(index) {
    const number =
      String(index + 1).padStart(3, "0");

    /*
     * Produces:
     * - 36 historical games
     * - games today and tomorrow
     * - a dense upcoming month
     * - later schedule depth
     */
    const dateOffset =
      index < 36
        ? index - 36
        : Math.floor((index - 36) / 3);

    const level =
      LEVELS[index % LEVELS.length];

    const awayTeam =
      TEAMS[index % TEAMS.length];

    let homeTeam =
      TEAMS[(index * 5 + 3) % TEAMS.length];

    if (homeTeam === awayTeam) {
      homeTeam =
        TEAMS[(index + 7) % TEAMS.length];
    }

    return {
      id: `showcase-game-${number}`,
      dateOffset,
      time: TIMES[index % TIMES.length],
      field: FIELDS[index % FIELDS.length],
      level,
      awayTeam,
      homeTeam,
      gameType: gameTypeForLevel(level),
      division:
        index % 4 === 0
          ? "American"
          : index % 4 === 1
            ? "National"
            : index % 4 === 2
              ? "Developmental"
              : "Travel",
      demoData: true,
      showcaseData: true
    };
  }

  const games = Array.from(
    { length: 120 },
    (_, index) => buildGame(index)
  );

  function getAll() {
    return structuredClone(games);
  }

  return {
    getAll
  };
})();
