// js/services/storageService.js

const storageService = {

  saveGames() {
    if (typeof saveGames === "function") {
      saveGames();
    }
  },

  loadGames() {
    if (typeof loadGames === "function") {
      return loadGames();
    }

    return [];
  },

  saveCrew() {
    if (typeof saveCrew === "function") {
      saveCrew();
    }
  },

  loadCrew() {
    if (typeof loadCrew === "function") {
      return loadCrew();
    }

    return [];
  }

};