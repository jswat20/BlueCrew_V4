// js/schedule/assignmentEngine.js

function getAssignmentWarnings(game, selectedCrewId) {
  const warnings = [];

  if (!game) {
    return [
      {
        type: "info",
        message: "Game could not be found."
      }
    ];
  }

  if (!selectedCrewId) {
    return [
      {
        type: "info",
        message: "No crew selected."
      }
    ];
  }

  const selectedCrew =
    crewService.getById(selectedCrewId);

  if (!selectedCrew) {
    return [
      {
        type: "info",
        message: "Selected crew member could not be found."
      }
    ];
  }

  const eligibilityWarning =
    getCrewEligibilityWarning(selectedCrew, game);

  if (eligibilityWarning) {
    warnings.push(eligibilityWarning);
  }

  const sameTimeConflict =
    recommendationService.hasSameTimeConflict(
      game,
      selectedCrewId
    );

  if (sameTimeConflict) {
    warnings.push({
      type: "conflict",
      blocking: true,
      message:
        `${crewService.getName(selectedCrew)} is already assigned at this time.`
    });
  }

  const workload =
    workloadService.getCrewWorkloadForDate(
      selectedCrewId,
      game.date
    );

  const otherGameCount =
    Math.max(workload.count - 1, 0);

  if (otherGameCount > 0) {
    warnings.push({
      type: "notice",
      message:
        `${crewService.getName(selectedCrew)} already has ${otherGameCount} other game(s) this day.`
    });
  }

  if (!crewService.isActive(selectedCrew)) {
    warnings.push({
      type: "notice",
      message:
        `${crewService.getName(selectedCrew)} is currently inactive.`
    });
  }

  if (warnings.length === 0) {
    warnings.push({
      type: "success",
      message: "No assignment warnings."
    });
  }

  return warnings;
}

function getCrewEligibilityWarning(member, game) {
  if (!member || !game) return null;

  if (!crewService.canWorkLevel(member, game.level)) {
    return {
      type: "notice",
      message:
        `${crewService.getName(member)} is not listed for ${game.level}.`
    };
  }

  return null;
}

function getGameCardWarnings(game) {
  const warnings = [];

  if (!assignmentService.isAssigned(game)) {
    warnings.push({
      type: "danger",
      message: "Needs assignment"
    });

    return warnings;
  }

  const assignedCrew =
    crewService.getById(game.crewId);

  const eligibilityWarning =
    getCrewEligibilityWarning(assignedCrew, game);

  if (eligibilityWarning) {
    warnings.push(eligibilityWarning);
  }

  const sameTimeConflict =
    recommendationService.hasSameTimeConflict(
      game,
      game.crewId
    );

  if (sameTimeConflict) {
    warnings.push({
      type: "danger",
      message: `Double-booked at ${game.time}`
    });
  }

  const workload =
    workloadService.getCrewWorkloadForDate(
      game.crewId,
      game.date
    );

  if (workload && workload.count >= 2) {
    warnings.push({
      type:
        workload.level === "overloaded"
          ? "danger"
          : "notice",
      message: workload.label
    });
  }

  return warnings;
}

function getGameCrewWorkload(game) {
  if (!game || !game.crewId || !game.date) {
    return null;
  }

  return workloadService.getCrewWorkloadForDate(
    game.crewId,
    game.date
  );
}

function renderAssignmentWarnings(warnings) {
  if (!Array.isArray(warnings) || warnings.length === 0) {
    return `
      <p class="no-warnings">
        No warnings for this assignment.
      </p>
    `;
  }

  return warnings.map(warning => `
    <div class="assign-warning ${warning.type || "info"}">
      ${warning.message || "Review this assignment."}
    </div>
  `).join("");
}