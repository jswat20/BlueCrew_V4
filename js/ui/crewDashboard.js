function renderReturnedReviewDashboardCard() {
  const returnedGames =
    typeof reviewService !== "undefined" &&
    typeof reviewService.getReturnedGamesForCurrentUmpire === "function"
      ? reviewService.getReturnedGamesForCurrentUmpire()
      : [];

  if (!returnedGames.length) return "";

  return `
    <section class="crew-returned-review" data-testid="dashboard-returned-review-card">
      <span><strong>Returned Reviews</strong><small>Game reports waiting for corrections.</small></span>
      <b data-testid="dashboard-returned-review-count">${returnedGames.length}</b>
      <button type="button" class="button button-primary" data-testid="dashboard-resume-returned-review" onclick="openReturnedReviewFromDashboard()">Resume</button>
    </section>
  `;
}

function openReturnedReviewFromDashboard() {
  const returnedGames = reviewService.getReturnedGamesForCurrentUmpire();
  if (returnedGames.length === 1) {
    renderPage("game-hub", { gameId: returnedGames[0].id });
    return;
  }
  renderPage("my-schedule", { filter: "returned" });
}

function renderCrewDashboard() {
  const crewId = authService.currentCrewId();

  if (!crewId) {
    return `<div class="empty-state"><h2>No crew member selected</h2></div>`;
  }

  const member = crewService.getById(crewId);
  const todaysAssignments = assignmentService.getTodaysAssignmentsForCrew(crewId);
  const pendingApprovals = assignmentService.getPendingClaimsForCrew(crewId);
  const claimableGames = assignmentService.getClaimableGames(crewId);
  const upcomingAssignments = assignmentService
    .getUpcomingAssignmentsForCrew(crewId)
    .slice(0, 10);
  const todaysGame = todaysAssignments[0];
  const now = new Date();
  const greeting = now.getHours() < 12 ? "Morning" : now.getHours() < 17 ? "Afternoon" : "Evening";
  const todayLabel = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric"
  });
  const timeLabel = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return `
    <div class="crew-dashboard crew-command-dashboard" data-testid="crew-dashboard">
      <header class="crew-command-header">
        <div><h1>Good ${greeting}, ${authenticatedIdentityService.displayName(loginService.getCurrentAccount())}</h1><p>Your assignments, claims, and game-day work at a glance.</p></div>
        <time><span>${todayLabel}</span><strong>${timeLabel}</strong></time>
      </header>

      ${renderCrewStats(
        todaysAssignments.length,
        upcomingAssignments.length,
        pendingApprovals.length,
        claimableGames.length
      )}

      <div class="crew-command-grid">
        <section class="crew-command-panel crew-command-today" data-testid="crew-dashboard-today">
          <header><h2>Today's Assignment</h2><button type="button" class="button button-secondary" onclick="renderPage('my-schedule')">View My Schedule</button></header>
          ${renderCrewHero(todaysGame)}
        </section>

        <aside class="crew-command-panel crew-command-actions" data-testid="crew-dashboard-actions">
          <header><h2>Action Center</h2></header>
          ${renderReturnedReviewDashboardCard()}
          ${renderCrewActionSummary("Pending Claims", pendingApprovals.length, "Claims awaiting assignor approval.", "renderPage('my-claims')")}
          ${renderCrewActionSummary("Available Games", claimableGames.length, "Games currently open for claims.", "renderPage('claim-games')")}
        </aside>
      </div>

      <div class="crew-command-lists">
        ${renderCrewSection("Upcoming Schedule", upcomingAssignments, renderCrewAssignmentCard)}
        ${renderCrewSection("Available to Claim", claimableGames.slice(0, 4), renderCrewClaimCard)}
      </div>
    </div>
  `;
}

function renderCrewActionSummary(title, count, detail, action) {
  return `<button type="button" class="crew-action-row" onclick="${action}"><span><strong>${title}</strong><small>${detail}</small></span><b data-attention="${count > 0}">${count}</b></button>`;
}

