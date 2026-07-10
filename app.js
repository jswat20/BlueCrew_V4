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
    title: "Login",
    subtitle: "Access your umpire portal."
  },
  "my-schedule": {
    title: "My Schedule",
    subtitle: "Your assigned games."
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
  }
};

function initializeApp() {
  games = loadGames();
  crew = loadCrew();

  ensureDataIds();
  migrateCrewIds();

  migrationService.migrateGames();

  document.body.dataset.page = "dashboard";
  document.body.dataset.role = "admin";

  setupNavigation();
  setupRoleSwitcher();

  renderPage("dashboard");

  window.BlueCrew.test.initialized = true;
}

function setupNavigation() {
  document.querySelectorAll(".nav-link").forEach(button => {
    button.addEventListener("click", () => {
      renderPage(button.dataset.page);
    });
  });
}

function setupRoleSwitcher() {
  const adminButton = document.getElementById("admin-role-btn");
  const umpireButton = document.getElementById("umpire-role-btn");

  if (!adminButton || !umpireButton) return;

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

function renderPage(page, context = {}) {
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
}

function navigateTo(page, context = {}) {
  renderPage(page, context);
}

function runPageSetup(page, context = {}) {
  if (page !== "schedule") return;

  if (authService.isAdmin()) {
    currentScheduleDate =
      currentScheduleDate || gameService.getFirstDateOrToday();

    renderScheduleContent(context);
  }
}

function renderAdminView(page, context = {}) {
  const renderers = {
    dashboard: typeof renderDashboard === "function" ? renderDashboard : null,
    login: typeof renderLogin === "function" ? renderLogin : null,
    schedule: typeof renderSchedule === "function" ? renderSchedule : null,
    crew: typeof renderCrew === "function" ? renderCrew : null,
    reports: typeof renderReports === "function" ? renderReports : null,
    settings: typeof renderSettings === "function" ? renderSettings : null,
    admin: typeof renderAdmin === "function" ? renderAdmin : null,
    notifications: typeof renderNotifications === "function" ? renderNotifications : null,
    accounts: typeof renderAccounts === "function" ? renderAccounts : null,
    "my-schedule": typeof renderMySchedule === "function" ? renderMySchedule : null,
    "claims-queue": typeof renderClaimsQueue === "function" ? renderClaimsQueue : null,
    "claim-history": typeof renderClaimHistory === "function" ? renderClaimHistory : null,
    availability:
      typeof renderAvailability === "function"
        ? renderAvailability
        : null,

  };

  const renderer = renderers[page];

  return renderer
    ? renderer(context)
    : placeholderPage("Page Not Found", "This page does not exist yet.");
}

function renderUmpireView(page, context = {}) {
  switch (page) {
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

    case "claim-games":
      return typeof renderClaimGames === "function"
        ? renderClaimGames(context)
        : placeholderPage("Claim Games", "Claim Games is unavailable.");

    case "my-claims":
      return typeof renderMyClaims === "function"
        ? renderMyClaims(context)
        : placeholderPage("My Claims", "My Claims is unavailable.");

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

  const unreadCount = notificationService.getUnreadCount();

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
    title: "BlueCrew",
    subtitle: ""
  };

  const title = document.getElementById("page-title");
  const subtitle = document.getElementById("page-subtitle");

  if (title) title.textContent = pageConfig.title;
  if (subtitle) subtitle.textContent = pageConfig.subtitle;
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

window.updateNotificationBadge = updateNotificationBadge;
window.navigateTo = navigateTo;

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