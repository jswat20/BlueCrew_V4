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

  document
    .querySelectorAll(".nav-group")
    .forEach(group => {
      const hasVisibleLink =
        Array.from(
          group.querySelectorAll(
            ".nav-link[data-page]"
          )
        ).some(link => !link.hidden);

      group.hidden = !hasVisibleLink;

      const toggle =
        group.querySelector(
          ".nav-group-toggle"
        );

      const items =
        group.querySelector(
          ".nav-group-items"
        );

      if (!toggle || !items) {
        return;
      }

      const storageKey =
        `slate-nav-${group.dataset.testid || group.id || toggle.id}`;

      if (!toggle.dataset.navigationGroupBound) {
        toggle.dataset.navigationGroupBound = "true";

        toggle.addEventListener("click", () => {
          const willExpand =
            toggle.getAttribute("aria-expanded") !== "true";

          toggle.setAttribute(
            "aria-expanded",
            String(willExpand)
          );
          items.hidden = !willExpand;
          localStorage.setItem(
            storageKey,
            willExpand ? "expanded" : "collapsed"
          );
        });
      }

      const containsActivePage =
        Boolean(
          items.querySelector(
            ".nav-link.active"
          )
        );

      const isExpanded =
        containsActivePage ||
        localStorage.getItem(storageKey) !== "collapsed";

      toggle.setAttribute(
        "aria-expanded",
        String(isExpanded)
      );
      items.hidden = !isExpanded;
    });
}
