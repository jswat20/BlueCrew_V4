// app.js

let currentPage = "dashboard";
let currentPageContext = {};

// ----------------------------------------------------
// QA / Playwright Support
// ----------------------------------------------------

window.BlueCrew = window.BlueCrew || {};

window.BlueCrew.test = {
  currentPage: "dashboard",
  currentRole: "admin",
  initialized: false,
  errors: []
};

const pages = {
  dashboard: {
    title: "Dashboard",
    subtitle: "Assignments, Schedules, and Activity."
  },
  login: {
    title: "The Slate - Login",
    subtitle: ""
  },
  "forgot-password": { title: "Forgot Password", subtitle: "Request a secure password reset link." },
  "password-recovery": { title: "Set New Password", subtitle: "Finish your secure password recovery." },
  "my-schedule": {
    title: "My Schedule",
    subtitle: "Your assigned games."
  },
  "claim-games": {
    title: "Claim Games",
    subtitle: "Review and claim available assignments."
  },
  "rules-and-regulations": {
    title: "Rules & Regulations",
    subtitle: "Lake Shore Youth Baseball division playing rules."
  },
  profile: {
    title: "Profile",
    subtitle: "Manage your contact information."
  },
  "game-hub": {
  title: "Game Hub",
  subtitle: "Game day information."
},
  "review-queue": {
    title: "Review Queue",
    subtitle: "Review submitted game reports."
  },
  schedule: {
    title: "Schedule",
    subtitle: "View and Manage Game Schedules."
  },
  crew: {
    title: "Crew",
    subtitle: "Manage Crew Records, Eligibility, and Assignments."
  },
  reports: {
    title: "Reports",
    subtitle: "Track Coverage, Assignments, and Season Activity."
  },
  "season-dashboard": {
    title: "Season Dashboard",
    subtitle: "Season operations, staffing, availability, and activity."
  },
  "assigner-workbench": {
    title: "Assigner Workbench",
    subtitle: "Operational queues and priorities."
  },
  settings: {
    title: "Settings",
    subtitle: "Manage Fields, Levels, Teams, and Time Slots."
  },
  admin: {
    title: "Admin",
    subtitle: "Administrative Tools and Controls."
  },
  accounts: {
    title: "Accounts",
    subtitle: "Manage Umpire Registrations and Approvals."
  },
  availability: {
    title: "Availability",
    subtitle: "Manage Crew Availability by Date."
  },
  notifications: {
    title: "Notifications",
    subtitle: "Review recent alerts and updates."
  },
  "claims-queue": {
    title: "Claims Queue",
    subtitle: "Review and manage pending umpire claims."
  },
  "claim-history": {
    title: "Claim History",
    subtitle: "Review processed claims."
  },
  "my-claims": {
    title: "My Claims",
    subtitle: "View and Manage Your Claimed Games."
  },
  "operations-center": {
  title: "Operations Center",
  subtitle:
    "Complete today's operational work."
}
};

