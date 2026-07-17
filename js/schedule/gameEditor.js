// js/schedule/gameEditor.js

function openGameEditor(gameId = null) {
  const isEditing = gameId !== null && gameId !== undefined;
  const game = isEditing ? gameService.getById(gameId) : createBlankGame();

  if (!game) return;

  closeGameEditor();

  const overlay = document.createElement("div");
  overlay.id = "game-editor-overlay";

  overlay.innerHTML = `
    <div class="assign-drawer-backdrop" onclick="closeGameEditor()"></div>

<aside class="assign-drawer" data-testid="game-editor">
      <div class="assign-drawer-header">
        <h2>${isEditing ? "Edit Game" : "Add Game"}</h2>
        <button
          class="button button-link button-compact"
          aria-label="Close game editor"
          onclick="closeGameEditor()"
        >×</button>
      </div>

      ${renderGameEditorForm(game, isEditing)}
    </aside>
  `;

  document.body.appendChild(overlay);
}

function editGame(gameId) {
  openGameEditor(gameId);
}

function createBlankGame() {
  return {
    id: "",
    date: new Date().toISOString().split("T")[0],
    time: "6:00 PM",
    field: "Field 1",
    level: "12U",
    gameType: "single",
    awayTeam: "",
    homeTeam: "",
    crewId: "",
    assignmentStatus: AssignmentStatus.NEEDS_ASSIGNMENT,
    assignmentMode: AssignmentMode.ADMIN_ONLY,
    claimedBy: "",
    assignments: []
  };
}

function renderGameEditorForm(game, isEditing) {
  return `
    <label>Date</label>
    <input id="edit-date" data-testid="game-date-input" type="date" value="${game.date || ""}" />

    <label>Time</label>
    <select id="edit-time" data-testid="game-time-input">
      ${renderTimeOptions(game.time)}
    </select>

    <label>Field</label>
    <select id="edit-field" data-testid="game-field-input">
      ${renderOptionList(getFieldOptions(), game.field)}
    </select>

    <label>Level</label>
    <select id="edit-level" data-testid="game-level-input">
      ${renderOptionList(getLevelOptions(), game.level)}
    </select>

    <label>Game Type</label>
    <select id="edit-game-type" data-testid="game-type-input">
      ${renderGameTypeOptions(game.gameType)}
    </select>

    <label>Away Team</label>
    <input
      id="edit-away-team"
      data-testid="game-away-team-input"
      type="text"
      value="${game.awayTeam || ""}"
      placeholder="Away Team"
    />

    <label>Home Team</label>
    <input
      id="edit-home-team"
      data-testid="game-home-team-input"
      type="text"
      value="${game.homeTeam || ""}"
      placeholder="Home Team"
    />

    ${
      isEditing
        ? renderExistingGameAssignmentSection(game)
        : renderNewGameAssignmentNote()
    }

    <div class="assign-drawer-actions">
      <button
        class="button button-primary"
        data-testid="save-game-button"
        onclick="saveGameEditor('${game.id || ""}', ${isEditing})">
        ${isEditing ? "Save Changes" : "Create Game"}
      </button>

      <button class="button button-secondary secondary" data-testid="cancel-game-button" onclick="closeGameEditor()">
        Cancel
      </button>

      ${
        isEditing
          ? `
              ${
                gameService.getStatus(game) ===
                  "scheduled"
                  ? `
                      <button
                        class="button button-secondary"
                        type="button"
                        data-testid="postpone-game-button"
                        onclick="postponeGameFromEditor('${game.id}')"
                      >
                        Postpone
                      </button>

                      <button
                        class="button button-danger danger-btn"
                        type="button"
                        data-testid="cancel-scheduled-game-button"
                        onclick="cancelGameFromEditor('${game.id}')"
                      >
                        Cancel Game
                      </button>
                    `
                  : ""
              }

              <button
                class="button button-danger danger-btn"
                type="button"
                data-testid="delete-game-button"
                onclick="deleteGame('${game.id}')"
              >
                Delete
              </button>
            `
          : ""
      }
    </div>
  `;
}
function renderExistingGameAssignmentSection(game) {
  return `
    <hr />

    <label>Assignment Status</label>
    <div class="assignment-status-preview">
      ${
        typeof renderAssignmentStatusBadge === "function"
          ? renderAssignmentStatusBadge(game)
          : ""
      }
    </div>

    <p class="game-editor-note">
      Crew assignments are managed from the assignment drawer.
    </p>
  `;
}

