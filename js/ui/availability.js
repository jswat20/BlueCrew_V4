// js/ui/availability.js

const availabilityPageState = {
  selectedCrewId: "",
  selectedDate: "",
  selectedStatus: "available",
  selectedStartTime: "",
  selectedEndTime: "",
  editingDate: "",
  editingWindowId: ""
};

const availabilityFinderState = {
  date: "",
  time: "",
  level: "",
  hasSearched: false,
  results: []
};

function renderAvailability() {
  const crewMembers = crewService.getAll();
  const isUmpire = typeof authService !== "undefined" && authService.isUmpire();

  if (!isUmpire) {
    return renderAdminAvailabilityFinder(crewMembers);
  }

  const currentCrewId = authService.currentCrewId();
  const umpireCrew = crewMembers.filter(member => String(member.id) === String(currentCrewId));

  ensureAvailabilityPageState(umpireCrew);

  const selectedCrew = crewService.getById(
    availabilityPageState.selectedCrewId
  );

  const entries = selectedCrew
    ? availabilityService.getCrewAvailability(selectedCrew.id)
    : [];

  return `
    <section
      class="page-section availability-page"
      data-testid="availability-page"
    >
      <div class="availability-page-header">
        <div>
          <h2>Availability</h2>
          <p>
            Manage full-day availability or specific time windows.
          </p>
        </div>
      </div>

      ${
        umpireCrew.length
          ? renderAvailabilityForm(umpireCrew)
          : renderAvailabilityNoCrew()
      }

      ${
        selectedCrew
          ? renderAvailabilityList(selectedCrew, entries)
          : ""
      }
    </section>
  `;
}

function renderAdminAvailabilityFinder(crewMembers) {
  const levels = [...new Set(crewMembers.flatMap(member => member.levels || []))]
    .sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
  return `
    <section class="page-section availability-page availability-finder-page" data-testid="availability-page">
      <div class="availability-page-header"><div><h2>Available Crew Finder</h2><p>Identify active, eligible crew without changing their submitted availability.</p></div></div>
      <section class="availability-form-card" data-testid="availability-finder">
        <div class="availability-finder-grid">
          <label class="availability-field"><span>Date</span><input type="date" data-testid="availability-finder-date" value="${escapeAvailabilityHtml(availabilityFinderState.date)}" onchange="availabilityFinderState.date=this.value"></label>
          <label class="availability-field"><span>Time</span><input type="time" data-testid="availability-finder-time" value="${escapeAvailabilityHtml(availabilityFinderState.time)}" onchange="availabilityFinderState.time=this.value"></label>
          <label class="availability-field"><span>Age Eligibility</span><select data-testid="availability-finder-level" onchange="availabilityFinderState.level=this.value"><option value="">All Age Levels</option>${levels.map(level => `<option value="${escapeAvailabilityHtml(level)}" ${level === availabilityFinderState.level ? "selected" : ""}>${escapeAvailabilityHtml(level)}</option>`).join("")}</select></label>
          <button type="button" class="button button-primary" data-testid="identify-available-crew" onclick="identifyAvailableCrew()">Identify Available Crew</button>
        </div>
      </section>
      <section class="availability-finder-results" data-testid="availability-finder-results">${renderAvailabilityFinderResults(availabilityFinderState.hasSearched ? availabilityFinderState.results : null)}</section>
    </section>`;
}

function identifyAvailableCrew() {
  const { date, time, level } = availabilityFinderState;
  availabilityFinderState.hasSearched = true;
  availabilityFinderState.results = crewService.getAll()
    .filter(member => member.active !== false)
    .filter(member => !level || (member.levels || []).includes(level))
    .filter(member => !date || availabilityService.getAvailability(member.id, date, time) === "available")
    .filter(member => !date || !time || !availabilityService.evaluate(member.id, { id: "availability-finder", date, time, level }).conflict)
    .sort((a, b) => crewService.getName(a).localeCompare(crewService.getName(b)));
  renderPage("availability");
}

