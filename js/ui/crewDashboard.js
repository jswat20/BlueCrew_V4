// js/ui/crewDashboard.js

function renderReturnedReviewDashboardCard() {
  const returnedGames =
    typeof reviewService !== "undefined" &&
    typeof reviewService
      .getReturnedGamesForCurrentUmpire ===
      "function"
      ? reviewService
          .getReturnedGamesForCurrentUmpire()
      : [];

  if (!returnedGames.length) {
    return "";
  }

  return `
    <section
      class="dashboard-card"
      data-testid="dashboard-returned-review-card"
    >
      <div class="card-header">
        <div>
          <h2>Returned Reviews</h2>
          <span class="card-subtitle">
            Games waiting for corrections.
          </span>
        </div>
      </div>

      <div
        class="summary-value"
        data-testid="dashboard-returned-review-count"
      >
        ${returnedGames.length}
      </div>

      <div class="card-actions">
        <button
          type="button"
          class="button button-primary"
          data-testid="dashboard-resume-returned-review"
          onclick="openReturnedReviewFromDashboard()"
        >
          Resume Review
        </button>
      </div>
    </section>
  `;
}

function openReturnedReviewFromDashboard() {
  const returnedGames =
    reviewService
      .getReturnedGamesForCurrentUmpire();

  if (returnedGames.length === 1) {
    renderPage("game-hub", {
      gameId: returnedGames[0].id
    });

    return;
  }

  renderPage("my-schedule", {
    filter: "returned"
  });
}

function renderCrewDashboard() {

  const crewId = authService.currentCrewId();

  if (!crewId) {
    return `
      <div class="empty-state">
        <h2>No crew member selected</h2>
      </div>
    `;
  }

  const member = crewService.getById(crewId);

  const todaysAssignments =
    assignmentService.getTodaysAssignmentsForCrew(crewId);

  const pendingApprovals =
    assignmentService.getPendingClaimsForCrew(crewId);

  const claimableGames =
    assignmentService.getClaimableGames(crewId);

  const upcomingAssignments =
    assignmentService
      .getUpcomingAssignmentsForCrew(crewId)
      .slice(0, 10);

  const todaysGame = todaysAssignments[0];

  return `

    <div class="crew-dashboard">

      <div class="dashboard-header">
        <h2>Welcome, ${member?.name || "Crew Member"}</h2>
        <p>Here's what's happening today.</p>
      </div>

      ${renderReturnedReviewDashboardCard()}

      ${renderCrewHero(todaysGame)}

      ${renderCrewStats(
        todaysAssignments.length,
        upcomingAssignments.length,
        pendingApprovals.length,
        claimableGames.length
      )}

      ${renderCrewSection(
        "Upcoming Schedule",
        upcomingAssignments,
        renderCrewAssignmentCard
      )}

      ${renderCrewSection(
        "Pending Approval",
        pendingApprovals,
        renderCrewPendingCard
      )}

      ${renderCrewSection(
        "Available Games",
        claimableGames,
        renderCrewClaimCard
      )}

    </div>

  `;
}

function renderCrewSection(title, games, renderer) {

  return `
    <section class="crew-dashboard-section">

      <h3>${title}</h3>

      ${
        games.length
          ? games.map(renderer).join("")
          : `<div class="empty-state">None</div>`
      }

    </section>
  `;
}

function renderCrewHero(game) {

  if (!game) {

    return `
      <div class="card crew-hero">

        <h3>Today</h3>

        <p>No assignments today.</p>

      </div>
    `;
  }

  return `

    <div class="card crew-hero">

      <div class="hero-status">

        ${renderAssignmentStatusBadge(game)}

      </div>

      <h2>

        ${game.awayTeam}

        @

        ${game.homeTeam}

      </h2>

      <p>

        📅 ${formatDate(game.date)}

      </p>

      <p>

        🕒 ${game.time}

      </p>

      <p>

        📍 Field ${game.field}

      </p>

      <p>

        ${game.level}

      </p>

    </div>

  `;
}

function renderCrewStats(today, upcoming, pending, available) {

  return `

    <div class="crew-stats">

      <div class="stat-card">

        <div class="stat-value">${today}</div>

        <div class="stat-label">Today</div>

      </div>

      <div class="stat-card">

        <div class="stat-value">${upcoming}</div>

        <div class="stat-label">Upcoming</div>

      </div>

      <div class="stat-card">

        <div class="stat-value">${pending}</div>

        <div class="stat-label">Pending</div>

      </div>

      <div class="stat-card">

        <div class="stat-value">${available}</div>

        <div class="stat-label">Available</div>

      </div>

    </div>

  `;
}

function renderCrewAssignmentCard(game) {

  return `
    <div class="schedule-game-card">

      <div>
        <strong>${game.awayTeam}</strong>
        @
        <strong>${game.homeTeam}</strong>
      </div>

      <div>
        ${formatDate(game.date)}
        •
        ${game.time}
      </div>

      <div>
        ${game.level}
        •
        Field ${game.field}
      </div>

      ${renderAssignmentStatusBadge(game)}

    </div>
  `;
}

function renderCrewPendingCard(game) {

  return `
    <div class="schedule-game-card">

      <div>
        <strong>${game.awayTeam}</strong>
        @
        <strong>${game.homeTeam}</strong>
      </div>

      <div>
        ${formatDate(game.date)}
        •
        ${game.time}
      </div>

      <div class="pending-note">
        Awaiting assignor approval
      </div>

      ${renderAssignmentStatusBadge(game)}

    </div>
  `;
}

function renderCrewClaimCard(game) {
  const crewId = authService.currentCrewId();
  const availability = crewService.getAvailability(game.id, crewId);

  const availabilityText = {
    available: "✅ Available",
    unavailable: "❌ Can't Work",
    unknown: "❓ Not Set"
  };

  return `
    <div class="schedule-game-card">

      <div>
        <strong>${game.awayTeam}</strong>
        @
        <strong>${game.homeTeam}</strong>
      </div>

      <div>
        ${formatDate(game.date)}
        •
        ${game.time}
      </div>

      <div>
        ${game.level}
        •
        Field ${game.field}
      </div>

      <div class="crew-availability">
        <strong>${availabilityText[availability] || availabilityText.unknown}</strong>
      </div>

      <div class="crew-availability-buttons">
        <button
          class="secondary-btn"
          onclick="setCrewAvailability('${game.id}', 'available')">
          I'm Available
        </button>

        <button
          class="secondary-btn"
          onclick="setCrewAvailability('${game.id}', 'unavailable')">
          Can't Work
        </button>

        <button
          class="primary-btn"
          onclick="claimCrewGame('${game.id}')">
          Claim Game
        </button>
      </div>

    </div>
  `;
}

function claimCrewGame(gameId) {

  const result = assignmentService.claimGame(
    gameId,
    authService.currentCrewId()
  );

  if (result.success) {
    toastService.success(result.message);
    uiService.refreshCrewPortal();
  } else {
    toastService.error(result.message);
  }
}

function setCrewAvailability(gameId, status) {
  crewService.setAvailability(
    gameId,
    authService.currentCrewId(),
    status
  );

uiService.refreshCrewPortal();}