function renderNewGameAssignmentNote() {
  return `
    <hr />

    <p class="game-editor-note">
      Assignment slots will be created automatically from the selected game type.
    </p>
  `;
}

function saveGameEditor(gameId, isEditing) {
  const updates = readGameEditorValues();

  if (!validateGameEditorValues(updates)) return;

  const result = isEditing
    ? updateExistingGame(gameId, updates)
    : createNewGame(updates);

  if (!result || !result.success) {
    toastService.error(result?.message || "Unable to save game.");
    return;
  }

  const savedGame = result.data || result.game || gameService.getById(gameId);

  if (savedGame && typeof assignmentService !== "undefined") {
    assignmentService.normalizeGame(savedGame);
  }

  toastService.success(
    isEditing ? "Game updated successfully." : "Game created successfully."
  );

  closeGameEditor();
  refreshAfterGameEditorSave();
}

function readGameEditorValues() {
  return {
    date: document.getElementById("edit-date")?.value || "",
    time: document.getElementById("edit-time")?.value || "",
    field: document.getElementById("edit-field")?.value || "",
    level: document.getElementById("edit-level")?.value || "",
    gameType: document.getElementById("edit-game-type")?.value || "single",
    awayTeam: document.getElementById("edit-away-team")?.value.trim() || "",
    homeTeam: document.getElementById("edit-home-team")?.value.trim() || ""
  };
}

function validateGameEditorValues(values) {
  if (!values.date) {
    toastService.error("Choose a game date.");
    return false;
  }

  if (!values.time) {
    toastService.error("Choose a game time.");
    return false;
  }

  if (!values.awayTeam || !values.homeTeam) {
    toastService.error("Enter both teams.");
    return false;
  }

  if (values.awayTeam === values.homeTeam) {
    toastService.error("Away and home teams cannot be the same.");
    return false;
  }

  return true;
}

function createNewGame(values) {
  const game = {
    ...values,
    crewId: "",
    assignmentStatus: AssignmentStatus.NEEDS_ASSIGNMENT,
    assignmentMode: AssignmentMode.ADMIN_ONLY,
    claimedBy: "",
    assignments: []
  };

  if (typeof gameService.create === "function") {
    return gameService.create(game);
  }

  if (typeof gameService.add === "function") {
    return gameService.add(game);
  }

  return {
    success: false,
    message: "Game creation is not supported by gameService yet."
  };
}

function updateExistingGame(gameId, updates) {
  if (typeof gameService.update !== "function") {
    return {
      success: false,
      message: "Game updates are not supported by gameService."
    };
  }

  return gameService.update(gameId, updates);
}

function deleteGame(gameId) {
  const game = gameService.getById(gameId);
  if (!game) return;

  const confirmed = confirm(
    `Delete this game?\n\n${game.awayTeam || "Away"} @ ${game.homeTeam || "Home"}`
  );

  if (!confirmed) return;

  const result = gameService.delete(gameId);

  if (!result.success) {
    toastService.error(result.message || "Unable to delete game.");
    return;
  }

  toastService.success("Game deleted.");

  closeGameEditor();
  refreshAfterGameEditorSave();
}

function refreshAfterGameEditorSave() {
  if (typeof uiService !== "undefined" && typeof uiService.refreshSchedule === "function") {
    uiService.refreshSchedule();
    return;
  }

  if (typeof renderScheduleContent === "function") {
    renderScheduleContent();
    return;
  }

  if (typeof uiService !== "undefined" && typeof uiService.refreshCurrentPage === "function") {
    uiService.refreshCurrentPage();
  }
}

