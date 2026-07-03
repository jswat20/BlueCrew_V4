// js/services/uiService.js

const uiService = (() => {

  function refreshCurrentPage() {
    if (typeof renderPage === "function") {
      renderPage(currentPage);
    }
  }

  function refreshSchedule() {
    if (typeof renderScheduleContent === "function") {
      renderScheduleContent();
      return;
    }

    refreshCurrentPage();
  }

  function refreshDashboard() {
    refreshCurrentPage();
  }

  function refreshCrewPortal() {
    refreshCurrentPage();
  }

  function refreshAll() {
    refreshCurrentPage();
  }

  return {
    refreshCurrentPage,
    refreshSchedule,
    refreshDashboard,
    refreshCrewPortal,
    refreshAll
  };

})();