function initializeApp() {
  const supabaseServiceMissing = typeof supabaseClientService === "undefined";
  const hostedDependencyError = supabaseServiceMissing || supabaseClientService.hasDependencyError?.();
  const hostedConfigurationError = !supabaseServiceMissing && supabaseClientService.hasConfigurationError();
  if (hostedDependencyError || hostedConfigurationError) {
    games = [];
    crew = [];
    authService.clearAuthenticatedAccount?.();
    document.body.dataset.page = "configuration-error";
    document.body.dataset.role = "none";
    document.querySelector(".sidebar")?.setAttribute("hidden", "");
    document.querySelector(".topbar")?.setAttribute("hidden", "");
    const content = document.getElementById("app-content");
    const errorType = hostedDependencyError ? "dependency" : "configuration";
    const heading = hostedDependencyError
      ? "The Slate could not load a required application component."
      : "The Slate could not connect to its hosted configuration.";
    if (content) content.innerHTML = `<div class="page-wrapper" data-testid="hosted-${errorType}-error"><section class="page-section"><h2>${heading}</h2><p>Do not continue with schedule or account changes. Restart the hosted application or contact the administrator.</p></section></div>`;
    window.BlueCrew.test.currentPage = `${errorType}-error`;
    window.BlueCrew.test.currentRole = "none";
    window.BlueCrew.test.initialized = true;
    return;
  }
  const usesSupabaseAuth = typeof supabaseClientService !== "undefined" && supabaseClientService.isConfigured();
  games = usesSupabaseAuth ? [] : loadGames();
  crew = usesSupabaseAuth ? [] : loadCrew();

  if (!usesSupabaseAuth) {
    ensureDataIds();
    migrateCrewIds();
  }

  if (!usesSupabaseAuth) migrationService.migrateGames();
  if (!usesSupabaseAuth) migrationService.migrateCrewAccounts();

  document.body.dataset.page = usesSupabaseAuth ? "login" : "dashboard";
  document.body.dataset.role = usesSupabaseAuth ? "umpire" : "admin";

  setupNavigation();
  setupInstallHelper?.();
  setupRoleSwitcher();

  if (usesSupabaseAuth) {
    authService.clearAuthenticatedAccount?.();
    renderPage("login");
    window.history.replaceState(
      { blueCrewPage: "login", context: {} },
      "",
      window.location.href
    );
    window.BlueCrew.test.currentRole = "umpire";
    window.BlueCrew.test.initialized = true;

    loginService.initializeAuthenticatedIdentity().then(result => {
      if (result.data?.recovery || supabaseAuthService.isRecoveringPassword?.()) {
        renderPage("password-recovery");
        return;
      }
      if (!result.data) return;
      document.body.dataset.role = result.data.role;
      window.BlueCrew.test.currentRole = result.data.role;
      refreshNavigationAuthorization?.();
      renderPage("dashboard");
    });
    return;
  }

  if (typeof refreshNavigationAuthorization === "function") {
    refreshNavigationAuthorization();
  }

  renderPage("dashboard");

  window.history.replaceState(
    { blueCrewPage: "dashboard", context: {} },
    "",
    window.location.href
  );

  window.BlueCrew.test.initialized = true;
}

function setupNavigation() {
  document.querySelectorAll(".nav-link[data-page]").forEach(button => {
    button.addEventListener("click", () => {
      navigateTo(button.dataset.page);
    });
  });
  document.querySelector("[data-testid='nav-logout']")
    ?.addEventListener("click", logoutFromNavigation);
}

async function retrySharedHydration() {
  const result = await loginService.initializeAuthenticatedIdentity();
  renderPage(result.success && result.data ? "dashboard" : "login");
}

function setupRoleSwitcher() {
  const adminButton = document.getElementById("admin-role-btn");
  const umpireButton = document.getElementById("umpire-role-btn");

  if (!adminButton || !umpireButton) return;

  if (typeof supabaseClientService !== "undefined" && supabaseClientService.isConfigured()) {
    document.querySelector(".role-switcher")?.setAttribute("hidden", "");
    return;
  }

  adminButton.addEventListener("click", () => {
    authService.loginAsAdmin();

    window.BlueCrew.test.currentRole = "admin";

    if (window.qaService) {
      qaService.setRole("admin");
    }

    document.body.dataset.role = "admin";

    adminButton.classList.add("active");
    umpireButton.classList.remove("active");

    renderPage(currentPage, currentPageContext);
  });

  umpireButton.addEventListener("click", () => {
    authService.loginAsUmpire();

    window.BlueCrew.test.currentRole = "umpire";

    if (window.qaService) {
      qaService.setRole("umpire");
    }

    document.body.dataset.role = "umpire";

    umpireButton.classList.add("active");
    adminButton.classList.remove("active");

    renderPage(currentPage, currentPageContext);
  });
}

function renderAccessDenied(page) {
  const pageName =
    pages[page]?.title ||
    String(page || "requested page");

  return `
    <section
      class="access-denied"
      data-testid="access-denied">

      <h2 data-testid="access-denied-title">
        Access Denied
      </h2>

      <p data-testid="access-denied-message">
        You do not have permission to access
        ${pageName}.
      </p>
    </section>
  `;
}

function escapeSharedStateHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderPage(page, context = {}) {
  const hostedMode = typeof supabaseClientService !== "undefined" && supabaseClientService.isConfigured();
  const publicAuthPage = ["login", "forgot-password", "password-recovery"].includes(page);
  if (supabaseAuthService?.isRecoveringPassword?.() && page !== "password-recovery") page = "password-recovery";
  if (hostedMode && !publicAuthPage && !loginService.isLoggedIn()) {
    page = "login";
    context = {};
    window.history.replaceState({ blueCrewPage: "login", context: {} }, "", window.location.href);
  }
  authenticatedIdentityService.updateDocumentTitle(page === "login" ? null : loginService.getCurrentAccount());
  if (typeof refreshNavigationAuthorization === "function") {
    refreshNavigationAuthorization();
  }

  if (page === "profile" && currentPage !== "profile" && typeof resetProfileCardSide === "function") {
    resetProfileCardSide();
  }
  if (page === "rules-and-regulations" && currentPage !== "rules-and-regulations" && typeof resetRulesDivision === "function") {
    resetRulesDivision();
  }

  currentPage = page;
  currentPageContext = context;

  window.BlueCrew.test.currentPage = page;

  if (window.qaService) {
    qaService.setPage(page);
  }

  document.body.dataset.page = page;

  if (typeof closeAssignDrawer === "function") {
    closeAssignDrawer();
  }

  updateActiveNav(page);
  updateHeader(page);

  const content = document.getElementById("app-content");
  if (!content) return;

  const sharedHydrationState = typeof supabaseAuthService !== "undefined"
    ? supabaseAuthService.getHydrationState()
    : { status: "ready" };
  const requiresSharedHydration = sharedHydrationState.status === "error"
    || (["profile", "availability"].includes(page) && sharedHydrationState.status !== "ready");
  if (!publicAuthPage && requiresSharedHydration && typeof supabaseClientService !== "undefined" && supabaseClientService.isConfigured()) {
    const state = sharedHydrationState;
    content.innerHTML = `<div class="page-wrapper" data-testid="shared-hydration-error"><section class="page-section"><h2>Account data unavailable</h2><p>${escapeSharedStateHtml(state.message || "Your shared account data has not finished loading.")}</p><button type="button" data-testid="shared-hydration-retry" onclick="retrySharedHydration()">Retry</button><button type="button" class="secondary" data-testid="shared-hydration-logout" onclick="loginService.logoutAuthenticated().then(() => renderPage('login'))">Log out</button></section></div>`;
    return;
  }

  const isAuthorized = publicAuthPage ||
    typeof authorizationService === "undefined" ||
    typeof authorizationService.canView !== "function" ||
    authorizationService.canView(page);

  if (!isAuthorized) {
    const title = document.getElementById("page-title");
    const subtitle = document.getElementById("page-subtitle");

    if (title) {
      title.textContent = "Access Denied";
    }

    if (subtitle) {
      subtitle.textContent =
        "You do not have permission to view this page.";
    }

    content.innerHTML = `
      <div
        class="page-wrapper"
        data-testid="page-${page}">
        ${renderAccessDenied(page)}
      </div>
    `;

    return;
  }

  const viewHtml = authService.isUmpire()
    ? renderUmpireView(page, context)
    : renderAdminView(page, context);

  content.innerHTML = `
    <div
      class="page-wrapper"
      data-testid="page-${page}">
      ${viewHtml}
    </div>
  `;

updateNotificationBadge();

  runPageSetup(page, context);
  requestAnimationFrame(() => enhanceResponsiveSurfaces(content, page));
}

