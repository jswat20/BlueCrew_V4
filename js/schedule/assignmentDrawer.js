// js/schedule/assignmentDrawer.js

let activeAssignmentGameId = null;

function getCrewDisplayName(member) {
  if (!member) return "Unnamed Crew Member";

  return (
    member.name ||
    member.fullName ||
    `${member.firstName || ""} ${member.lastName || ""}`.trim() ||
    member.email ||
    "Unnamed Crew Member"
  );
}

function escapeAssignmentHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAssignmentJs(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'");
}

function getAssignmentAvailability(crewId, gameDate) {
  if (!crewId || !gameDate) {
    return null;
  }

  return availabilityService.getAvailability(
    crewId,
    gameDate
  );
}

function getAssignmentAvailabilityDisplay(status) {
  const presentation = {
    available: {
      label: "Available",
      className: "availability-badge-available"
    },
    maybe: {
      label: "Maybe",
      className: "availability-badge-maybe"
    },
    unavailable: {
      label: "Unavailable",
      className: "availability-badge-unavailable"
    }
  };

  return presentation[status] || null;
}

function getCrewOptionLabel(member, gameDate) {
  const displayName = getCrewDisplayName(member);

  const status = getAssignmentAvailability(
    member.id,
    gameDate
  );

  if (status === "maybe") {
    return `${displayName} — Maybe`;
  }

  if (status === "unavailable") {
    return `${displayName} — Unavailable`;
  }

  return displayName;
}

function renderAssignmentAvailabilityBadge(
  assignment,
  gameDate
) {
  if (!assignment?.crewId) {
    return "";
  }

  const status = getAssignmentAvailability(
    assignment.crewId,
    gameDate
  );

  const display =
    getAssignmentAvailabilityDisplay(status);

  if (!display) {
    return "";
  }

  return `
    <div
      class="
        assignment-availability
        availability-badge
        ${display.className}
      "
      data-testid="assignment-availability-${escapeAssignmentHtml(
        assignment.position
      )}"
      data-availability="${escapeAssignmentHtml(status)}"
    >
      ${escapeAssignmentHtml(display.label)}
    </div>
  `;
}

function openAssignmentDrawer(gameId) {
  const game = gameService.getById(gameId);

  if (!game) {
    toastService.show("Game not found.");
    return;
  }

  activeAssignmentGameId = gameId;

  if (window.qaService) {
    qaService.openDrawer(gameId);
    qaService.logAction("Open Assignment Drawer");
  }

  const result = crewBuilderService.createDraft(game);

  if (!result.success) {
    toastService.show(result.message);
    return;
  }

  renderAssignmentDrawer();
}

// Backward compatibility for older buttons
function openAssignDrawer(gameId) {
  openAssignmentDrawer(gameId);
}

function closeAssignmentDrawer() {
  crewBuilderService.discard();
  activeAssignmentGameId = null;

  if (window.qaService) {
    qaService.closeDrawer();
    qaService.logAction("Close Assignment Drawer");
  }

  const existing = document.querySelector(
    ".assignment-drawer-overlay"
  );

  if (existing) {
    existing.remove();
  }
}

function cancelCrewBuilder() {
  closeAssignmentDrawer();
}

