// js/services/crewBuilderService.js

const crewBuilderService = (() => {
  let draft = null;

  function cloneAssignment(assignment) {
    return {
      id: assignment.id,
      gameId: assignment.gameId,
      position: assignment.position,
      crewId: assignment.crewId || "",
      status: assignment.status || "needs_assignment",
      locked: Boolean(assignment.locked),
      claimedBy: assignment.claimedBy || ""
    };
  }

  function createDraft(game) {
    if (!game) {
      return {
        success: false,
        message: "No game provided.",
        data: null
      };
    }

    const assignments =
  typeof assignmentService.getAssignmentsForGame === "function"
    ? assignmentService.getAssignmentsForGame(game.id)
    : game.assignments || [];

    draft = {
      gameId: game.id,
      game: { ...game },
      assignments: assignments.map(cloneAssignment),
      originalAssignments: assignments.map(cloneAssignment)
    };

    return {
      success: true,
      message: "Crew draft created.",
      data: draft
    };
  }

  function getDraft() {
    return draft;
  }

  function updateAssignment(assignmentId, crewId) {
    if (!draft) {
      return {
        success: false,
        message: "No active crew draft.",
        data: null
      };
    }

    const assignment = draft.assignments.find(item => item.id === assignmentId);

    if (!assignment) {
      return {
        success: false,
        message: "Assignment slot not found.",
        data: draft
      };
    }

    if (assignment.locked) {
      return {
        success: false,
        message: "This assignment slot is locked.",
        data: draft
      };
    }

    assignment.crewId = crewId || "";
    assignment.status = crewId ? "assigned" : "needs_assignment";
    assignment.claimedBy = "";

    return {
      success: true,
      message: "Draft assignment updated.",
      data: draft
    };
  }

  function validate() {
  if (!draft) {
    return {
      success: false,
      message: "No active crew draft.",
      data: null
    };
  }

  const issues = [];

  // Duplicate crew members
  const usedCrew = new Map();

  draft.assignments.forEach(assignment => {
    if (!assignment.crewId) return;

    if (usedCrew.has(assignment.crewId)) {
      const crew = crewService.getById(assignment.crewId);

      issues.push({
        severity: "error",
        type: "duplicate",
        assignmentId: assignment.id,
        message:
          `${getCrewDisplayName(crew)} is assigned to multiple positions.`
      });
    }

    usedCrew.set(assignment.crewId, assignment.id);
  });

  // Missing assignments
  draft.assignments.forEach(assignment => {
    if (!assignment.crewId) {
      issues.push({
        severity: "warning",
        type: "missing",
        assignmentId: assignment.id,
        message:
          `${assignment.position} still needs an official.`
      });
    }
  });

  // Inactive officials
  draft.assignments.forEach(assignment => {
    if (!assignment.crewId) return;

    const crew = crewService.getById(assignment.crewId);

    if (crew && crew.active === false) {
      issues.push({
        severity: "warning",
        type: "inactive",
        assignmentId: assignment.id,
        message:
          `${getCrewDisplayName(crew)} is inactive.`
      });
    }
  });

  // Scheduling conflicts
  if (
    typeof conflictService !== "undefined" &&
    typeof conflictService.hasConflict === "function"
  ) {
    draft.assignments.forEach(assignment => {
      if (!assignment.crewId) return;

      if (conflictService.hasConflict(assignment.crewId, draft.game)) {
        const crew = crewService.getById(assignment.crewId);

        issues.push({
          severity: "error",
          type: "conflict",
          assignmentId: assignment.id,
          message:
            `${getCrewDisplayName(crew)} has a scheduling conflict.`
        });
      }
    });
  }

  return {
    success: !issues.some(i => i.severity === "error"),
    message:
      issues.length
        ? "Crew validation completed."
        : "Crew is ready to save.",
    data: {
      issues
    }
  };
}
  function commit() {
  if (!draft) {
    return {
      success: false,
      message: "No active crew draft to save.",
      data: null
    };
  }

  const validation = validate();

  if (!validation.success) {
    return {
      success: false,
      message: "Crew could not be saved because validation failed.",
      data: validation.data
    };
  }

  const results = [];

  for (const assignment of draft.assignments) {
    const result = assignmentService.assignToAssignment(
      draft.gameId,
      assignment.id,
      assignment.crewId || ""
    );

    results.push(result);

    if (!result.success) {
      return {
        success: false,
        message: result.message || "Crew could not be saved.",
        data: {
          failedAssignment: assignment,
          results
        }
      };
    }
  }

  const savedDraft = { ...draft };

  discard();

  return {
    success: true,
    message: "Crew saved successfully.",
    data: savedDraft
  };
}

  function discard() {
    draft = null;

    return {
      success: true,
      message: "Crew draft discarded.",
      data: null
    };
  }

  function autoFill() {
    if (!draft) {
      return {
        success: false,
        message: "No active crew draft.",
        data: null
      };
    }

    if (
      typeof recommendationService === "undefined" ||
      typeof recommendationService.getRecommendedCrewForGame !== "function"
    ) {
      return {
        success: false,
        message: "Recommendation service is not available.",
        data: draft
      };
    }

    const recommendations =
      recommendationService.getRecommendedCrewForGame(draft.game) || [];

    const availableCrew = recommendations
      .filter(item =>
        item.crewId &&
        item.active !== false &&
        item.conflict !== true &&
        item.eligible !== false
      )
      .map(item => item.crewId);

    const usedCrewIds = new Set(
      draft.assignments
        .filter(item => item.crewId)
        .map(item => item.crewId)
    );

    draft.assignments.forEach(assignment => {
      if (assignment.locked || assignment.crewId) return;

      const nextCrewId = availableCrew.find(crewId => !usedCrewIds.has(crewId));

      if (!nextCrewId) return;

      assignment.crewId = nextCrewId;
      assignment.status = "assigned";
      assignment.claimedBy = "";

      usedCrewIds.add(nextCrewId);
    });

    return {
      success: true,
      message: "Crew draft auto-filled.",
      data: draft
    };
  }

  return {
    createDraft,
    getDraft,
    updateAssignment,
    validate,
    commit,
    discard,
    autoFill
  };
})();