function enhanceResponsiveSurfaces(root, page) {
  if (!root) return;
  const scrollRegions = root.querySelectorAll([
    ".table-wrapper", ".responsive-table", ".table-container",
    ".presentation-table-wrapper", ".schedule-table-wrap", ".schedule-table-wrapper",
    ".my-schedule-table-wrapper", ".claims-queue-table-wrapper", ".claim-history-section",
    ".review-queue-table-wrapper", ".report-table-wrapper", ".report-detail-table-wrapper",
    ".operations-staffing-table-wrap", ".workbench-open-table-wrap"
  ].join(","));
  scrollRegions.forEach((region, index) => {
    if (!region.hasAttribute("tabindex")) region.tabIndex = 0;
    if (!region.hasAttribute("role")) region.setAttribute("role", "region");
    if (!region.hasAttribute("aria-label")) {
      const heading = region.closest("section, article, .card")?.querySelector("h1, h2, h3, h4");
      region.setAttribute("aria-label", `${heading?.textContent?.trim() || pages[page]?.title || "Data"} table ${index + 1}`);
    }
  });
}

async function logoutFromNavigation() {
  const result = await loginService.logout();
  window.history.replaceState({ blueCrewPage: "login", context: {} }, "", window.location.href);
  refreshNavigationAuthorization?.();
  renderPage("login");
  return result;
}

window.logoutFromNavigation = logoutFromNavigation;

function navigateTo(page, context = {}) {
  if (page === "rules-and-regulations" && typeof resetRulesDivision === "function") {
    resetRulesDivision();
  }
  window.history.pushState(
    { blueCrewPage: page, context },
    "",
    window.location.href
  );

  renderPage(page, context);
}

window.navigateTo = navigateTo;

window.addEventListener("popstate", event => {
  renderPage(
    event.state?.blueCrewPage || "dashboard",
    event.state?.context || {}
  );
});

function runPageSetup(page, context = {}) {
  if (page === "login" && typeof setupLoginForm === "function") {
    setupLoginForm();
  }
  if (["forgot-password", "password-recovery"].includes(page) && typeof setupAccountSecurityPage === "function") {
    setupAccountSecurityPage(page);
  }
  if (page === "settings" && typeof setupSettingsPage === "function") {
    setupSettingsPage();
  }

  if (
    page === "operations-center" &&
    typeof window
      .setupOperationsCenterActions ===
      "function"
  ) {
    window
      .setupOperationsCenterActions();
  }

  if (page !== "schedule") return;

  if (authService.isAdmin()) {
    currentScheduleDate =
      currentScheduleDate ||
      gameService.getFirstDateOrToday();

    renderScheduleContent(context);
  }
}

function renderAdminView(page, context = {}) {
  const renderers = {
    dashboard: typeof renderDashboard === "function" ? renderDashboard : null,
    "rules-and-regulations": typeof renderRulesAndRegulations === "function" ? renderRulesAndRegulations : null,
    profile:
      typeof renderProfile === "function"
        ? renderProfile
        : null,
    login: typeof renderLogin === "function" ? renderLogin : null,
    "forgot-password": typeof renderForgotPassword === "function" ? renderForgotPassword : null,
    "password-recovery": typeof renderPasswordRecovery === "function" ? renderPasswordRecovery : null,
    schedule: typeof renderSchedule === "function" ? renderSchedule : null,
    crew: typeof renderCrew === "function" ? renderCrew : null,
    reports: typeof renderReports === "function" ? renderReports : null,
    "season-dashboard":
      typeof renderSeasonDashboard === "function"
        ? renderSeasonDashboard
        : null,

    "assigner-workbench":
      typeof renderWorkbench === "function"
        ? renderWorkbench
        : null,
    "operations-center": typeof renderOperationsCenter === "function" ? renderOperationsCenter : null,
    settings: typeof renderSettings === "function" ? renderSettings : null,
    admin: typeof renderAdmin === "function" ? renderAdmin : null,
    notifications: typeof renderNotifications === "function" ? renderNotifications : null,
    accounts: typeof renderAccounts === "function" ? renderAccounts : null,
    "my-schedule": typeof renderMySchedule === "function" ? renderMySchedule : null,
    "claims-queue": typeof renderClaimsQueue === "function" ? renderClaimsQueue : null,
    "claim-history": typeof renderClaimHistory === "function" ? renderClaimHistory : null,
    "game-hub": typeof renderGameHub === "function" ? renderGameHub : null,
    "review-queue": typeof renderReviewQueue === "function" ? renderReviewQueue : null,
 
    availability: typeof supabaseClientService !== "undefined" && supabaseClientService.isConfigured()
      ? () => placeholderPage("Availability", "Feature Coming Soon. Availability management will be available soon.")
      : (typeof renderAvailability === "function" ? renderAvailability : null),
  };

  const renderer = renderers[page];

  return renderer
    ? renderer(context)
    : placeholderPage("Page Not Found", "This page does not exist yet.");
}

