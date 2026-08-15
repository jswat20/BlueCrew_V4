// data/storage.js

const GAMES_STORAGE_KEY = "bluecrew-games-v2";
const CREW_STORAGE_KEY = "bluecrew-crew-v2";

function loadGames() {
  return loadFromRepository("games", games, "games");
}

function saveGames() {
  repositoryProvider.get("games").write(games);
}

function loadCrew() {
  return loadFromRepository("crew", crew, "crew");
}

function saveCrew() {
  repositoryProvider.get("crew").write(crew);
}

function loadFromRepository(name, fallbackData, label) {
  try {
    const stored = repositoryProvider.get(name).read();
    if (stored !== null) return stored;
  } catch (err) {
    console.error(`Unable to load saved ${label}.`, err);
  }

  return structuredClone(fallbackData);
}

function resetGames() {
  repositoryProvider.get("games").remove();
  location.reload();
}

function resetCrew() {
  repositoryProvider.get("crew").remove();
  location.reload();
}

function resetAllData() {
  repositoryProvider.get("games").remove();
  repositoryProvider.get("crew").remove();
  repositoryProvider.get("legacyDatabase").remove();
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