function renderAvailabilityFinderResults(results) {
  if (results === null) return `<div class="presentation-empty-state">Choose any useful filters, then identify available crew.</div>`;
  if (!results.length) return `<div class="presentation-empty-state" data-testid="availability-finder-empty">No available crew match these filters.</div>`;
  return `<div class="availability-finder-result-header"><h3>Available Crew</h3><span>${results.length} match${results.length === 1 ? "" : "es"}</span></div><div class="availability-finder-card-grid">${results.map(member => renderCrewCardFront(member, { testId: "availability-finder-card", className: "availability-finder-card" })).join("")}</div>`;
}

function ensureAvailabilityPageState(crewMembers) {
  if (
    availabilityPageState.selectedCrewId &&
    crewMembers.some(
      member =>
        String(member.id) ===
        String(availabilityPageState.selectedCrewId)
    )
  ) {
    return;
  }

  availabilityPageState.selectedCrewId =
    crewMembers.length
      ? String(crewMembers[0].id)
      : "";
}

function renderAvailabilityForm(crewMembers) {
  return `
    <section
      class="availability-form-card"
      data-testid="availability-form"
    >
      <div class="availability-form-grid">
        <label class="availability-field">
          <span>Crew Member</span>

          <select
            data-testid="availability-crew-select"
            onchange="handleAvailabilityCrewChange(this.value)"
          >
            ${crewMembers
              .map(member => `
                <option
                  value="${escapeAvailabilityHtml(member.id)}"
                  ${
                    String(member.id) ===
                    String(availabilityPageState.selectedCrewId)
                      ? "selected"
                      : ""
                  }
                >
                  ${escapeAvailabilityHtml(
                    crewService.getName(member)
                  )}
                </option>
              `)
              .join("")}
          </select>
        </label>

        <label class="availability-field">
          <span>Date</span>

          <input
            type="date"
            value="${escapeAvailabilityHtml(
              availabilityPageState.selectedDate
            )}"
            data-testid="availability-date-input"
            onchange="handleAvailabilityDateChange(this.value)"
          >
        </label>

        <label class="availability-field"><span>Available From <small>(optional)</small></span><input type="time" value="${escapeAvailabilityHtml(availabilityPageState.selectedStartTime)}" data-testid="availability-start-time" onchange="availabilityPageState.selectedStartTime=this.value"></label>
        <label class="availability-field"><span>Available Until <small>(optional)</small></span><input type="time" value="${escapeAvailabilityHtml(availabilityPageState.selectedEndTime)}" data-testid="availability-end-time" onchange="availabilityPageState.selectedEndTime=this.value"></label>
      </div>

      <fieldset
        class="availability-status-fieldset"
        data-testid="availability-status-options"
      >
        <legend>Status</legend>

        <div class="availability-status-options">
          ${renderAvailabilityStatusOption(
            "available",
            "Available"
          )}

          ${renderAvailabilityStatusOption(
            "maybe",
            "Maybe"
          )}

          ${renderAvailabilityStatusOption(
            "unavailable",
            "Unavailable"
          )}
        </div>
      </fieldset>

      <div
        class="availability-quick-actions"
        data-testid="availability-quick-actions"
      >
        <button
          type="button"
          data-testid="availability-weekend-unavailable"
          onclick="handleWeekendUnavailable()"
        >
          Unavailable This Weekend
        </button>

        <button
          type="button"
          data-testid="availability-next-seven-available"
          onclick="handleNextSevenAvailable()"
        >
          Available Next 7 Days
        </button>

        <button
          type="button"
          data-testid="availability-copy-previous-week"
          onclick="handleCopyPreviousWeek()"
        >
          Copy Previous Week
        </button>
      </div>

      <div class="availability-form-actions">
        <button
          type="button"
          class="primary-button"
          data-testid="availability-save"
          onclick="handleSaveAvailability()"
        >
          ${
            availabilityPageState.editingDate
              ? "Update Availability"
              : "Save Availability"
          }
        </button>

        ${
          availabilityPageState.editingDate
            ? `
              <button
                type="button"
                data-testid="availability-cancel-edit"
                onclick="handleCancelAvailabilityEdit()"
              >
                Cancel Edit
              </button>
            `
            : ""
        }
      </div>
    </section>
  `;
}

