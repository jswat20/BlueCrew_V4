// js/demo/demoGames.js

const demoGameData = (() => {
  const games = [
    {
      id: "demo-game-001",
      dateOffset: -1,
      time: "6:00 PM",
      field: "East Field 1",
      level: "10U",
      awayTeam: "Orioles",
      homeTeam: "Yankees",
      gameType: "single"
    },
    {
      id: "demo-game-002",
      dateOffset: -1,
      time: "7:30 PM",
      field: "West Field 2",
      level: "12U",
      awayTeam: "Mets",
      homeTeam: "Phillies",
      gameType: "twoMan"
    },
    {
      id: "demo-game-003",
      dateOffset: 0,
      time: "6:00 PM",
      field: "East Field 1",
      level: "8U",
      awayTeam: "Blue Jays",
      homeTeam: "Red Sox",
      gameType: "single"
    },
    {
      id: "demo-game-004",
      dateOffset: 0,
      time: "7:30 PM",
      field: "East Field 2",
      level: "10U",
      awayTeam: "Braves",
      homeTeam: "Nationals",
      gameType: "twoMan"
    },
    {
      id: "demo-game-005",
      dateOffset: 1,
      time: "6:00 PM",
      field: "West Field 1",
      level: "10U",
      awayTeam: "Guardians",
      homeTeam: "Tigers",
      gameType: "single"
    },
    {
      id: "demo-game-006",
      dateOffset: 1,
      time: "7:30 PM",
      field: "West Field 2",
      level: "12U",
      awayTeam: "Cubs",
      homeTeam: "Cardinals",
      gameType: "twoMan"
    },
    {
      id: "demo-game-007",
      dateOffset: 3,
      time: "9:00 AM",
      field: "Central Complex A",
      level: "10U",
      awayTeam: "Rays",
      homeTeam: "Twins",
      gameType: "twoMan"
    },
    {
      id: "demo-game-008",
      dateOffset: 4,
      time: "1:00 PM",
      field: "Central Complex B",
      level: "14U",
      awayTeam: "Dodgers",
      homeTeam: "Giants",
      gameType: "twoMan"
    }
  ];

  function getAll() {
    return structuredClone(games);
  }

  return {
    getAll
  };
})();
