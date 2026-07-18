// js/schedule/openGamesQueue.js

function getOpenGamesForDate(date) {
  return gameService
    .getByDate(date)
    .filter(game => !assignmentService.isAssigned(game));
}

function getRecommendationBadge(score) {
  if (score >= 140) {
    return {
      className: "excellent",
      label: "Excellent Match"
    };
  }

  if (score >= 100) {
    return {
      className: "good",
      label: "Good Match"
    };
  }

  return {
    className: "review",
    label: "Review Recommended"
  };
}

function assignBestCrew(gameId) {
  const game = gameService.getById(gameId);

  if (!game) return;

  const recommendation =
    recommendationService.getBestCrewForGame(game);

  if (!recommendation) return;

  const result =
    assignmentService.assignCrew(
      game.id,
      recommendation.crewId
    );

  if (!result.success) {
    alert(result.message);
    return;
  }

  renderScheduleContent();
  if (
    typeof refreshWorkbenchIfActive === "function"
  ) {
    refreshWorkbenchIfActive();
  }

}

function renderOpenGamesQueue(date) {

  const openGames =
    getOpenGamesForDate(date);

  if (!openGames.length) {
    return `
      <section class="open-games-panel presentation-panel">

        <div class="panel-header">
          <h3>✅ All Games Assigned</h3>
          <p>No open assignments for this day.</p>
        </div>

      </section>
    `;
  }

  return `
    <section class="open-games-panel presentation-panel">

      <div class="panel-header">

        <div>
          <h3>Open Assignments</h3>

          <p>
            ${openGames.length}
            game${openGames.length === 1 ? "" : "s"}
            need crew
          </p>

        </div>

      </div>

      ${openGames.map(game => {

        const recommendation =
          recommendationService.getBestCrewForGame(game);

        if (!recommendation) {
          return "";
        }

        const badge =
          getRecommendationBadge(
            recommendation.score
          );

        return `
          <div class="open-game-card">

            <div>

              <h4>
                ${game.awayTeam}
                @
                ${game.homeTeam}
              </h4>

              <p>
                ${game.level}
                •
                ${game.time}
              </p>

            </div>

            <div class="recommended-row">

              <div>

                <span class="recommendation-pill ${badge.className}">
                  ${badge.label}
                </span>

                <strong>
                  ⭐ ${recommendation.name}
                </strong>

              </div>

              <button
                class="button button-primary primary"
                onclick="assignBestCrew('${game.id}')">

                Assign Best Match

              </button>

            </div>

          </div>
        `;

      }).join("")}

    </section>
  `;
}

function renderScheduleStaffingReadiness(date) {
  const openGames = getOpenGamesForDate(date);
  return `
    <section class="open-games-panel schedule-readiness-panel presentation-panel" data-testid="schedule-staffing-readiness">
      <div class="panel-header"><div>
        <span class="daily-kicker">Staffing Readiness</span>
        <h3>${openGames.length ? "Assignments Need Attention" : "All Games Assigned"}</h3>
        <p>${openGames.length ? `${openGames.length} game${openGames.length === 1 ? "" : "s"} need crew for this day.` : "No open assignments for this day."}</p>
      </div></div>
      <button type="button" class="button button-primary schedule-readiness-action" data-testid="schedule-open-workbench" onclick="window.navigateTo('assigner-workbench', { origin: 'schedule', returnPage: 'schedule', staffing: '${openGames.length ? "open" : "all"}' })">Open Assigner Workbench</button>
    </section>
  `;
}