function renderAvailabilityStatusOption(status, label) {
  const checked =
    availabilityPageState.selectedStatus === status;

  return `
    <label
      class="
        availability-status-option
        availability-status-${status}
        ${checked ? "is-selected" : ""}
      "
    >
      <input
        type="radio"
        name="availability-status"
        value="${status}"
        data-testid="availability-status-${status}"
        ${checked ? "checked" : ""}
        onchange="handleAvailabilityStatusChange(this.value)"
      >

      <span>${label}</span>
    </label>
  `;
}

function renderAvailabilityNoCrew() {
  return `
    <div
      class="empty-state"
      data-testid="availability-no-crew"
    >
      There are no crew members available to manage.
    </div>
  `;
}

function renderAvailabilityList(selectedCrew, entries) {
  return `
    <section
      class="availability-list-section"
      data-testid="availability-list-section"
    >
      <div class="availability-list-header">
        <div>
          <h3>Current Availability</h3>

          <p data-testid="availability-selected-crew-name">
            ${escapeAvailabilityHtml(
              crewService.getName(selectedCrew)
            )}
          </p>
        </div>

        <span
          class="availability-entry-count"
          data-testid="availability-entry-count"
        >
          ${entries.length}
          ${entries.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      ${
        entries.length
          ? `
            <div
              class="availability-list"
              data-testid="availability-list"
            >
              ${entries
                .map(renderAvailabilityEntry)
                .join("")}
            </div>
          `
          : `
            <div
              class="empty-state"
              data-testid="availability-empty"
            >
              No availability has been entered for this crew member.
            </div>
          `
      }
    </section>
  `;
}

function renderAvailabilityEntry(entry) {
  const crewId =
    availabilityPageState.selectedCrewId;

  const assigned =
    availabilityService.hasAssignmentOnDate(
      crewId,
      entry.date
    );

  const today =
    entry.date === getAvailabilityToday();

  return `
    <article
      class="
        availability-entry-card
        ${assigned ? "is-assigned" : ""}
        ${today ? "is-today" : ""}
      "
      data-testid="availability-entry"
      data-date="${escapeAvailabilityHtml(entry.date)}"
      data-status="${escapeAvailabilityHtml(entry.status)}"
      data-assigned="${assigned}"
      data-today="${today}"
    >
      <div class="availability-entry-details">
        <strong data-testid="availability-entry-date">
          ${formatAvailabilityDate(entry.date)}
        </strong>

        <span
          class="
            availability-status-badge
            availability-status-badge-${entry.status}
          "
          data-testid="availability-entry-status"
        >
          ${formatAvailabilityStatus(entry.status)}
        </span>

        ${entry.startTime && entry.endTime ? `<span class="availability-time-window" data-testid="availability-entry-window">${formatAvailabilityTime(entry.startTime)}–${formatAvailabilityTime(entry.endTime)}</span>` : `<span class="availability-time-window">All day</span>`}

        ${
          today
            ? `
              <span
                class="availability-date-badge"
                data-testid="availability-today-badge"
              >
                Today
              </span>
            `
            : ""
        }

        ${
          assigned
            ? `
              <span
                class="availability-date-badge"
                data-testid="availability-assigned-badge"
              >
                Assigned
              </span>
            `
            : ""
        }
      </div>

      <div class="availability-entry-actions">
        ${
          assigned
            ? `
              <span
                class="availability-read-only"
                data-testid="availability-read-only-${escapeAvailabilityHtml(
                  entry.date
                )}"
              >
                Assignment protected
              </span>
            `
            : `
              <button
                type="button"
                data-testid="availability-edit-${escapeAvailabilityHtml(
                  entry.date
                )}"
                onclick="handleEditAvailability('${escapeAvailabilityJs(entry.date)}', '${escapeAvailabilityJs(entry.id || "")}')"
              >
                Edit
              </button>

              <button
                type="button"
                class="danger-button"
                data-testid="availability-remove-${escapeAvailabilityHtml(
                  entry.date
                )}"
                onclick="handleRemoveAvailability('${escapeAvailabilityJs(entry.date)}', '${escapeAvailabilityJs(entry.id || "")}')"
              >
                Remove
              </button>
            `
        }
      </div>
    </article>
  `;
}

