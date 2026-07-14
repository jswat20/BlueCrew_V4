// uiStateService.js

const uiStateService = (() => {

  const state = {
  scheduleFilter: "all",
  accountFilter: "all",
  selectedDate: null,
  selectedCrew: null,
  selectedGame: null,
  notificationFilter: "all",
  notificationSearch: "",
  notificationSort: "newest",
  selectedNotificationIds: []
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

  function setNotificationFilter(
    filter
  ) {
    state.notificationFilter =
      filter || "all";
  }

  function getNotificationFilter() {
    return state.notificationFilter;
  }

  function setNotificationSearch(
    search
  ) {
    state.notificationSearch =
      String(search || "");
  }

  function getNotificationSearch() {
    return state.notificationSearch;
  }

  function setNotificationSort(sort) {
    state.notificationSort =
      sort === "oldest"
        ? "oldest"
        : "newest";
  }

  function getNotificationSort() {
    return state.notificationSort;
  }

  function setSelectedNotificationIds(
    ids
  ) {
    state.selectedNotificationIds = [
      ...new Set(
        (ids || []).map(String)
      )
    ];
  }

  function getSelectedNotificationIds() {
    return [
      ...state.selectedNotificationIds
    ];
  }

  function clearNotificationSelection() {
    state.selectedNotificationIds = [];
  }

  function clearSelections() {
state.scheduleFilter = "all";
state.accountFilter = "all";
    state.selectedDate = null;
    state.selectedCrew = null;
    state.selectedGame = null;
    state.notificationFilter = "all";
    state.notificationSearch = "";
    state.notificationSort = "newest";
    state.selectedNotificationIds = [];
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

    setNotificationFilter,
    getNotificationFilter,

    setNotificationSearch,
    getNotificationSearch,

    setNotificationSort,
    getNotificationSort,

    setSelectedNotificationIds,
    getSelectedNotificationIds,
    clearNotificationSelection,

    clearSelections
  };

})();