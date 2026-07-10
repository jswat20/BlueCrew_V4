// js/services/demoDataService.js

const demoDataService = (() => {

  let loaded = false;

  function isLoaded() {
    return loaded;
  }

  function getSummary() {
    return {
      loaded,
      crew: 0,
      games: 0,
      accounts: 0
    };
  }

  function loadLeague() {
    loaded = true;

    return {
      success: true,
      message: "Demo league loaded.",
      data: getSummary()
    };
  }

  return {
    isLoaded,
    getSummary,
    loadLeague
  };

})();