function handleAvailabilityCrewChange(crewId) {
  availabilityPageState.selectedCrewId =
    String(crewId || "");

  resetAvailabilityEditor();

  renderPage("availability");
}

function handleAvailabilityDateChange(date) {
  availabilityPageState.selectedDate =
    String(date || "");
}

function handleAvailabilityStatusChange(status) {
  availabilityPageState.selectedStatus =
    String(status || "available");

  document
    .querySelectorAll(".availability-status-option")
    .forEach(option => {
      option.classList.remove("is-selected");
    });

  const selectedInput = document.querySelector(
    `[data-testid="availability-status-${status}"]`
  );

  selectedInput
    ?.closest(".availability-status-option")
    ?.classList.add("is-selected");
}

async function handleSaveAvailability() {
  const crewId =
    availabilityPageState.selectedCrewId;

  const dateInput = document.querySelector(
    '[data-testid="availability-date-input"]'
  );

  const selectedStatusInput = document.querySelector(
    'input[name="availability-status"]:checked'
  );

  const date =
    dateInput?.value ||
    availabilityPageState.selectedDate;

  const status =
    selectedStatusInput?.value ||
    availabilityPageState.selectedStatus;
  const startTime = document.querySelector('[data-testid="availability-start-time"]')?.value || "";
  const endTime = document.querySelector('[data-testid="availability-end-time"]')?.value || "";

  if (!crewId) {
    showAvailabilityError(
      "Choose a crew member."
    );
    return;
  }

  if (!date) {
    showAvailabilityError(
      "Choose an availability date."
    );
    return;
  }

  if ((startTime || endTime) && (!startTime || !endTime || startTime >= endTime)) {
    showAvailabilityError("Choose a valid start and end time.");
    return;
  }

  const previousStatus =
    getStoredAvailabilityStatus(
      crewId,
      date
    );

  const assigned =
    availabilityService.hasAssignmentOnDate(
      crewId,
      date
    );

  if (
    assigned &&
    status === "unavailable"
  ) {
    const confirmed =
      typeof modalService !== "undefined" &&
      typeof modalService.confirm === "function"
        ? await modalService.confirm({
            title: "Availability Conflict",
            message:
              "You are already assigned to a game on this date. Marking yourself unavailable will not remove the assignment.",
            confirmText: "Save Anyway",
            cancelText: "Keep Available",
            danger: true
          })
        : false;

    if (!confirmed) {
      return;
    }

  }

  const result =
    availabilityService.setAvailability({
      crewId,
      date,
      status,
      startTime,
      endTime,
      windowId: availabilityPageState.editingWindowId
    });

  if (!result) {
    showAvailabilityError(
      "Unable to save availability."
    );
    return;
  }

  availabilityPageState.selectedDate = "";
  availabilityPageState.selectedStatus =
    "available";
  availabilityPageState.selectedStartTime = "";
  availabilityPageState.selectedEndTime = "";
  availabilityPageState.editingDate = "";

  if (
    previousStatus !== status
  ) {
    createAvailabilityNotification({
      type:
        assigned &&
        status === "unavailable"
          ? "availability-conflict"
          : "availability-saved",
      title:
        assigned &&
        status === "unavailable"
          ? "Availability Conflict"
          : "Availability Updated",
      message:
        assigned &&
        status === "unavailable"
          ? `Availability for ${date} was changed to Unavailable, but an existing assignment remains.`
          : `Availability for ${date} was set to ${formatAvailabilityStatus(
              status
            )}.`,
      crewId,
      date
    });
  }

  showAvailabilitySuccess(
    "Availability saved."
  );

  renderPage("availability");
}

