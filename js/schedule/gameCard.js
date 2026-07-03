// js/schedule/gameCard.js

function renderGameCard(game) {
  const assigned = assignmentService.isAssigned(game);
  const isAdmin = authService.isAdmin();
const isUmpire = authService.isUmpire();
const isOpenForClaim = assignmentService.isOpenForClaim(game);
const isPendingApproval = assignmentService.isPendingApproval(game);
const isLocked = assignmentService.isLocked(game);
const myCrewId = authService.currentCrewId();
  const crewName = crewService.getDisplayName(game.crewId);
  const warnings = getGameCardWarnings(game);
  const workload = getGameCrewWorkload(game);

  return `
    <<article
    class="schedule-game-card ${assigned ? "assigned" : "open"}"
    data-testid="game-card-${game.id}">
      <div class="game-card-left">
        <div
    class="game-time"
    data-testid="game-time-${game.id}">${game.time || "Time TBD"}</div>

        <div
    class="game-status"
    data-testid="game-status-${game.id}">
  ${
    typeof renderAssignmentStatusBadge === "function"
      ? renderAssignmentStatusBadge(game)
      : (assigned ? "Assigned" : "Needs Crew")
  }
</div>
      </div>

      <div class="game-card-main">

        <div
    class="game-meta"
    data-testid="game-meta-${game.id}">
          <span>${game.field || "Field TBD"}</span>
          ${game.level ? `<span>${game.level}</span>` : ""}
        </div>

        <h3 data-testid="game-title-${game.id}">${game.awayTeam || "Away"} @ ${game.homeTeam || "Home"}</h3>

<div
    class="game-crew-line ${assigned ? "" : "missing"}"
    data-testid="game-crew-${game.id}">          ${
            assigned
              ? `👤 ${crewName}`
              : "⚠ No crew assigned"
          }
        </div>

        ${
          workload
            ? `
              <div class="workload-badge ${workload.level}">
                ${workload.label}
              </div>
            `
            : ""
        }

        ${
          warnings.length
            ? `
              <div class="game-warning-row">
                ${warnings.map(warning => `
                  <span class="game-warning ${warning.type}">
                    ${warning.message}
                  </span>
                `).join("")}
              </div>
            `
            : ""
        }

       ${renderGameAssignmentControl(game)}

      </div>

<div
    class="game-card-actions"
    data-testid="game-actions-${game.id}">
<button
    data-testid="game-details-${game.id}"
    onclick="openAssignmentDrawer('${game.id}')">          Details
        </button>

        <button
    class="secondary"
    data-testid="game-edit-${game.id}"
          onclick="editGame('${game.id}')">
          Edit
        </button>
      </div>
    </article>
  `;
}

function renderGameAssignmentControl(game) {

  if (authService.isAdmin()) {
    return renderAdminAssignmentControl(game);
  }

  if (assignmentService.isAssigned(game)) {
    return `
      <div class="quick-assigned-panel">
        ✅ You are assigned.
      </div>
    `;
  }

  if (assignmentService.isPendingApproval(game)) {
    return `
      <div class="quick-assigned-panel">
        ⏳ Claim Submitted
      </div>
    `;
  }

  if (assignmentService.isLocked(game)) {
    return `
      <div class="quick-assigned-panel">
        🔒 Assignment Locked
      </div>
    `;
  }

  if (assignmentService.isOpenForClaim(game)) {
    return `
      <div class="quick-assign-panel">

        <button
    class="primary"
    data-testid="claim-game-${game.id}"
    onclick="claimGame('${game.id}')">

          Claim Game

        </button>

      </div>

      <div
    id="assign-feedback-${game.id}"
    data-testid="assign-feedback-${game.id}"
        class="assign-feedback">
      </div>
    `;
  }

  return "";
}

function renderAdminAssignmentControl(game) {
  if (assignmentService.isAssigned(game)) {
    return `
      <div class="quick-assigned-panel">
        <span>
          Assigned to
          <strong>${crewService.getDisplayName(game.crewId)}</strong>
        </span>

        <button
          class="secondary small-btn"
          onclick="showQuickAssignDropdown('${game.id}')">
          Change Crew
        </button>
      </div>

      <div
        id="quick-assign-wrap-${game.id}"
        class="quick-assign-panel hidden">

        ${renderQuickAssignSelect(game)}

      </div>

      <div
        id="assign-feedback-${game.id}"
        data-testid="assign-feedback-${game.id}"
        class="assign-feedback">
      </div>
    `;
  }

  return `
    <div class="quick-assign-panel">
      ${renderQuickAssignSelect(game)}
    </div>

    <div
      id="assign-feedback-${game.id}"
      data-testid="assign-feedback-${game.id}"
      class="assign-feedback">
    </div>
  `;
}

function renderQuickAssignSelect(game) {
  const recommendations =
    recommendationService.getRecommendedCrewForGame(game);

  return `
    <select
    id="quick-assign-${game.id}"
    data-testid="quick-assign-${game.id}"

      <option value="">
        Quick assign crew...
      </option>

      ${recommendations.map(item => {

        let prefix = "⭐";

        if (!item.active || item.conflict) {
          prefix = "⛔";
        } else if (!item.eligible || item.workloadCount >= 2) {
          prefix = "⚠";
        }

        const reasonText =
          item.reasons.length
            ? ` — ${item.reasons.join(", ")}`
            : "";

        return `
          <option value="${item.crewId}">
            ${prefix} ${item.name}${reasonText}
          </option>
        `;
      }).join("")}

    </select>
  `;
}

function showQuickAssignDropdown(gameId) {
  const panel =
    document.getElementById(`quick-assign-wrap-${gameId}`);

  if (panel) {
    panel.classList.remove("hidden");
  }
}

function quickAssignCrew(gameId) {
  const select =
    document.getElementById(`quick-assign-${gameId}`);

  if (!select || !select.value) {
    return;
  }

  showAssignFeedback(gameId, "Saving...");

  const result =
    assignmentService.assignCrew(
      gameId,
      select.value
    );

  if (!result.success) {
    alert(result.message);

    select.value = "";

    showAssignFeedback(gameId, "");

    return;
  }

  showAssignFeedback(gameId, "Assigned");

  setTimeout(() => {
    renderScheduleContent();
  }, 250);
}

function claimGame(gameId) {

  const result =
    assignmentService.claimGame(
      gameId,
      authService.currentCrewId()
    );

  if (!result.success) {
    alert(result.message);
    return;
  }

  renderScheduleContent();
}

function showAssignFeedback(gameId, message) {
  const feedback =
    document.getElementById(`assign-feedback-${gameId}`);

  if (feedback) {
    feedback.textContent = message;
  }
}