function renderUmpireView(page, context = {}) {
  switch (page) {
    case "login":
      return typeof renderLogin === "function"
        ? renderLogin(context)
        : placeholderPage("Login", "Login is unavailable.");
    case "forgot-password": return renderForgotPassword();
    case "password-recovery": return renderPasswordRecovery();

    case "dashboard":
      return typeof renderCrewDashboard === "function"
        ? renderCrewDashboard(context)
        : placeholderPage("Crew Dashboard", "Crew dashboard is unavailable.");

    case "schedule":
      return typeof renderCrewDashboard === "function"
        ? renderCrewDashboard(context)
        : placeholderPage("Crew Dashboard", "Crew dashboard is unavailable.");

    case "my-schedule":
      return typeof renderMySchedule === "function"
        ? renderMySchedule(context)
        : placeholderPage("My Schedule", "My Schedule is unavailable.");

    case "profile":
      return typeof renderProfile === "function"
        ? renderProfile(context)
        : placeholderPage(
            "Profile",
            "Profile is unavailable."
          );

    case "rules-and-regulations":
      return typeof renderRulesAndRegulations === "function"
        ? renderRulesAndRegulations(context)
        : placeholderPage("Rules & Regulations", "Rules are unavailable.");

        case "game-hub":
  return typeof renderGameHub === "function"
    ? renderGameHub(context)
    : placeholderPage(
        "Game Hub",
        "Game Hub is unavailable."
      );
      case "notifications":
  return typeof renderNotifications === "function"
    ? renderNotifications(context)
    : placeholderPage(
        "Notifications",
        "Notifications are unavailable."
      );
    case "claim-games":
      return typeof renderClaimGames === "function"
        ? renderClaimGames(context)
        : placeholderPage("Claim Games", "Claim Games is unavailable.");

    case "my-claims":
      return typeof renderMyClaims === "function"
        ? renderMyClaims(context)
        : placeholderPage("My Claims", "My Claims is unavailable.");

    case "availability":
      return typeof supabaseClientService !== "undefined" && supabaseClientService.isConfigured()
        ? placeholderPage("Availability", "Feature Coming Soon. Availability management will be available soon.")
        : (typeof renderAvailability === "function" ? renderAvailability(context) : placeholderPage("Availability", "Availability is unavailable."));

    default:
      return placeholderPage(
        "Coming Soon",
        "This page is not yet available for crew members."
      );
  }
}

function updateNotificationBadge() {
  const badge = document.querySelector('[data-testid="notifications-badge"]');

  if (!badge || typeof notificationService === "undefined") return;

const unreadCount =
  notificationService.getUnreadCount() +
  (
    typeof reviewService !== "undefined" &&
    typeof reviewService
      .getReturnedGamesForCurrentUmpire ===
      "function"
      ? reviewService
          .getReturnedGamesForCurrentUmpire()
          .length
      : 0
  );

  if (!unreadCount) {
    badge.textContent = "";
    badge.hidden = true;
    return;
  }

  badge.textContent = String(unreadCount);
  badge.hidden = false;
}

function updateActiveNav(page) {
  document.querySelectorAll(".nav-link").forEach(button => {
    button.classList.toggle("active", button.dataset.page === page);
  });
}

