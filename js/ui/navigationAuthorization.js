// js/ui/navigationAuthorization.js

function refreshNavigationAuthorization() {
  if (
    typeof authorizationService === "undefined" ||
    typeof authorizationService.canView !== "function"
  ) {
    return;
  }

  document
    .querySelectorAll(".nav-link[data-page]")
    .forEach(link => {
      const page = link.dataset.page;
      link.hidden = !authorizationService.canView(page);
    });
}
