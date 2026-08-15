// js/ui/navigationAuthorization.js

function refreshNavigationAuthorization() {
  if (
    typeof authorizationService === "undefined" ||
    typeof authorizationService.canView !== "function"
  ) {
    return;
  }

  const authenticated = typeof loginService !== "undefined" && loginService.isLoggedIn();
  const hostedMode = typeof supabaseClientService !== "undefined" && supabaseClientService.isConfigured();
  const logout = document.querySelector('[data-testid="nav-logout"]');
  const login = document.querySelector('[data-testid="nav-login"]');
  if (logout) logout.hidden = !authenticated;
  if (login) login.hidden = authenticated;

  document
    .querySelectorAll(".nav-link[data-page]")
    .forEach(link => {
      const page = link.dataset.page;
      const crewOnly = link.dataset.crewOnly === "true";
      const isCrewRole = authorizationService.currentRole() === "umpire";
      if (page === "login") return;
      if (page === "notifications" && hostedMode && !authenticated) {
        link.hidden = true;
        return;
      }
      link.hidden = !authorizationService.canView(page) || (crewOnly && !isCrewRole);
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