function closeGameEditor() {
  const existing = document.getElementById("game-editor-overlay");
  if (existing) existing.remove();
}

function renderGameTypeOptions(selectedType) {
  const selected = selectedType || "single";

  if (
    typeof gameTypeService !== "undefined" &&
    typeof gameTypeService.getAll === "function"
  ) {
    return gameTypeService.getAll().map(type => `
      <option value="${type.id}" ${type.id === selected ? "selected" : ""}>
        ${type.label}
      </option>
    `).join("");
  }

  return `
    <option value="single" ${selected === "single" ? "selected" : ""}>Single Umpire</option>
    <option value="twoMan" ${selected === "twoMan" ? "selected" : ""}>Two-Man Crew</option>
    <option value="threeMan" ${selected === "threeMan" ? "selected" : ""}>Three-Man Crew</option>
    <option value="fourMan" ${selected === "fourMan" ? "selected" : ""}>Four-Man Crew</option>
  `;
}

function renderTimeOptions(selectedTime) {
  const normalizedSelected = normalizeTimeLabel(selectedTime);
  const times = buildTimeOptions();

  return times.map(time => `
    <option value="${time}" ${time === normalizedSelected ? "selected" : ""}>
      ${time}
    </option>
  `).join("");
}

function buildTimeOptions() {
  const times = [];

  for (let hour = 7; hour <= 22; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const suffix = hour >= 12 ? "PM" : "AM";
      const displayHour = hour % 12 === 0 ? 12 : hour % 12;
      const displayMinute = String(minute).padStart(2, "0");

      times.push(`${displayHour}:${displayMinute} ${suffix}`);
    }
  }

  return times;
}

function normalizeTimeLabel(value) {
  if (!value) return "";

  if (value.includes("AM") || value.includes("PM")) {
    return value;
  }

  const [hourRaw, minuteRaw] = value.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw || 0);

  if (Number.isNaN(hour)) return value;

  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const displayMinute = String(minute).padStart(2, "0");

  return `${displayHour}:${displayMinute} ${suffix}`;
}

function renderOptionList(options, selectedValue) {
  return options.map(option => `
    <option value="${option}" ${String(option) === String(selectedValue) ? "selected" : ""}>
      ${option}
    </option>
  `).join("");
}

function getFieldOptions() {
  return getUniqueValues("field", [
    "Field 1",
    "Field 2",
    "Field 3",
    "Field 4"
  ]);
}

function getLevelOptions() {
  return getUniqueValues("level", [
    "8U",
    "10U",
    "12U",
    "14U",
    "16U",
    "18U"
  ]);
}

function getUniqueValues(key, fallback = []) {
  const values = gameService
    .getAll()
    .map(game => game[key])
    .filter(Boolean);

  return [...new Set([...fallback, ...values])].sort();
}

function refreshScheduleAfterLifecycleAction() {
  if (
    typeof closeGameEditor === "function"
  ) {
    closeGameEditor();
  }

  if (
    typeof renderPage === "function"
  ) {
    renderPage("schedule");
  }
}

function cancelGameFromEditor(gameId) {
  const confirmed =
    window.confirm(
      "Cancel this game? Assigned umpires will be notified."
    );

  if (!confirmed) {
    return;
  }

  const result =
    portalService.cancelGame(gameId);

  if (!result.success) {
    window.alert(
      result.message ||
      "Unable to cancel game."
    );
    return;
  }

  refreshScheduleAfterLifecycleAction();
}

function postponeGameFromEditor(gameId) {
  const confirmed =
    window.confirm(
      "Postpone this game? Existing assignments will remain attached."
    );

  if (!confirmed) {
    return;
  }

  const result =
    portalService.postponeGame(gameId);

  if (!result.success) {
    window.alert(
      result.message ||
      "Unable to postpone game."
    );
    return;
  }

  refreshScheduleAfterLifecycleAction();
}
