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
                game.date
              )
            )
            .join("")}
        </div>

        <div
          class="assignment-drawer-footer"
          data-testid="assignment-footer"
        >
          <button
            class="secondary-btn"
            data-testid="assignment-autofill"
            onclick="autoFillCrewDraft()"
          >
            Auto Fill Crew
          </button>

          <button
            class="secondary-btn"
            data-testid="assignment-cancel"
            onclick="cancelCrewBuilder()"
          >
            Cancel
          </button>

          <button
            class="primary-btn"
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
  gameDate
) {
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
          class="secondary-btn small-btn"
          data-testid="assignment-lock-${position}"
          onclick="toggleAssignmentLock(
            '${assignmentId}'
          )"
        >
          ${assignment.locked ? "Unlock" : "Lock"}
        </button>
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

function updateDraftAssignment(
  assignmentId,
  crewId
) {
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
    typeof renderScheduleContent === "function"
  ) {
    renderScheduleContent();
  } else if (
    typeof renderPage === "function"
  ) {
    renderPage("schedule");
  }
}