function getAvailabilityToday() {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

function addAvailabilityDays(
  date,
  dayCount
) {
  const normalized =
    String(date || "").trim();

  const value =
    new Date(`${normalized}T00:00:00Z`);

  if (Number.isNaN(value.getTime())) {
    return null;
  }

  value.setUTCDate(
    value.getUTCDate() + dayCount
  );

  return value.toISOString().slice(0, 10);
}

function getAvailabilityActionDate() {
  const input = document.querySelector(
    '[data-testid="availability-date-input"]'
  );

  return (
    input?.value ||
    availabilityPageState.selectedDate ||
    getAvailabilityToday()
  );
}

function getUpcomingSaturday(date) {
  const value =
    new Date(`${date}T00:00:00Z`);

  const day = value.getUTCDay();

  const daysUntilSaturday =
    (6 - day + 7) % 7;

  return addAvailabilityDays(
    date,
    daysUntilSaturday
  );
}

function createAvailabilityNotification({
  type,
  title,
  message,
  crewId,
  date = ""
}) {
  if (
    typeof notificationService ===
      "undefined" ||
    typeof notificationService.create !==
      "function"
  ) {
    return;
  }

  notificationService.create({
    type,
    title,
    message,
    relatedId: String(crewId || ""),
    audience: "admin",
    destination: {
      page: "availability",
      context: {
        crewId: String(crewId || ""),
        date: String(date || "")
      }
    }
  });
}

function getStoredAvailabilityStatus(
  crewId,
  date
) {
  return availabilityService
    .getCrewAvailability(crewId)
    .find(
      entry =>
        String(entry.date) ===
        String(date)
    )?.status || null;
}

function finishAvailabilityQuickAction(
  message
) {
  resetAvailabilityEditor();
  showAvailabilitySuccess(message);
  renderPage("availability");
}

function handleWeekendUnavailable() {
  const crewId =
    availabilityPageState.selectedCrewId;

  if (!crewId) {
    showAvailabilityError(
      "Choose a crew member."
    );
    return;
  }

  const actionDate =
    getAvailabilityActionDate();

  const saturday =
    getUpcomingSaturday(actionDate);

  const sunday =
    addAvailabilityDays(saturday, 1);

  const result =
    availabilityService.setAvailabilityRange({
      crewId,
      startDate: saturday,
      endDate: sunday,
      status: "unavailable"
    });

  if (!result.success) {
    showAvailabilityError(
      result.message ||
      "Unable to update weekend availability."
    );
    return;
  }

  createAvailabilityNotification({
    type: "availability-weekend",
    title: "Weekend Availability Updated",
    message:
      `${saturday} through ${sunday} was marked unavailable.`,
    crewId
  });

  finishAvailabilityQuickAction(
    "Weekend marked unavailable."
  );
}

function handleNextSevenAvailable() {
  const crewId =
    availabilityPageState.selectedCrewId;

  if (!crewId) {
    showAvailabilityError(
      "Choose a crew member."
    );
    return;
  }

  const startDate =
    getAvailabilityActionDate();

  const endDate =
    addAvailabilityDays(startDate, 6);

  const result =
    availabilityService.setAvailabilityRange({
      crewId,
      startDate,
      endDate,
      status: "available"
    });

  if (!result.success) {
    showAvailabilityError(
      result.message ||
      "Unable to update availability."
    );
    return;
  }

  createAvailabilityNotification({
    type: "availability-range",
    title: "Availability Updated",
    message:
      `${startDate} through ${endDate} was marked available.`,
    crewId
  });

  finishAvailabilityQuickAction(
    "Next 7 days marked available."
  );
}

function handleCopyPreviousWeek() {
  const crewId =
    availabilityPageState.selectedCrewId;

  if (!crewId) {
    showAvailabilityError(
      "Choose a crew member."
    );
    return;
  }

  const targetStartDate =
    getAvailabilityActionDate();

  const sourceStartDate =
    addAvailabilityDays(
      targetStartDate,
      -7
    );

  const result =
    availabilityService.copyAvailabilityWeek({
      crewId,
      sourceStartDate,
      targetStartDate
    });

  if (!result.success) {
    showAvailabilityError(
      result.message ||
      "Unable to copy availability."
    );
    return;
  }

  createAvailabilityNotification({
    type: "availability-copy",
    title: "Availability Week Copied",
    message:
      `Availability from ${sourceStartDate} was copied to the week beginning ${targetStartDate}.`,
    crewId
  });

  finishAvailabilityQuickAction(
    "Previous week copied."
  );
}

function handleEditAvailability(date, windowId = "") {
  const entry = availabilityService.getCrewAvailability(availabilityPageState.selectedCrewId).find(item => item.date === date && (!windowId || String(item.id) === String(windowId)));
  const status =
    availabilityService.getAvailability(
      availabilityPageState.selectedCrewId,
      date
    );

  availabilityPageState.selectedDate = date;
  availabilityPageState.selectedStatus =
    status || "available";
  availabilityPageState.editingDate = date;
  availabilityPageState.editingWindowId = windowId;
  availabilityPageState.selectedStartTime = entry?.startTime || "";
  availabilityPageState.selectedEndTime = entry?.endTime || "";

  renderPage("availability");
}

function handleCancelAvailabilityEdit() {
  resetAvailabilityEditor();
  renderPage("availability");
}

function handleRemoveAvailability(date, windowId = "") {
  const removed = windowId
    ? availabilityService.clearAvailabilityWindow(availabilityPageState.selectedCrewId, windowId)
    : availabilityService.clearAvailability(availabilityPageState.selectedCrewId, date);

  if (!removed) {
    showAvailabilityError(
      "Unable to remove availability."
    );
    return;
  }

  if (
    availabilityPageState.editingDate === date
  ) {
    resetAvailabilityEditor();
  }

  showAvailabilitySuccess(
    "Availability removed."
  );

  renderPage("availability");
}

function resetAvailabilityEditor() {
  availabilityPageState.selectedDate = "";
  availabilityPageState.selectedStatus =
    "available";
  availabilityPageState.editingDate = "";
  availabilityPageState.editingWindowId = "";
  availabilityPageState.editingWindowId = "";
  availabilityPageState.selectedStartTime = "";
  availabilityPageState.selectedEndTime = "";
}

function formatAvailabilityTime(value) {
  if (!value) return "";
  const [hourValue, minutes] = value.split(":");
  const hour = Number(hourValue);
  return `${hour % 12 || 12}:${minutes} ${hour >= 12 ? "PM" : "AM"}`;
}

function formatAvailabilityStatus(status) {
  const labels = {
    available: "Available",
    maybe: "Maybe",
    unavailable: "Unavailable"
  };

  return labels[status] || status;
}

function formatAvailabilityDate(date) {
  if (!date) return "";

  const parsed = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function showAvailabilitySuccess(message) {
  if (
    typeof toastService !== "undefined" &&
    typeof toastService.success === "function"
  ) {
    toastService.success(message);
  }
}

function showAvailabilityError(message) {
  if (
    typeof toastService !== "undefined" &&
    typeof toastService.error === "function"
  ) {
    toastService.error(message);
    return;
  }

  alert(message);
}

function escapeAvailabilityHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAvailabilityJs(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'");
}