function renderAssignmentDrawer() {
  const existing = document.querySelector(
    ".assignment-drawer-overlay"
  );

  if (existing) {
    existing.remove();
  }

  const draft = crewBuilderService.getDraft();

  if (!draft) {
    return;
  }

  const game = draft.game;
  const assignments = draft.assignments || [];

  const validation = crewBuilderService.validate();
  const issues = validation.data?.issues || [];

  const overlay = document.createElement("div");
  overlay.className = "assignment-drawer-overlay";

  overlay.innerHTML = `
    <div
      class="assignment-drawer-overlay"
      data-testid="assignment-overlay"
    >
      <div
        class="assignment-drawer"
        data-testid="assignment-drawer"
      >
        <div class="assignment-drawer-header">
          <div>
            <h2 data-testid="assignment-title">
              Build Crew
            </h2>

            <p data-testid="assignment-game-summary">
              ${formatDate(game.date)} · ${escapeAssignmentHtml(
                game.time
              )}<br>
              ${escapeAssignmentHtml(
                game.awayTeam
              )} @ ${escapeAssignmentHtml(game.homeTeam)}
            </p>
          </div>

          <button
            class="drawer-close-btn"
            data-testid="assignment-close"
            onclick="cancelCrewBuilder()"
          >
            ×
          </button>
        </div>

        ${renderCrewBuilderValidation(issues)}

        <div
          class="assignment-drawer-body"
          data-testid="assignment-body"
        >
          ${assignments
            .map(assignment =>
              renderCrewBuilderSlot(
                assignment,
                game
              )
            )
            .join("")}
        </div>

        <div
          class="assignment-drawer-footer"
          data-testid="assignment-footer"
        >
          <button
            class="button button-secondary secondary-btn"
            data-testid="assignment-autofill"
            onclick="autoFillCrewDraft()"
          >
            Auto Fill Crew
          </button>

          <button
            class="button button-secondary secondary-btn"
            data-testid="assignment-cancel"
            onclick="cancelCrewBuilder()"
          >
            Cancel
          </button>

          <button
            class="button button-primary primary-btn"
            data-testid="assignment-save"
            onclick="saveCrewDraft()"
          >
            Save Crew
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
}

function renderCrewBuilderSlot(
  assignment,
  game
) {
  const gameDate = game.date;
  const crewMembers = crewService
    .getAll()
    .filter(member => member.active !== false);

  const crewOptions = crewMembers
    .map(member => {
      const optionLabel = getCrewOptionLabel(
        member,
        gameDate
      );

      const selected =
        String(member.id) ===
        String(assignment.crewId);

      return `
        <option
          value="${escapeAssignmentHtml(member.id)}"
          data-availability="${escapeAssignmentHtml(
            getAssignmentAvailability(
              member.id,
              gameDate
            ) || "available"
          )}"
          ${selected ? "selected" : ""}
        >
          ${escapeAssignmentHtml(optionLabel)}
        </option>
      `;
    })
    .join("");

  const position = escapeAssignmentHtml(
    assignment.position
  );

  const assignmentId = escapeAssignmentJs(
    assignment.id
  );

  const lockedLabel = assignment.locked
    ? `
      <span
        class="slot-lock-label"
        data-testid="assignment-locked-${position}"
      >
        Locked
      </span>
    `
    : "";

  return `
    <div
      class="
        crew-builder-slot
        ${assignment.locked ? "locked" : ""}
      "
      data-testid="assignment-slot-${position}"
    >
      <div
        class="crew-builder-slot-info"
        data-testid="assignment-slot-info-${position}"
      >
        <strong>${position}</strong>
        ${lockedLabel}
      </div>

      <div
        class="crew-builder-slot-controls"
        data-testid="assignment-slot-controls-${position}"
      >
        <select
          data-testid="assignment-${position}"
          ${assignment.locked ? "disabled" : ""}
          onchange="updateDraftAssignment(
            '${assignmentId}',
            this.value
          )"
        >
          <option value="">
            Needs crew member
          </option>

          ${crewOptions}
        </select>

        ${renderAssignmentAvailabilityBadge(
          assignment,
          gameDate
        )}

        <button
          class="button button-secondary button-compact secondary-btn small-btn"
          data-testid="assignment-lock-${position}"
          onclick="toggleAssignmentLock(
            '${assignmentId}'
          )"
        >
          ${assignment.locked ? "Unlock" : "Lock"}
        </button>
      </div>