function updateHeader(page) {
  const pageConfig = pages[page] || {
    title: "The Slate",
    subtitle: ""
  };

  const title = document.getElementById("page-title");
  const subtitle = document.getElementById("page-subtitle");
  const portalIdentity = document.querySelector('[data-testid="portal-identity"]');
  const activeRole = authService.getCurrentUser?.()?.role || document.body.dataset.role || "umpire";
  const portalRole = typeof authenticatedIdentityService !== "undefined"
    ? authenticatedIdentityService.roleLabel(activeRole)
    : activeRole === "assigner" ? "Assigner" : activeRole === "administrator" ? "Administrator" : "Umpire";

  if (portalIdentity) portalIdentity.textContent = `${portalRole} Portal`;

  if (title) {
    title.textContent = page === "operations-center"
      ? `Operations Center — ${new Intl.DateTimeFormat("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric"
        }).format(new Date())}`
      : pageConfig.title;
  }
  if (subtitle) {
    subtitle.textContent = page === "operations-center"
      ? ""
      : pageConfig.subtitle;
    subtitle.hidden = page === "operations-center";
  }
}

function renderGameRow(game) {
  const assigned = assignmentService.isAssigned(game);

  const statusClass = assigned
    ? "status-assigned"
    : "status-unassigned";

  const statusText = assigned
    ? "Assigned"
    : "Unassigned";

  const crewText = assigned
    ? crewService.getDisplayName(game.crewId)
    : "Needs umpire";

  return `
    <div class="game-row" data-testid="game-row-${game.id}">
      <div>
        <strong>${game.awayTeam} @ ${game.homeTeam}</strong>
        <p>${formatDate(game.date)} • ${game.time} • ${game.field} • ${game.level}</p>
      </div>

      <div class="game-row-right">
        <span class="status-pill ${statusClass}" data-testid="game-status-${game.id}">${statusText}</span>
        <span class="umpire-name" data-testid="game-umpire-${game.id}">${crewText}</span>
      </div>
    </div>
  `;
}

function formatDate(dateString) {
  if (!dateString) return "";

  const date = new Date(`${dateString}T00:00:00`);

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}

function placeholderPage(title, message) {
  return `
    <div class="card" data-testid="placeholder-page">
      <h3>${title}</h3>
      <p class="placeholder">${message}</p>
    </div>
  `;
}

window.updateNotificationBadge =
  updateNotificationBadge;

// ----------------------------------------------------
// QA Error Tracking
// ----------------------------------------------------

window.addEventListener("error", event => {
  window.BlueCrew.test.errors.push({
    type: "error",
    message: event.message,
    filename: event.filename,
    line: event.lineno
  });

  if (window.qaService) {
    qaService.logError(event.message);
  }
});

window.addEventListener("unhandledrejection", event => {
  window.BlueCrew.test.errors.push({
    type: "promise",
    message: String(event.reason)
  });

  if (window.qaService) {
    qaService.logError(event.reason);
  }
});

initializeApp();

// BlueCrew navigation accessibility
(function installBlueCrewNavigationFocus() {
  if (
    window.bluecrewNavigationFocusInstalled
  ) {
    return;
  }

  window.bluecrewNavigationFocusInstalled =
    true;

  if (
    typeof window.navigateTo !==
      "function" &&
    typeof navigateTo !== "function"
  ) {
    return;
  }

  const originalNavigateTo =
    typeof window.navigateTo === "function"
      ? window.navigateTo
      : navigateTo;

  const accessibleNavigateTo =
    function (
      page,
      context = {}
    ) {
      const result =
        originalNavigateTo(
          page,
          context
        );

      if (
        typeof focusPageHeading ===
          "function"
      ) {
        focusPageHeading();
      }

      return result;
    };

  window.navigateTo =
    accessibleNavigateTo;

  try {
    navigateTo =
      accessibleNavigateTo;
  } catch {
    // The window reference remains available.
  }

  if (
    typeof ensureAccessibilityLiveRegion ===
      "function"
  ) {
    ensureAccessibilityLiveRegion();
  }
})();
