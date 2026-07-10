// uiStateService.js

const uiStateService = (() => {

  const state = {
  scheduleFilter: "all",
  accountFilter: "all",
  selectedDate: null,
  selectedCrew: null,
  selectedGame: null
};

  function getState() {
    return state;
  }

  function setScheduleFilter(filter) {
    state.scheduleFilter = filter;
  }

  function getScheduleFilter() {
    return state.scheduleFilter;
  }
function setAccountFilter(filter) {
  state.accountFilter = filter;
}

function getAccountFilter() {
  return state.accountFilter;
}
  function setSelectedDate(date) {
    state.selectedDate = date;
  }

  function getSelectedDate() {
    return state.selectedDate;
  }

  function setSelectedCrew(id) {
    state.selectedCrew = id;
  }

  function getSelectedCrew() {
    return state.selectedCrew;
  }

  function setSelectedGame(id) {
    state.selectedGame = id;
  }

  function getSelectedGame() {
    return state.selectedGame;
  }

  function clearSelections() {
state.scheduleFilter = "all";
state.accountFilter = "all";
    state.selectedDate = null;
    state.selectedCrew = null;
    state.selectedGame = null;
  }

  return {
    getState,

    setScheduleFilter,
    getScheduleFilter,

setAccountFilter,
getAccountFilter,

    setSelectedDate,
    getSelectedDate,

    setSelectedCrew,
    getSelectedCrew,

    setSelectedGame,
    getSelectedGame,

    clearSelections
  };

})();