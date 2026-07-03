// data/storage.js

const GAMES_STORAGE_KEY = "bluecrew-games-v2";
const CREW_STORAGE_KEY = "bluecrew-crew-v2";

function loadGames() {
  return loadFromStorage(GAMES_STORAGE_KEY, games, "games");
}

function saveGames() {
  localStorage.setItem(GAMES_STORAGE_KEY, JSON.stringify(games));
}

function loadCrew() {
  return loadFromStorage(CREW_STORAGE_KEY, crew, "crew");
}

function saveCrew() {
  localStorage.setItem(CREW_STORAGE_KEY, JSON.stringify(crew));
}

function loadFromStorage(key, fallbackData, label) {
  const stored = localStorage.getItem(key);

  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (err) {
      console.error(`Unable to load saved ${label}.`, err);
    }
  }

  return structuredClone(fallbackData);
}

function resetGames() {
  localStorage.removeItem(GAMES_STORAGE_KEY);
  location.reload();
}

function resetCrew() {
  localStorage.removeItem(CREW_STORAGE_KEY);
  location.reload();
}

function resetAllData() {
  localStorage.removeItem(GAMES_STORAGE_KEY);
  localStorage.removeItem(CREW_STORAGE_KEY);
  localStorage.removeItem("bluecrewDatabase_v1");
  location.reload();
}

function generateId() {
  return Date.now() + Math.floor(Math.random() * 100000);
}

function ensureGameIds() {
  games.forEach(game => {
    if (!game.id) {
      game.id = generateId();
    }
  });

  saveGames();
}

function ensureCrewIds() {
  crew.forEach(member => {
    if (!member.id) {
      member.id = generateId();
    }

    if (member.active === undefined) {
      member.active = true;
    }
  });

  saveCrew();
}

function ensureDataIds() {
  ensureGameIds();
  ensureCrewIds();
}

function migrateCrewIds() {
  let updated = false;

  games.forEach(game => {
    if (!game.crewId && game.umpire) {
      const member =
        typeof crewService !== "undefined"
          ? crewService.getByName(game.umpire)
          : crew.find(member => member.name || `${member.firstName || ""} ${member.lastName || ""}`.trim() || member.email || "Unnamed Crew Member" === game.umpire);

      if (member) {
        game.crewId = member.id;
        updated = true;
      }
    }
  });

  if (updated) {
    saveGames();
  }
}