${renderAssignmentRecommendation(
    assignment,
    crewBuilderService.getDraft().game
)}
      </div>
  `;
}
function getAssignmentRecommendationAvailability(
  recommendation
) {
  return (
    recommendation.dateAvailability ||
    recommendation.availability ||
    (
      recommendation.available === false
        ? "unavailable"
        : "available"
    )
  );
}

function getAssignmentRecommendationWorkload(
  recommendation
) {
  return (
    recommendation.workloadCount ??
    recommendation.workload ??
    0
  );
}

function getAssignmentRecommendationConflictLabel(
  recommendation
) {
  return recommendation.conflict
    ? "Conflict"
    : "No conflict";
}

function getAssignmentRecommendationAvailabilityLabel(
  recommendation
) {
  const availability =
    getAssignmentRecommendationAvailability(
      recommendation
    );

  switch (availability) {
    case "available":
      return "Available";

    case "maybe":
      return "Maybe";

    case "unavailable":
      return "Unavailable";

    default:
      return String(availability || "Unknown");
  }
}

function getAssignedCrewIdsForRecommendation(
  assignment
) {
  const draft = crewBuilderService.getDraft();

  if (!draft) {
    return [];
  }

  return draft.assignments
    .filter(item =>
      String(item.id) !== String(assignment.id) &&
      item.crewId
    )
    .map(item => String(item.crewId));
}

function renderAssignmentRecommendationReasons(
  recommendation,
  assignment,
  rank
) {
  const position = escapeAssignmentHtml(
    assignment.position
  );

  const reasonsTestId =
    rank === 1
      ? `recommendation-reasons-${position}`
      : `recommendation-reasons-${position}-${rank}`;

  const reasons =
    Array.isArray(recommendation.reasons)
      ? recommendation.reasons.filter(Boolean)
      : [];

  if (!reasons.length) {
    return `
      <div
        class="recommendation-reasons"
        data-testid="${reasonsTestId}"
      >
        No additional recommendation notes.
      </div>
    `;
  }

  return `
    <ul
      class="recommendation-reasons"
      data-testid="${reasonsTestId}"
    >
      ${reasons
        .map(reason => `
          <li>
            ${escapeAssignmentHtml(reason)}
          </li>
        `)
        .join("")}
    </ul>
  `;
}
function renderAssignmentRecommendationExplanation(
  recommendation,
  assignment,
  rank
) {
  const position = escapeAssignmentHtml(
    assignment.position
  );

  const explanation =
    recommendation.explanation || {};

  const explanationTestId =
    rank === 1
      ? `recommendation-explanation-${position}`
      : `recommendation-explanation-${position}-${rank}`;

  const availability =
    getAssignmentRecommendationAvailabilityLabel(
      recommendation
    );

  const workload =
    explanation.workload ??
    recommendation.workload ??
    recommendation.workloadCount ??
    0;

  const conflictLabel =
    explanation.conflict
      ? "Scheduling conflict detected"
      : "No scheduling conflicts";

  return `
    <div
      class="recommendation-explanation"
      data-testid="${explanationTestId}"
    >
      <strong class="recommendation-explanation-title">
        Why this recommendation
      </strong>

      <div class="recommendation-explanation-summary">
        Ranked by recommendation score for this assignment.
      </div>

      <div class="recommendation-explanation-details">
        <span>
          Availability:
          ${escapeAssignmentHtml(availability)}
        </span>

        <span>
          Workload:
          ${escapeAssignmentHtml(workload)}
        </span>

        <span>
          ${escapeAssignmentHtml(conflictLabel)}
        </span>
      </div>
    </div>
  `;
}
function renderAssignmentRecommendationHighlights(
  recommendation,
  assignment,
  rank
) {
  const position = escapeAssignmentHtml(
    assignment.position
  );

  const highlights =
    Array.isArray(
      recommendation.explanation?.highlights
    )
      ? recommendation.explanation.highlights
      : [];

  const highlightsTestId =
    rank === 1
      ? `recommendation-highlights-${position}`
      : `recommendation-highlights-${position}-${rank}`;

  if (!highlights.length) {
    return "";
  }

  return `
    <ul
      class="recommendation-highlights"
      data-testid="${highlightsTestId}"
    >
      ${highlights
        .map((highlight, index) => `
          <li
            class="
              recommendation-highlight
              recommendation-highlight-${escapeAssignmentHtml(
                highlight.type
              )}
            "
            data-testid="${highlightsTestId}-${index + 1}"
            data-highlight-type="${escapeAssignmentHtml(
              highlight.type
            )}"
            data-highlight-priority="${escapeAssignmentHtml(
              highlight.priority
            )}"
          >
            ${escapeAssignmentHtml(
              highlight.label
            )}
          </li>
        `)
        .join("")}
    </ul>
  `;
}
function renderAssignmentRecommendationCard(
  recommendation,
  assignment,
  rank
) {
  const position = escapeAssignmentHtml(
    assignment.position
  );

  const assignmentId = escapeAssignmentJs(
    assignment.id
  );

  const crewId = escapeAssignmentJs(
    recommendation.crewId
  );

  /*
   * Preserve the original DOM contract for recommendation #1.
   *
   * Recommendations #2 and #3 receive ranked selectors.
   */
  const cardTestId =
    `assignment-recommendation-card-${position}-${rank}`;

  const nameTestId =
    rank === 1
      ? `recommendation-name-${position}`
      : `recommendation-name-${position}-${rank}`;

  const scoreTestId =
    rank === 1
      ? `recommendation-score-${position}`
      : `recommendation-score-${position}-${rank}`;

  const availabilityTestId =
    rank === 1
      ? `recommendation-availability-${position}`
      : `recommendation-availability-${position}-${rank}`;

  const conflictTestId =
    rank === 1
      ? `recommendation-conflict-${position}`
      : `recommendation-conflict-${position}-${rank}`;

  const workloadTestId =
    rank === 1
      ? `recommendation-workload-${position}`
      : `recommendation-workload-${position}-${rank}`;

  const useButtonTestId =
    rank === 1
      ? `use-recommendation-${position}`
      : `use-recommendation-${position}-${rank}`;

  const recommendationName =
    recommendation.name ||
    getCrewDisplayName(
      recommendation.member
    );

  return `
    <div
      class="assignment-recommendation-card"
      data-testid="${cardTestId}"
      data-recommendation-rank="${rank}"
      data-crew-id="${escapeAssignmentHtml(
        recommendation.crewId
      )}"
      data-score="${escapeAssignmentHtml(
        recommendation.score
      )}"
    >
      <div class="recommendation-card-header">
        <div>
          <span
            class="recommendation-rank"
            data-testid="recommendation-rank-${position}-${rank}"
          >
            #${rank}
          </span>

          <strong
            class="recommendation-name"
            data-testid="${nameTestId}"
          >
            ${escapeAssignmentHtml(
              recommendationName
            )}
          </strong>
        </div>

        <span
          class="recommendation-score"
          data-testid="${scoreTestId}"
        >
          Score: ${escapeAssignmentHtml(
            recommendation.score
          )}
        </span>
      </div>

            <div class="recommendation-metrics">
        <span
          data-testid="${availabilityTestId}"
        >
          Availability:
          ${escapeAssignmentHtml(
            getAssignmentRecommendationAvailabilityLabel(
              recommendation
            )
          )}
        </span>

        <span
          data-testid="${conflictTestId}"
        >
          Conflict:
          ${escapeAssignmentHtml(
            getAssignmentRecommendationConflictLabel(
              recommendation
            )
          )}
        </span>

        <span
          data-testid="${workloadTestId}"
        >
          Workload:
          ${escapeAssignmentHtml(
            getAssignmentRecommendationWorkload(
              recommendation
            )
          )}
        </span>
      </div>