function renderCrewSection(title, games, renderer) {
  return `
    <section class="crew-dashboard-section crew-command-panel">
      <header><h2>${title}</h2></header>
      <div class="crew-command-list">
        ${games.length ? games.map(renderer).join("") : `<div class="crew-command-empty">Nothing to show right now.</div>`}
      </div>
    </section>
  `;
}

function renderCrewHero(game) {
  if (!game) {
    return `<div class="crew-hero crew-hero-empty"><strong>No assignments today.</strong><span>Use Available Games to find work that fits your eligibility.</span></div>`;
  }

  return `
    <button type="button" class="crew-hero" onclick="renderPage('game-hub', { gameId: '${game.id}' })">
      <span class="crew-hero-time">${game.time}</span>
      <span class="crew-hero-matchup"><strong>${game.awayTeam} @ ${game.homeTeam}</strong><small>${formatDate(game.date)}</small></span>
      <span class="crew-hero-detail"><b>${levelTerminologyService.format(game.level)}</b><small>${locationService.getDisplayName(game)}</small></span>
      <span class="crew-hero-status">${renderAssignmentStatusBadge(game)}</span>
    </button>
  `;
}

function renderCrewStats(today, upcoming, pending, available) {
  return `
    <div class="crew-stats" aria-label="Crew dashboard status">
      <button type="button" class="stat-card" onclick="renderPage('my-schedule')"><span class="stat-label">Assignments Today</span><span class="stat-value">${today}</span></button>
      <button type="button" class="stat-card" onclick="renderPage('my-schedule')"><span class="stat-label">Upcoming Games</span><span class="stat-value">${upcoming}</span></button>
      <button type="button" class="stat-card" data-attention="${pending > 0}" onclick="renderPage('my-claims')"><span class="stat-label">Pending Claims</span><span class="stat-value">${pending}</span></button>
      <button type="button" class="stat-card" onclick="renderPage('claim-games')"><span class="stat-label">Available Games</span><span class="stat-value">${available}</span></button>
    </div>
  `;
}

function renderCrewAssignmentCard(game) {
  return `
    <button type="button" class="schedule-game-card crew-command-game-row" onclick="renderPage('game-hub', { gameId: '${game.id}' })">
      <strong>${game.time}</strong>
      <span><b>${game.awayTeam} @ ${game.homeTeam}</b><small>${formatDate(game.date)}</small></span>
      <span><b>${levelTerminologyService.format(game.level)}</b><small>${locationService.getDisplayName(game)}</small></span>
      ${renderAssignmentStatusBadge(game)}
    </button>
  `;
}

function renderCrewPendingCard(game) {
  return renderCrewAssignmentCard(game);
}

function renderCrewClaimCard(game) {
  const crewId = authService.currentCrewId();
  const availability = crewService.getAvailability(game.id, crewId);
  const availabilityText = {
    available: "Available",
    unavailable: "Can't Work",
    unknown: "Not Set"
  };

  return `
    <article class="schedule-game-card crew-command-claim-row">
      <div class="crew-claim-summary"><strong>${game.time}</strong><span><b>${game.awayTeam} @ ${game.homeTeam}</b><small>${formatDate(game.date)} · ${levelTerminologyService.format(game.level)} · ${locationService.getDisplayName(game)}</small></span><em data-status="${availability}">${availabilityText[availability] || availabilityText.unknown}</em></div>
      <div class="crew-availability-buttons">
        <button type="button" class="button button-secondary" onclick="setCrewAvailability('${game.id}', 'available')">Available</button>
        <button type="button" class="button button-secondary" onclick="setCrewAvailability('${game.id}', 'unavailable')">Can't Work</button>
        <button type="button" class="button button-primary" data-testid="dashboard-claim-${game.id}" onclick="claimCrewGame('${game.id}')">Claim</button>
      </div>
    </article>
  `;
}

async function claimCrewGame(gameId) {
  const result = await portalService.claimGame(gameId);
  if (result.success) {
    toastService.success(result.message);
    uiService.refreshCrewPortal();
  } else {
    toastService.error(result.message);
  }
}

function setCrewAvailability(gameId, status) {
  crewService.setAvailability(gameId, authService.currentCrewId(), status);
  uiService.refreshCrewPortal();
}