${renderAssignmentRecommendationExplanation(
  recommendation,
  assignment,
  rank
)}

${renderAssignmentRecommendationHighlights(
  recommendation,
  assignment,
  rank
)}

${renderAssignmentRecommendationReasons(
  recommendation,
  assignment,
  rank
)}
      <button
        class="
          button
          button-secondary
          button-compact
          secondary-btn
          small-btn
          recommendation-use-btn
        "
        data-testid="${useButtonTestId}"
        data-recommendation-button-rank="${rank}"
        ${assignment.locked ? "disabled" : ""}
        onclick="updateDraftAssignment(
          '${assignmentId}',
          '${crewId}'
        )"
      >
        Use Recommendation
      </button>
    </div>
  `;
}

function renderAssignmentRecommendation(
  assignment,
  game
) {
  if (
    typeof recommendationService === "undefined" ||
    typeof recommendationService
      .getRecommendedCrewForGame !== "function"
  ) {
    return "";
  }

  const assignedCrewIds =
    getAssignedCrewIdsForRecommendation(
      assignment
    );

  const recommendations =
    (
      recommendationService
        .getRecommendedCrewForGame(
          game,
          {
            position: assignment.position,
            assignedCrewIds
          }
        ) || []
    )
      .filter(recommendation =>
        recommendation?.crewId &&
        !assignedCrewIds.includes(
          String(recommendation.crewId)
        )
      )
      .slice(0, 3);

  if (!recommendations.length) {
    return "";
  }

  const position = escapeAssignmentHtml(
    assignment.position
  );

  const firstRecommendation =
    recommendations[0];

  return `
    <div
      class="assignment-recommendation"
      data-testid="assignment-recommendation-${position}"
      data-crew-id="${escapeAssignmentHtml(
        firstRecommendation.crewId
      )}"
      data-score="${escapeAssignmentHtml(
        firstRecommendation.score
      )}"
    >
      <div class="recommendation-title">
        ⭐ Top Recommendations
      </div>

      <div
        class="assignment-recommendation-list"
        data-testid="assignment-recommendation-list-${position}"
      >
        ${recommendations
          .map((recommendation, index) =>
            renderAssignmentRecommendationCard(
              recommendation,
              assignment,
              index + 1
            )
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderCrewBuilderValidation(issues) {
  if (!issues.length) {
    return `
      <div
        class="drawer-validation success"
        data-testid="assignment-validation"
      >
        ✅ Crew is ready to save.
      </div>
    `;
  }

  return `
    <div
      class="drawer-validation"
      data-testid="assignment-validation"
    >
      ${issues
        .map(
          issue => `
            <div
              class="validation-${escapeAssignmentHtml(
                issue.severity
              )}"
              data-testid="assignment-validation-${escapeAssignmentHtml(
                issue.severity
              )}"
            >
              ${
                issue.severity === "error"
                  ? "⛔"
                  : "⚠️"
              }

              ${escapeAssignmentHtml(issue.message)}
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function useAssignmentRecommendation(
  assignmentId,
  crewId
) {
  updateDraftAssignment(
    assignmentId,
    crewId
  );
}

function getDraftAssignmentEvaluation(
  assignmentId,
  crewId
) {
  if (!crewId) {
    return null;
  }

  const draft = crewBuilderService.getDraft();

  if (!draft?.game) {
    return null;
  }

  const assignment = draft.assignments.find(
    item => String(item.id) === String(assignmentId)
  );

  if (!assignment) {
    return null;
  }

  return availabilityService.canAssign(
    crewId,
    draft.game,
    assignment.position
  );
}

function updateDraftAssignment(
  assignmentId,
  crewId
) {
  const evaluation =
    getDraftAssignmentEvaluation(
      assignmentId,
      crewId
    );

  const result =
    crewBuilderService.updateAssignment(
      assignmentId,
      crewId
    );

  if (window.qaService) {
    qaService.setAssignment(assignmentId);
    qaService.logAction(
      "Update Draft Assignment"
    );
  }

  if (!result.success) {
    toastService.show(result.message);
    return;
  }

  const draft = crewBuilderService.getDraft();
  const gameDate = draft?.game?.date || null;
  const dateAvailability =
    crewId && gameDate
      ? availabilityService.getAvailability(
          crewId,
          gameDate
        )
      : null;

  if (dateAvailability === "unavailable") {
    toastService.show(
      "Assignment warning: Crew member is marked unavailable for this date."
    );
  } else if (dateAvailability === "maybe") {
    toastService.show(
      "Assignment note: Crew member is marked maybe for this date."
    );
  }

  renderAssignmentDrawer();
}

function toggleAssignmentLock(assignmentId) {
  const draft = crewBuilderService.getDraft();

  if (!draft) {
    toastService.show("No active crew draft.");
    return;
  }

  const assignment = draft.assignments.find(
    item => item.id === assignmentId
  );

  if (!assignment) {
    toastService.show(
      "Assignment slot not found."
    );

    return;
  }

  assignment.locked = !assignment.locked;

  if (window.qaService) {
    qaService.setAssignment(assignmentId);
    qaService.logAction(
      "Toggle Assignment Lock"
    );
  }

  renderAssignmentDrawer();
}

function autoFillCrewDraft() {
  const result = crewBuilderService.autoFill();

  if (window.qaService) {
    qaService.logAction("Auto Fill Crew");
  }

  toastService.show(result.message);

  renderAssignmentDrawer();
}

function saveCrewDraft() {
  const returnGameId = activeAssignmentGameId;
  const returnToGameHub =
    typeof currentPage !== "undefined" &&
    currentPage === "game-hub" &&
    Boolean(returnGameId);

  const result = crewBuilderService.commit();

  if (window.qaService) {
    qaService.logAction("Save Crew");
  }

  toastService.show(result.message);

  if (!result.success) {
    renderAssignmentDrawer();
    return;
  }

  const existing = document.querySelector(
    ".assignment-drawer-overlay"
  );

  if (existing) {
    existing.remove();
  }

  activeAssignmentGameId = null;

  if (window.qaService) {
    qaService.closeDrawer();
  }

  if (
    returnToGameHub &&
    typeof renderPage === "function"
  ) {
    renderPage("game-hub", {
      gameId: returnGameId
    });
  } else if (
    typeof renderScheduleContent === "function"
  ) {
    renderScheduleContent();
  } else if (
    typeof renderPage === "function"
  ) {
      if (
    typeof refreshWorkbenchIfActive === "function"
  ) {
    refreshWorkbenchIfActive();
  }

renderPage("schedule");
  }
}
