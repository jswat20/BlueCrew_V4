// js/ui/gameHub.js

function escapeGameHubText(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

let gameHubNavigationContext = {};
const pendingGameHubCrewAssignments = new Set();
const pendingGameHubDeclines = new Set();
let gameHubDeclineTrigger = null;

function formatGameHubDate(value) {
  if (!value) return "Date unavailable";
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? "Date unavailable" : parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatGameHubLongDate(value) {
  if (!value) return "Date unavailable";
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? "Date unavailable"
    : parsed.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function getGameHubPresentation(game = {}) {
  const information = game.gameInformation || {};
  return {
    matchup: game.matchup || `${game.awayTeam || "Away team unavailable"} @ ${game.homeTeam || "Home team unavailable"}`,
    date: formatGameHubDate(game.date),
    dateLong: formatGameHubLongDate(game.date),
    time: dateTimeFormattingService.formatTime12Hour(game.time, "Time unavailable"),
    complex: information.locationComplex || information.venue || game.locationComplex || "Complex unavailable",
    field: information.locationField || information.field || game.field || "Field unavailable",
    level: levelTerminologyService.format(game.level) || "Level unavailable",
    contact: organizationContactService.getGameContact(game)
  };
}

function renderGameHubAssignmentBadge(game = {}) {
  if (game.lifecycleStatus === "cancelled") {
    return `<span class="status-badge ${presentationFormattingService.getStatusBadgeClass("Cancelled")}" data-testid="game-hub-assignment-status" data-status="cancelled">Cancelled</span>`;
  }
  const status = String(game.assignmentStatus || "").toLowerCase();
  const label = game.assignmentStatusLabel || (status === "pending_approval"
    ? "Pending Approval"
    : ["needs_assignment", "open_for_claim"].includes(status)
      ? "Needs Assignment"
      : "Assigned");
  const semanticClass = presentationFormattingService.getStatusBadgeClass(label);
  return `<span class="status-badge ${semanticClass}" data-testid="game-hub-assignment-status">${escapeGameHubText(label)}</span>`;
}

function isGameHubReadOnly(game) {
  return Boolean(
    game?.isReadOnly === true ||
    game?.lifecycleStatus === "approved" ||
    game?.lifecycleStatus === "cancelled" ||
    game?.completion?.review
      ?.submittedForReview === true
  );
}

function getGameHubLifecycleLabel(game) {
  if (game?.lifecycleStatusLabel) {
    return game.lifecycleStatusLabel;
  }

  return {
    scheduled: "Scheduled",
    completed: "Completed",
    submitted: "Submitted",
    returned: "Returned",
    approved: "Approved",
    postponed: "Postponed",
    cancelled: "Cancelled"
  }[game?.lifecycleStatus] || "Scheduled";
}

function renderGameHubLifecycleBadge(game) {
  const status =
    game?.lifecycleStatus || "scheduled";
  const label = getGameHubLifecycleLabel(game);
  const semanticLabel = ["submitted", "returned"].includes(status)
    ? "Pending Approval"
    : status === "postponed"
      ? "Cancelled"
      : label;

  return `
    <span
      class="status-badge game-hub-lifecycle-badge ${presentationFormattingService.getStatusBadgeClass(semanticLabel)}"
      data-testid="game-hub-lifecycle-badge"
      data-status="${status}"
    >
      ${label}
    </span>
  `;
}

function renderGameHubLifecycleBanner(game) {
  const banners = {
    cancelled: {
      title: "Game Cancelled",
      message:
        "This game has been cancelled and is read-only."
    },
    postponed: {
      title: "Game Postponed",
      message:
        "This game has been postponed. Existing assignments remain attached."
    },
    approved: {
      title: "Game Finalized",
      message:
        "This game has been approved and is now read-only."
    }
  };

  const banner =
    banners[game?.lifecycleStatus];

  if (!banner) {
    return "";
  }

  return `
    <div
      class="card game-hub-lifecycle-banner"
      data-testid="game-hub-lifecycle-banner"
      data-status="${game.lifecycleStatus}"
      role="status"
    >
      <strong
        data-testid="game-hub-lifecycle-banner-title"
      >
        ${banner.title}
      </strong>

      <span
        data-testid="game-hub-lifecycle-banner-message"
      >
        ${banner.message}
      </span>
    </div>
  `;
}

function getUmpireOperationalStatus(game) {
  const status = game?.lifecycleStatus || "scheduled";
  if (status === "cancelled") return { label: "Cancelled", key: "cancelled" };
  if (["completed", "submitted", "returned", "approved"].includes(status)) return { label: "Completed", key: "completed" };
  if (status === "postponed") return { label: "Delayed", key: "delayed" };
  return { label: "On Time", key: "on-time" };
}

function getUmpirePositionLabel(position, game) {
  const value = String(position || "").trim();
  if (/plate/i.test(value) && Number(game?.crewSize || 1) === 1) return "Solo";
  return presentationFormattingService.formatAssignmentPosition(value, "Position unavailable");
}

function renderUmpireGameSummary(game) {
  const presentation = getGameHubPresentation(game);
  const operational = getUmpireOperationalStatus(game);
  const assigned = ["assigned", "locked"].includes(game.assignmentStatus);
  const primaryStatus = game.lifecycleStatus === "cancelled" ? "Cancelled" : "Assigned";
  const conditions = game.gameConditions || {};
  const weather = [conditions.summary, conditions.temperature, conditions.fieldStatus].filter(Boolean);
  const canDecline = assigned && !["cancelled", "completed", "submitted", "returned", "approved"].includes(game.lifecycleStatus);
  return `<section class="card presentation-card game-hub-summary game-hub-umpire-summary" data-testid="game-hub-summary" data-umpire-summary="true">
    <h2 data-testid="game-hub-matchup">${escapeGameHubText(presentation.matchup)}</h2>
    <div class="game-hub-umpire-status-row" data-testid="game-hub-umpire-status-row">
      <span class="game-hub-assignment-badge" data-assigned="${assigned}" data-status="${game.lifecycleStatus === "cancelled" ? "cancelled" : "assigned"}" data-testid="game-hub-assignment-badge">${primaryStatus}</span>
      <span class="game-hub-operational-badge" data-status="${operational.key}" data-testid="game-hub-operational-status">${operational.label}</span>
      <span class="game-hub-weather" data-testid="game-hub-weather"><small>Forecast</small><strong>${weather.length ? escapeGameHubText(weather.join(" · ")) : "Unavailable"}</strong></span>
    </div>
    <div class="game-hub-summary-details game-hub-umpire-details" data-testid="game-hub-umpire-details">
      <div data-testid="game-hub-summary-date"><span>Date</span><strong>${escapeGameHubText(presentation.date)}</strong></div>
      <div data-testid="game-hub-summary-time"><span>Time</span><strong>${escapeGameHubText(presentation.time)}</strong></div>
      ${assigned ? `<div data-testid="game-hub-summary-position"><span>Position</span><strong class="game-hub-position-badge">${escapeGameHubText(getUmpirePositionLabel(game.positions?.[0], game))}</strong></div>` : `<div><span>Position</span><strong>Position unavailable</strong></div>`}
      <div data-testid="game-hub-summary-level"><span>Level</span><strong data-testid="game-hub-level-badge">${escapeGameHubText(presentation.level)}</strong></div>
      <div data-testid="game-hub-summary-location"><span>Complex</span><strong>${escapeGameHubText(presentation.complex)}</strong></div>
      <div data-testid="game-hub-summary-field"><span>Field</span><strong>${escapeGameHubText(presentation.field)}</strong></div>
    </div>${canDecline ? `<div class="game-hub-summary-actions"><button type="button" class="button button-danger" data-testid="game-hub-decline-assignment" aria-haspopup="dialog" onclick="openGameHubDeclineDialog('${escapeGameHubText(game.id)}', this)">Decline Assignment</button></div>${renderGameHubDeclineDialog(game)}` : ""}
  </section>`;
}

function renderGameHubDeclineDialog(game) {
  const titleId = `game-hub-decline-title-${escapeGameHubText(game.id)}`;
  return `<dialog class="game-hub-crew-picker game-hub-decline-dialog" data-testid="game-hub-decline-dialog" aria-labelledby="${titleId}" onclose="restoreGameHubDeclineFocus()">
    <form method="dialog" novalidate onsubmit="event.preventDefault(); submitGameHubDecline('${escapeGameHubText(game.id)}')">
      <header><h3 id="${titleId}">Decline Assignment</h3></header>
      <div class="game-hub-decline-content">
        <label for="game-hub-decline-reason">Reason for declining</label>
        <textarea id="game-hub-decline-reason" data-testid="game-hub-decline-reason" rows="4" required aria-describedby="game-hub-decline-status"></textarea>
        <p id="game-hub-decline-status" class="form-status" data-testid="game-hub-decline-status" role="alert" aria-live="polite"></p>
      </div>
      <footer class="game-hub-picker-actions">
        <button type="button" class="button button-secondary" data-testid="game-hub-decline-cancel" onclick="this.closest('dialog').close()">Cancel</button>
        <button type="submit" class="button button-danger" data-testid="game-hub-decline-submit">Decline Assignment</button>
      </footer>
    </form>
  </dialog>`;
}

function openGameHubDeclineDialog(gameId, trigger) {
  const dialog = document.querySelector('[data-testid="game-hub-decline-dialog"]');
  if (!dialog) return;
  gameHubDeclineTrigger = trigger || document.activeElement;
  const reason = dialog.querySelector('[data-testid="game-hub-decline-reason"]');
  const status = dialog.querySelector('[data-testid="game-hub-decline-status"]');
  if (reason) reason.value = "";
  if (status) status.textContent = "";
  dialog.dataset.gameId = gameId;
  dialog.showModal();
  reason?.focus();
}

function restoreGameHubDeclineFocus() {
  gameHubDeclineTrigger?.focus?.();
  gameHubDeclineTrigger = null;
}

async function submitGameHubDecline(gameId) {
  const dialog = document.querySelector('[data-testid="game-hub-decline-dialog"]');
  const reasonInput = dialog?.querySelector('[data-testid="game-hub-decline-reason"]');
  const status = dialog?.querySelector('[data-testid="game-hub-decline-status"]');
  const submit = dialog?.querySelector('[data-testid="game-hub-decline-submit"]');
  const reason = String(reasonInput?.value || "").trim();
  if (!reason) {
    if (status) status.textContent = "Enter a reason for declining the assignment.";
    reasonInput?.focus();
    return;
  }
  if (pendingGameHubDeclines.has(gameId)) return;
  pendingGameHubDeclines.add(gameId);
  if (submit) { submit.disabled = true; submit.setAttribute("aria-busy", "true"); }
  if (status) status.textContent = "Declining assignment...";
  try {
    const result = await portalService.declineAssignment(gameId, reason);
    if (!result.success) {
      if (status) status.textContent = result.message;
      reasonInput?.focus();
      return;
    }
    dialog?.close();
    toastService?.success?.("Assignment declined. The assigner has been notified.");
    renderPage("my-schedule");
  } catch (error) {
    if (status) status.textContent = error?.message || "Assignment could not be declined.";
    reasonInput?.focus();
  } finally {
    pendingGameHubDeclines.delete(gameId);
    if (submit) { submit.disabled = false; submit.removeAttribute("aria-busy"); }
  }
}

function renderGameHubCrewNotes(game) {
  return `
    <section
      class="card game-hub-section game-hub-notes"
      data-testid="game-hub-crew-notes"
    >
      <h3>Crew Notes</h3>

      <label
        for="game-hub-crew-notes-input"
        class="muted"
      >
        Personal notes for this assignment
      </label>

      <textarea
        id="game-hub-crew-notes-input"
        class="game-hub-notes-input"
        data-testid="game-hub-crew-notes-input"
          ${isGameHubReadOnly(game) ? "readonly" : ""}
        rows="5"
        placeholder="Add reminders, questions, or pregame notes..."
      >${escapeGameHubText(game.crewNotes)}</textarea>

      <div class="game-hub-notes-footer">
        <button
          class="button"
          type="button"
          onclick="saveGameHubCrewNotes('${game.id}')"
          data-testid="game-hub-save-crew-notes"
          ${isGameHubReadOnly(game) ? "disabled" : ""}
        >
          Save Notes
        </button>

        <span
          class="muted"
          data-testid="game-hub-crew-notes-status"
          aria-live="polite"
        ></span>
      </div>
    </section>
  `;
}

function saveGameHubCrewNotes(gameId) {
  const input = document.getElementById(
    "game-hub-crew-notes-input"
  );

  const status = document.querySelector(
    '[data-testid="game-hub-crew-notes-status"]'
  );

  const result = portalService.saveCrewNotes(
    gameId,
    input ? input.value : ""
  );

  if (status) {
    status.textContent = result.message;
  }

  return result;
}

function renderGameHubChecklist(game) {
  const items =
    Array.isArray(game.gameDayChecklist)
      ? game.gameDayChecklist
      : [];

  const completedCount =
    items.filter(
      item => item.completed === true
    ).length;

  return `
    <section
      class="card game-hub-section game-hub-checklist"
      data-testid="game-hub-checklist"
    >
      <div class="game-hub-checklist-header">
        <h3>Pregame Checklist</h3>

        <span
          class="muted"
          data-testid="game-hub-checklist-progress"
        >
          ${completedCount} of ${items.length} complete
        </span>
      </div>

      <div class="game-hub-checklist-items">
        ${items
          .map(
            item => `
              <label
                class="game-hub-checklist-item"
                data-testid="game-hub-checklist-item-${item.key}"
              >
                <input
                  type="checkbox"
                  data-testid="game-hub-checklist-toggle-${item.key}"
          ${isGameHubReadOnly(game) ? "disabled" : ""}
                  ${item.completed ? "checked" : ""}
                  onchange="toggleGameHubChecklistItem('${game.id}', '${item.key}')"
                />

                <span>
                  <strong>${item.label}</strong>

                  <span class="muted">
                    ${item.detail}
                  </span>
                </span>
              </label>
            `
          )
          .join("")}
      </div>

      <div
        class="muted"
        data-testid="game-hub-checklist-status"
        aria-live="polite"
      ></div>
    </section>
  `;
}

function toggleGameHubChecklistItem(
  gameId,
  itemKey
) {
  const result =
    portalService.toggleChecklistItem(
      gameId,
      itemKey
    );

  if (result.success) {
    renderPage("game-hub", {
      gameId
    });

    return result;
  }

  const status = document.querySelector(
    '[data-testid="game-hub-checklist-status"]'
  );

  if (status) {
    status.textContent = result.message;
  }

  return result;
}


function formatGameCompletionDate(
  completionTime
) {
  if (!completionTime) {
    return {
      date: "",
      time: ""
    };
  }

  const completedAt =
    new Date(completionTime);

  if (
    Number.isNaN(completedAt.getTime())
  ) {
    return {
      date: "",
      time: ""
    };
  }

  return {
    date: completedAt.toLocaleDateString(
      undefined,
      {
        year: "numeric",
        month: "long",
        day: "numeric"
      }
    ),
    time: completedAt.toLocaleTimeString(
      undefined,
      {
        hour: "numeric",
        minute: "2-digit"
      }
    )
  };
}


function escapeGameHubReportValue(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function isGameHubReviewLocked(review) {
  const status =
    review?.reviewStatus ||
    review?.status ||
    "draft";

  return (
    status === "submitted" ||
    status === "approved"
  );
}
function getGameHubReportNotesLockAttribute(
  review
) {
  const status =
    review?.reviewStatus ||
    review?.status ||
    "draft";

  if (status === "approved") {
    return "disabled";
  }

  if (status === "submitted") {
    return "readonly";
  }

  return "";
}
function formatGameHubReviewStatus(status) {
  const labels = {
    draft: "Draft",
    submitted: "Submitted",
    approved: "Approved",
    returned: "Returned"
  };

  return labels[status] || "Draft";
}


function renderGameHubReports(
  game,
  completion
) {
  const reports =
    completion.reports || {
      incidents: false,
      ejections: false,
      protests: false,
      rainout: false,
      notes: ""
    };

  return `
    <div
      class="game-hub-reports"
      data-testid="game-hub-reports"
    >
      <h4>Game Reports</h4>

      <label
        class="game-hub-report-option"
      >
        <input
          type="checkbox"
          data-testid="game-hub-report-incidents"
          ${isGameHubReviewLocked(completion.review) ? "disabled" : ""}
          ${
            reports.incidents
              ? "checked"
              : ""
          }
        />
        Incident Report
      </label>

      <label
        class="game-hub-report-option"
      >
        <input
          type="checkbox"
          data-testid="game-hub-report-ejections"
          ${isGameHubReviewLocked(completion.review) ? "disabled" : ""}
          ${
            reports.ejections
              ? "checked"
              : ""
          }
        />
        Ejection
      </label>

      <label
        class="game-hub-report-option"
      >
        <input
          type="checkbox"
          data-testid="game-hub-report-protests"
          ${isGameHubReviewLocked(completion.review) ? "disabled" : ""}
          ${
            reports.protests
              ? "checked"
              : ""
          }
        />
        Protest
      </label>

      <label
        class="game-hub-report-option"
      >
        <input
          type="checkbox"
          data-testid="game-hub-report-rainout"
          ${isGameHubReviewLocked(completion.review) ? "disabled" : ""}
          ${
            reports.rainout
              ? "checked"
              : ""
          }
        />
        Rainout
      </label>

      <div class="form-group">
        <label
          for="game-hub-report-notes"
        >
          Additional Notes
        </label>

        <textarea
          id="game-hub-report-notes"
          data-testid="game-hub-report-notes"
${
  (
    completion.review?.reviewStatus ||
    completion.review?.status
  ) === "approved"
    ? "disabled"
    : (
        (
          completion.review?.reviewStatus ||
          completion.review?.status
        ) === "submitted"
          ? "readonly"
          : ""
      )
}          rows="4"
        >${escapeGameHubReportValue(
          reports.notes
        )}</textarea>
      </div>

      <button
        type="button"
        class="button button-primary"
        data-testid="game-hub-save-reports"
          ${isGameHubReviewLocked(completion.review) ? "disabled" : ""}
        onclick="saveGameReportsFromHub('${game.id}')"
      >
        Save Reports
      </button>

      <p
        class="form-status"
        data-testid="game-hub-reports-status"
        aria-live="polite"
      ></p>
    </div>
  `;
}


function renderGameHubReview(
  game,
  completion,
  reviewMode = false
) {
  const review =
    completion.review || {
      reviewStatus: "draft",
      status: "draft",
      submittedForReview: false,
      submittedAt: null,
      submittedBy: "",
      reviewer: "",
      reviewedAt: null,
      returnReason: ""
    };

  const status =
    review.reviewStatus ||
    review.status ||
    "draft";

  const submittedAt =
    formatGameCompletionDate(
      review.submittedAt
    );

  const reviewedAt =
    formatGameCompletionDate(
      review.reviewedAt
    );

  const showSubmission =
    Boolean(
      review.submittedBy ||
      review.submittedAt
    );

  const showDecision =
    Boolean(
      review.reviewer ||
      review.reviewedAt
    );

  const canSubmit =
    !reviewMode &&
    (
      status === "draft" ||
      status === "returned"
    );

  const canDecide =
    reviewMode &&
    status === "submitted";

  return `
    <div
      class="game-hub-review"
      data-testid="game-hub-review"
    >
      <h4>
        ${
          reviewMode
            ? "Assigner Review"
            : "Game Review"
        }
      </h4>

      <dl>
        <div>
          <dt>Review status</dt>
          <dd
            data-testid="game-hub-review-status"
          >
            ${formatGameHubReviewStatus(status)}

            ${
              status === "submitted"
                ? `
                    <span
                      data-testid="game-hub-review-submitted"
                    >
                      Submitted
                    </span>
                  `
                : ""
            }
          </dd>
        </div>

        ${
          showSubmission
            ? `
                <div>
                  <dt>Submitted by</dt>
                  <dd
                    data-testid="game-hub-review-submitted-by"
                  >
                    ${escapeGameHubReportValue(
                      review.submittedBy
                    )}
                  </dd>
                </div>

                <div>
                  <dt>Submitted at</dt>
                  <dd
                    data-testid="game-hub-review-submitted-at"
                  >
                    <div>${submittedAt.date}</div>
                    <div>${submittedAt.time}</div>
                  </dd>
                </div>
              `
            : ""
        }

        ${
          showDecision
            ? `
                <div>
                  <dt>Reviewer</dt>
                  <dd
                    data-testid="game-hub-review-reviewer"
                  >
                    ${escapeGameHubReportValue(
                      review.reviewer
                    )}
                  </dd>
                </div>

                <div>
                  <dt>Reviewed at</dt>
                  <dd
                    data-testid="game-hub-review-reviewed-at"
                  >
                    <div>${reviewedAt.date}</div>
                    <div>${reviewedAt.time}</div>
                  </dd>
                </div>
              `
            : ""
        }

        ${
  status === "returned"
    ? `
        <div>
          <dt>Returned by</dt>
          <dd
            data-testid="game-hub-returned-by"
          >
            ${escapeGameHubReportValue(
              review.reviewer
            )}
          </dd>
        </div>

        <div>
          <dt>Returned on</dt>
          <dd
            data-testid="game-hub-returned-on"
          >
            <div>${reviewedAt.date}</div>
            <div>${reviewedAt.time}</div>
          </dd>
        </div>

        <div class="game-hub-review-comments">
          <dt>Reviewer comments</dt>

          <dd
            data-testid="game-hub-reviewer-comments"
          >
            <span
              data-testid="game-hub-review-return-reason"
            >
              ${escapeGameHubReportValue(
                review.returnReason
              )}
            </span>
          </dd>
        </div>
      `
    : ""
}
      </dl>

      ${
        canSubmit
          ? `
              <button
                type="button"
                class="button button-primary"
                data-testid="game-hub-submit-review"
                onclick="submitGameForReviewFromHub('${game.id}')"
              >
                ${
                  status === "returned"
                    ? "Resubmit for Assigner Review"
                    : "Submit for Assigner Review"
                }
              </button>
            `
          : ""
      }

      ${
        canDecide
          ? `
              <div
                class="game-hub-review-actions"
                data-testid="game-hub-review-actions"
              >
                <button
                  type="button"
                  class="button button-primary"
                  data-testid="game-hub-approve-review"
                  onclick="approveReviewFromHub('${game.id}')"
                >
                  Approve Review
                </button>

                <button
                  type="button"
                  class="button button-secondary"
                  data-testid="game-hub-show-return-review"
                  onclick="showReturnReviewForm()"
                >
                  Return to Umpire
                </button>
              </div>

              <div
                class="game-hub-return-review"
                data-testid="game-hub-return-review"
                hidden
              >
                <div class="form-group">
                  <label
                    for="game-hub-return-review-reason"
                  >
                    Reviewer comments
                  </label>

                  <textarea
                    id="game-hub-return-review-reason"
                    data-testid="game-hub-return-review-reason"
                    rows="4"
                  ></textarea>
                </div>

                <button
                  type="button"
                  class="button button-primary"
                  data-testid="game-hub-confirm-return-review"
                  onclick="returnReviewFromHub('${game.id}')"
                >
                  Confirm Return
                </button>

                <button
                  type="button"
                  class="button button-secondary"
                  data-testid="game-hub-cancel-return-review"
                  onclick="hideReturnReviewForm()"
                >
                  Cancel
                </button>
              </div>
            `
          : ""
      }

      <p
        class="form-status"
        data-testid="game-hub-review-message"
        aria-live="polite"
      ></p>
    </div>
  `;
}

function renderGameHubCompletion(
  game,
  reviewMode = false
) {
  const completion = game.completion || {
    completed: false,
    completionTime: null,
    completedBy: "",
    completionStatus: "incomplete",
    homeScore: null,
    awayScore: null,
    reports: {
      incidents: false,
      ejections: false,
      protests: false,
      rainout: false,
      notes: ""
    },
    review: {
      reviewStatus: "draft",
      submittedForReview: false,
      submittedAt: null,
      submittedBy: ""
    }
  };

  if (!completion.completed) {
    const eligibility = portalService.getCompletionEligibility(game);
    return `
      <section
        class="card game-hub-section game-hub-completion"
        data-testid="game-hub-completion"
      >
        <h3>Game Completion</h3>

        <p
          data-testid="game-hub-completion-incomplete"
        >
          Game not yet completed.
        </p>

        <button
          type="button"
          class="button button-primary"
          data-testid="game-hub-complete-game"
          onclick="openGameCompletionDialog()"
          ${eligibility.allowed ? "" : "disabled"}
          aria-describedby="game-hub-completion-help"
        >
          Complete Game
        </button>

        <p class="muted" id="game-hub-completion-help" data-testid="game-hub-completion-help">${escapeGameHubText(eligibility.allowed ? "Enter the final score and optional game notes." : eligibility.reason)}</p>
        <dialog class="game-hub-completion-dialog" data-testid="game-hub-completion-dialog" aria-labelledby="game-hub-completion-dialog-title" onclose="restoreGameCompletionFocus()">
          <div><h3 id="game-hub-completion-dialog-title">Complete Game</h3>
          <label>Away Score<input type="number" min="0" step="1" data-testid="game-hub-completion-away-score"></label>
          <label>Home Score<input type="number" min="0" step="1" data-testid="game-hub-completion-home-score"></label>
          <label>Game Notes<textarea rows="5" data-testid="game-hub-completion-notes"></textarea></label>
          <p class="form-status" role="alert" data-testid="game-hub-completion-dialog-error"></p>
          <div class="game-hub-dialog-actions"><button type="button" class="button button-primary" data-testid="game-hub-confirm-completion" onclick="completeGameFromHub('${game.id}')">Complete Game</button><button type="button" class="button button-secondary" data-testid="game-hub-cancel-completion" onclick="closeGameCompletionDialog()">Cancel</button></div></div>
        </dialog>

        <p
          class="form-status"
          data-testid="game-hub-completion-status"
          aria-live="polite"
        ></p>
      </section>
    `;
  }

  const completedAt =
    formatGameCompletionDate(
      completion.completionTime
    );

  return `
    <section
      class="card game-hub-section game-hub-completion"
      data-testid="game-hub-completion"
    >
      <h3>Game Completion</h3>

      <p
        class="game-hub-completion-complete"
        data-testid="game-hub-completion-complete"
      >
        <strong>✓ Game Completed</strong>
      </p>

      <dl>
        <div>
          <dt>Completed by:</dt>
          <dd
            data-testid="game-hub-completed-by"
          >
            ${completion.completedBy}
          </dd>
        </div>

        <div>
          <dt>Completed:</dt>
          <dd
            data-testid="game-hub-completed-at"
          >
            <div>${completedAt.date}</div>
            <div>${completedAt.time}</div>
          </dd>
        </div>
      </dl>

      ${false ? `<div
        class="game-hub-final-score"
        data-testid="game-hub-final-score"
      >
        <h4>Final Score</h4>

        <div class="form-group">
          <label
            for="game-hub-away-score"
          >
            ${game.awayTeam}
          </label>

          <input
            id="game-hub-away-score"
            type="number"
            inputmode="numeric"
            data-testid="game-hub-away-score"
          ${isGameHubReviewLocked(completion.review) ? "disabled" : ""}
            value="${
              completion.awayScore === null
                ? ""
                : completion.awayScore
            }"
          />
        </div>

        <div class="form-group">
          <label
            for="game-hub-home-score"
          >
            ${game.homeTeam}
          </label>

          <input
            id="game-hub-home-score"
            type="number"
            inputmode="numeric"
            data-testid="game-hub-home-score"
          ${isGameHubReviewLocked(completion.review) ? "disabled" : ""}
            value="${
              completion.homeScore === null
                ? ""
                : completion.homeScore
            }"
          />
        </div>

        <button
          type="button"
          class="button button-primary"
          data-testid="game-hub-save-score"
          ${isGameHubReviewLocked(completion.review) ? "disabled" : ""}
          onclick="saveGameScoreFromHub('${game.id}')"
        >
          Save Score
        </button>

        <p
          class="form-status"
          data-testid="game-hub-score-status"
          aria-live="polite"
        ></p>
      </div>

      ${renderGameHubReports(
        game,
        completion
      )}` : ""}

      <div class="game-hub-completion-summary" data-testid="game-hub-completion-summary">
        <h4>Final Score</h4>
        <p><strong>${escapeGameHubText(game.awayTeam)}</strong> ${completion.awayScore} – ${completion.homeScore} <strong>${escapeGameHubText(game.homeTeam)}</strong></p>
        ${completion.reports?.notes ? `<p data-testid="game-hub-completion-notes-readonly"><strong>Game Notes:</strong> ${escapeGameHubText(completion.reports.notes)}</p>` : ""}
      </div>

      ${game.lifecycleStatus === "returned" ? `<button type="button" class="button button-primary" data-testid="game-hub-edit-completion" onclick="openGameCompletionEditDialog()">Edit Completion</button>
      <dialog class="game-hub-completion-dialog" data-testid="game-hub-completion-edit-dialog" aria-labelledby="game-hub-completion-edit-title" onclose="restoreGameCompletionFocus()"><div>
        <h3 id="game-hub-completion-edit-title">Edit Completion</h3>
        <label>Away Score<input type="number" min="0" step="1" value="${completion.awayScore ?? ""}" data-testid="game-hub-edit-away-score"></label>
        <label>Home Score<input type="number" min="0" step="1" value="${completion.homeScore ?? ""}" data-testid="game-hub-edit-home-score"></label>
        <label>Game Notes<textarea rows="5" data-testid="game-hub-edit-notes">${escapeGameHubText(completion.reports?.notes || "")}</textarea></label>
        <p class="form-status" role="alert" data-testid="game-hub-completion-edit-error"></p>
        <div class="game-hub-dialog-actions"><button type="button" class="button button-primary" data-testid="game-hub-save-completion-edit" onclick="saveGameCompletionEdit('${game.id}')">Save Changes</button><button type="button" class="button button-secondary" onclick="document.querySelector('[data-testid=game-hub-completion-edit-dialog]').close()">Cancel</button></div>
      </div></dialog>` : ""}

      ${renderGameHubReview(
        game,
        completion,
        reviewMode
      )}
    </section>
  `;
}

let gameCompletionTrigger = null;

function openGameCompletionDialog() {
  const dialog = document.querySelector('[data-testid="game-hub-completion-dialog"]');
  gameCompletionTrigger = document.activeElement;
  dialog?.showModal();
  dialog?.querySelector("input")?.focus();
}

function openGameCompletionEditDialog() {
  const dialog = document.querySelector('[data-testid="game-hub-completion-edit-dialog"]');
  gameCompletionTrigger = document.activeElement;
  dialog?.showModal();
  dialog?.querySelector("input")?.focus();
}

async function saveGameCompletionEdit(gameId) {
  const result = await portalService.updateCompletedGame(gameId, {
    awayScore: document.querySelector('[data-testid="game-hub-edit-away-score"]')?.value ?? "",
    homeScore: document.querySelector('[data-testid="game-hub-edit-home-score"]')?.value ?? "",
    notes: document.querySelector('[data-testid="game-hub-edit-notes"]')?.value ?? ""
  });
  if (result.success) return renderPage("game-hub", { gameId });
  const status = document.querySelector('[data-testid="game-hub-completion-edit-error"]');
  if (status) status.textContent = result.message;
}

function closeGameCompletionDialog() {
  document.querySelector('[data-testid="game-hub-completion-dialog"]')?.close();
}

function restoreGameCompletionFocus() {
  gameCompletionTrigger?.focus?.();
  gameCompletionTrigger = null;
}

async function completeGameFromHub(gameId) {
  const result =
    await portalService.completeGame(gameId, {
      awayScore: document.querySelector('[data-testid="game-hub-completion-away-score"]')?.value ?? "",
      homeScore: document.querySelector('[data-testid="game-hub-completion-home-score"]')?.value ?? "",
      notes: document.querySelector('[data-testid="game-hub-completion-notes"]')?.value ?? ""
    });

  if (result.success) {
    renderPage("game-hub", {
      gameId
    });

    return;
  }

  const status = document.querySelector(
    '[data-testid="game-hub-completion-dialog-error"], [data-testid="game-hub-completion-status"]'
  );

  if (status) {
    status.textContent =
      result.message ||
      "Unable to complete game.";
  }
}


function saveGameScoreFromHub(gameId) {
  const homeScoreInput =
    document.getElementById(
      "game-hub-home-score"
    );

  const awayScoreInput =
    document.getElementById(
      "game-hub-away-score"
    );

  const result =
    portalService.saveGameScore(
      gameId,
      homeScoreInput
        ? homeScoreInput.value
        : "",
      awayScoreInput
        ? awayScoreInput.value
        : ""
    );

  const status = document.querySelector(
    '[data-testid="game-hub-score-status"]'
  );

  if (status) {
    status.textContent =
      result.message || "";
  }
}


function saveGameReportsFromHub(gameId) {
  const incidents =
    document.querySelector(
      '[data-testid="game-hub-report-incidents"]'
    );

  const ejections =
    document.querySelector(
      '[data-testid="game-hub-report-ejections"]'
    );

  const protests =
    document.querySelector(
      '[data-testid="game-hub-report-protests"]'
    );

  const rainout =
    document.querySelector(
      '[data-testid="game-hub-report-rainout"]'
    );

  const notes =
    document.querySelector(
      '[data-testid="game-hub-report-notes"]'
    );

  const result =
    portalService.saveGameReports(
      gameId,
      {
        incidents:
          incidents?.checked === true,
        ejections:
          ejections?.checked === true,
        protests:
          protests?.checked === true,
        rainout:
          rainout?.checked === true,
        notes:
          notes?.value || ""
      }
    );

  const status = document.querySelector(
    '[data-testid="game-hub-reports-status"]'
  );

  if (status) {
    status.textContent =
      result.message || "";
  }
}


function submitGameForReviewFromHub(
  gameId
) {
  const result =
    portalService.submitGameForReview(
      gameId
    );

  if (result.success) {
    renderPage("game-hub", {
      gameId
    });

    return;
  }

  const status = document.querySelector(
    '[data-testid="game-hub-review-message"]'
  );

  if (status) {
    status.textContent =
      result.message ||
      "Unable to submit game for review.";
  }
}

function setGameHubReviewMessage(message) {
  const element = document.querySelector(
    '[data-testid="game-hub-review-message"]'
  );

  if (element) {
    element.textContent = message || "";
  }
}


function showReturnReviewForm() {
  const form = document.querySelector(
    '[data-testid="game-hub-return-review"]'
  );

  if (form) {
    form.hidden = false;
  }
}


function hideReturnReviewForm() {
  const form = document.querySelector(
    '[data-testid="game-hub-return-review"]'
  );

  if (form) {
    form.hidden = true;
  }

  setGameHubReviewMessage("");
}


function approveReviewFromHub(gameId) {
  const result =
    portalService.approveReview(gameId);

  if (result.success) {
      if (
    typeof refreshWorkbenchIfActive === "function"
  ) {
    refreshWorkbenchIfActive();
  }

renderPage("review-queue");
    return;
  }

  setGameHubReviewMessage(
    result.message ||
    "Unable to approve review."
  );
}


function returnReviewFromHub(gameId) {
  const reason = document.querySelector(
    '[data-testid="game-hub-return-review-reason"]'
  );

  const result =
    portalService.returnReview(
      gameId,
      reason?.value || ""
    );

  if (result.success) {
      if (
    typeof refreshWorkbenchIfActive === "function"
  ) {
    refreshWorkbenchIfActive();
  }

renderPage("review-queue");
    return;
  }

  setGameHubReviewMessage(
    result.message ||
    "Unable to return review."
  );
}


function renderGameHubSection(
  game,
  key,
  title,
  renderer
) {
  return `
    <section
      class="card game-hub-section"
      data-testid="game-hub-section-${key}"
    >
      <h3>${title}</h3>

      <div class="game-hub-section-content">
        ${renderer(game)}
      </div>
    </section>
  `;
}

function canManageGameHubCrew(game) {
  return Boolean(
    game &&
    !isGameHubReadOnly(game) &&
    typeof authorizationService !== "undefined" &&
    authorizationService.canAssignGames()
  );
}

function isGameHubAdministrativeView() {
  return Boolean(
    typeof authorizationService !== "undefined" &&
    authorizationService.canAssignGames()
  );
}

function hasGameHubGameStarted(game) {
  if (!game?.date || !game?.time) return false;

  const match = String(game.time).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return false;

  let hours = Number(match[1]) % 12;
  if (match[3].toUpperCase() === "PM") hours += 12;

  const start = new Date(`${game.date}T${String(hours).padStart(2, "0")}:${match[2]}:00`);
  return !Number.isNaN(start.getTime()) && Date.now() >= start.getTime();
}

function getGameHubEligibleCrew(game, assignment) {
  const assignedElsewhere = new Set(
    assignmentService.getAssignments(game)
      .filter(item => item.id !== assignment.id && item.crewId)
      .map(item => String(item.crewId))
  );

  return crewService.getEligible(game.level)
    .filter(member =>
      !assignedElsewhere.has(String(member.id)) &&
      (
        typeof availabilityService === "undefined" ||
        availabilityService.getAvailability(member.id, game.date) !== "unavailable"
      )
    )
    .sort((a, b) => {
      const getSortName = member => {
        const display = String(crewService.getName(member) || member.name || "").trim();
        const parts = display.split(/\s+/);
        return {
          last: String(member.lastName || parts.at(-1) || ""),
          first: String(member.firstName || parts.slice(0, -1).join(" ") || display)
        };
      };
      const aName = getSortName(a);
      const bName = getSortName(b);
      return aName.last.localeCompare(bName.last, undefined, { sensitivity: "base" }) ||
        aName.first.localeCompare(bName.first, undefined, { sensitivity: "base" });
    });
}

function filterGameHubCrewOptions(input) {
  const query = String(input?.value || "").trim().toLowerCase();
  input?.closest("form")?.querySelectorAll(".game-hub-crew-option").forEach(option => {
    option.hidden = query !== "" && !String(option.dataset.search || option.textContent || "").toLowerCase().includes(query);
  });
}

function renderGameHubCrewPicker(game, assignment) {
  const candidates = getGameHubEligibleCrew(game, assignment);
  const presentation = getGameHubPresentation(game);

  return `
    <dialog class="game-hub-crew-picker" data-testid="game-hub-crew-picker-${escapeGameHubText(assignment.id)}">
      <form method="dialog" onsubmit="event.preventDefault(); saveGameHubCrewAssignment('${escapeGameHubText(game.id)}', '${escapeGameHubText(assignment.id)}')">
        <header>
          <div class="game-hub-picker-heading"><strong>${escapeGameHubText(presentation.complex)}</strong><span>${escapeGameHubText(`${presentation.date} • ${presentation.time} • ${presentation.field} • ${presentation.level}`)}</span><h3>Assign ${escapeGameHubText(presentationFormattingService.formatAssignmentPosition(assignment.position))}</h3></div>
          <div class="game-hub-picker-actions">
            <button type="submit" class="button button-primary" data-testid="game-hub-crew-save-${escapeGameHubText(assignment.id)}">Save</button>
            <button type="button" class="button button-secondary" onclick="this.closest('dialog').close()" aria-label="Close crew picker">Close</button>
          </div>
        </header>
        <div class="game-hub-crew-search"><label>Search crew<input type="search" data-testid="game-hub-crew-search-${escapeGameHubText(assignment.id)}" placeholder="Search by name or level" oninput="filterGameHubCrewOptions(this)" onkeydown="if (event.key === 'Enter') event.preventDefault()" /></label></div>
        <div class="game-hub-crew-options" role="radiogroup" aria-label="Eligible crew members">
          ${candidates.length ? candidates.map(member => `
            <label class="game-hub-crew-option" data-search="${escapeGameHubText(`${crewService.getName(member)} ${(member.levels || []).join(" ")}`)}">
              <input type="radio" name="crew-${escapeGameHubText(assignment.id)}" value="${escapeGameHubText(member.id)}" ${String(member.id) === String(assignment.crewId) ? "checked" : ""} />
              <span><strong>${escapeGameHubText(crewService.getName(member))}</strong><small class="game-hub-crew-levels">${(member.levels || []).map(level => `<span>${escapeGameHubText(level)}</span>`).join("")}</small></span>
            </label>
          `).join("") : `<div class="presentation-empty-state" role="status">No available crew members are eligible for ${escapeGameHubText(game.level)}.</div>`}
        </div>
        <p class="form-status" data-testid="game-hub-crew-picker-status" aria-live="polite"></p>
      </form>
    </dialog>
  `;
}

function openGameHubCrewPicker(assignmentId) {
  document.querySelector(`[data-testid="game-hub-crew-picker-${assignmentId}"]`)?.showModal();
}

async function saveGameHubCrewAssignment(gameId, assignmentId) {
  const dialog = document.querySelector(`[data-testid="game-hub-crew-picker-${assignmentId}"]`);
  const selected = dialog?.querySelector(`input[name="crew-${assignmentId}"]:checked`);
  const status = dialog?.querySelector('[data-testid="game-hub-crew-picker-status"]');
  const submit = dialog?.querySelector(`[data-testid="game-hub-crew-save-${assignmentId}"]`);

  if (!selected) {
    if (status) status.textContent = "Select a crew member before saving.";
    return;
  }

  if (pendingGameHubCrewAssignments.has(assignmentId)) return;
  pendingGameHubCrewAssignments.add(assignmentId);
  if (submit) { submit.disabled = true; submit.setAttribute("aria-busy", "true"); }
  if (status) status.textContent = "Saving assignment...";
  try {
    const result = await assignmentService.assignToAssignment(gameId, assignmentId, selected.value);
    if (!result.success) {
      if (status) status.textContent = result.message;
      return;
    }
    dialog?.close();
    if (typeof refreshWorkbenchGameDialog === "function" && refreshWorkbenchGameDialog(gameId)) return;
    renderPage("game-hub", { ...gameHubNavigationContext, gameId });
  } catch (error) {
    if (status) status.textContent = error?.message || "Crew member could not be assigned.";
  } finally {
    pendingGameHubCrewAssignments.delete(assignmentId);
    if (submit) { submit.disabled = false; submit.removeAttribute("aria-busy"); }
  }
}

async function removeGameHubCrewAssignment(gameId, assignmentId) {
  const status = document.querySelector(`[data-testid="game-hub-remove-status-${assignmentId}"]`);
  const result = await assignmentService.removeCrewAdministratively(gameId, assignmentId);
  if (!result.success) {
    if (status) status.textContent = result.message;
    return;
  }
  if (typeof refreshWorkbenchGameDialog === "function" && refreshWorkbenchGameDialog(gameId)) return;
  renderPage("game-hub", { ...gameHubNavigationContext, gameId });
}

function renderAdministrativeGameHubCrew(game, sourceGame) {
  const allAssignments = assignmentService.getAssignments(sourceGame);
  const requiredOfficialCount = Math.min(4, Math.max(1, Number(game.crewSize) || allAssignments.length || 1));
  const assignments = allAssignments.slice(0, requiredOfficialCount);

  return `
    <section class="game-hub-command-card game-hub-command-crew" data-testid="game-hub-admin-crew">
      <header>
        <div><h3>Officials</h3></div>
        <button type="button" class="button button-link" data-testid="game-hub-open-crew-notes" onclick="document.querySelector('[data-testid=game-hub-crew-notes-dialog]').showModal()">Crew Notes</button>
      </header>
      <div class="game-hub-command-slots">
        ${assignments.map(assignment => `
          <div class="game-hub-command-slot" data-testid="game-hub-crew-slot-${escapeGameHubText(assignment.position)}">
            <span>${escapeGameHubText(presentationFormattingService.formatAssignmentPosition(assignment.position))}</span>
            ${assignment.crewId
              ? `<strong>${escapeGameHubText(crewService.getDisplayName(assignment.crewId))}</strong><button type="button" class="button button-danger" data-testid="game-hub-remove-${escapeGameHubText(assignment.id)}" onclick="removeGameHubCrewAssignment('${escapeGameHubText(sourceGame.id)}','${escapeGameHubText(assignment.id)}')">Remove Crew Member</button><span class="form-status" role="alert" data-testid="game-hub-remove-status-${escapeGameHubText(assignment.id)}"></span>`
              : `<button type="button" class="button button-primary" data-testid="game-hub-assign-${escapeGameHubText(assignment.position)}" onclick="openGameHubCrewPicker('${escapeGameHubText(assignment.id)}')">Assign Crew</button>`}
          </div>
          ${renderGameHubCrewPicker(sourceGame, assignment)}
        `).join("")}
      </div>
      <dialog class="game-hub-crew-picker game-hub-notes-dialog" data-testid="game-hub-crew-notes-dialog" aria-labelledby="game-hub-admin-notes-title">
        <header><h3 id="game-hub-admin-notes-title">Crew Notes</h3><button type="button" class="button button-secondary" onclick="this.closest('dialog').close()">Close</button></header>
        <div class="game-hub-admin-notes">${assignments.filter(item => item.crewId).map(item => `<p><strong>${escapeGameHubText(presentationFormattingService.formatAssignmentPosition(item.position))} — ${escapeGameHubText(crewService.getDisplayName(item.crewId))}</strong><br>${escapeGameHubText(sourceGame.crewNotesByCrewId?.[String(item.crewId)] || "No crew notes entered.")}</p>`).join("") || `<div class="presentation-empty-state presentation-empty-state-compact" role="status">No assigned crew notes are available.</div>`}</div>
      </dialog>
    </section>
  `;
}

function renderAdministrativeGameHub(game) {
  const sourceGame = gameService.getById(game.id);
  const presentation = getGameHubPresentation(game);
  const assignor = presentation.contact;
  const gameHasStarted = hasGameHubGameStarted(game);

  return `
    <div class="game-hub-command-layout" data-testid="game-hub-admin-view">
      <section class="game-hub-command-card presentation-card game-hub-command-summary" data-testid="game-hub-admin-details">
        <header class="game-hub-command-summary-header" data-testid="game-hub-admin-statuses">
          <div class="game-hub-command-title"><h3>Game Details</h3></div>
          <div class="game-hub-command-lifecycle" data-testid="game-hub-admin-lifecycle-status">${renderGameHubLifecycleBadge(game)}</div>
          <div class="game-hub-command-assignment" data-testid="game-hub-admin-assignment-status">${renderGameHubAssignmentBadge(game)}</div>
        </header>
        ${gameHasStarted && !game.completion?.completed
          ? `<button type="button" class="button button-primary game-hub-command-complete" data-testid="game-hub-complete-game" onclick="completeGameFromHub('${escapeGameHubText(game.id)}')">Complete Game</button>`
          : ""}
        <dl>
          <div data-testid="game-hub-summary-level"><dt>Level</dt><dd>${escapeGameHubText(presentation.level)}</dd></div>
          <div data-testid="game-hub-summary-date"><dt>Date</dt><dd>${escapeGameHubText(presentation.dateLong)}</dd></div>
          <div data-testid="game-hub-summary-location"><dt>Complex</dt><dd>${escapeGameHubText(presentation.complex)}</dd></div>
          <div data-testid="game-hub-summary-field"><dt>Field</dt><dd>${escapeGameHubText(presentation.field)}</dd></div>
          <div data-testid="game-hub-summary-time"><dt>Time</dt><dd>${escapeGameHubText(presentation.time)}</dd></div>
        </dl>
      </section>
      ${renderAdministrativeGameHubCrew(game, sourceGame)}
      <section class="game-hub-command-card game-hub-command-contact" data-testid="game-hub-section-contacts">
        <span class="dashboard-eyebrow">Game Contact</span><h3>Assignor</h3>
        ${assignor ? `<strong>${escapeGameHubText(assignor.name)}</strong>${assignor.phone ? `<a href="tel:${escapeGameHubText(assignor.phone)}">${escapeGameHubText(assignor.phone)}</a>` : ""}${assignor.email ? `<a href="mailto:${escapeGameHubText(assignor.email)}">${escapeGameHubText(assignor.email)}</a>` : ""}` : `<p class="muted">No assignor contact is available.</p>`}
      </section>
    </div>
  `;
}

function renderGameHubQuickActions(
  reviewMode = false,
  game = null
) {
  const isClaimOrigin = gameHubNavigationContext.origin === "claim-games" || gameHubNavigationContext.returnPage === "claim-games";
  return `
    <div
      class="game-hub-actions"
      data-testid="game-hub-actions"
    >
      <button
        class="button button-secondary"
        type="button"
        onclick="renderPage('${
          reviewMode
            ? "review-queue"
            : isClaimOrigin ? "claim-games" : "my-schedule"
        }')"
        data-testid="game-hub-back"
      >
        ${
          reviewMode
            ? "← Back to Review Queue"
            : isClaimOrigin ? "← Back to Claim Games" : "← Back to My Schedule"
        }
      </button>

      ${isClaimOrigin && !reviewMode ? `<button class="button button-primary" type="button" data-testid="game-hub-submit-claim" onclick="claimPortalGame('${escapeGameHubText(game?.id || "")}')">Submit Claim</button>` : ""}

      ${
        reviewMode || !isGameHubAdministrativeView()
          ? ""
          : `
              ${canManageGameHubCrew(game) ? `
                <button
                  class="button button-primary"
                  type="button"
                  onclick="openAssignmentDrawer('${escapeGameHubText(game.id)}')"
                  data-testid="game-hub-manage-crew"
                >
                  Assign / Change Crew
                </button>
              ` : ""}

              <button
                class="button button-secondary"
                type="button"
                onclick="renderPage('availability')"
                data-testid="game-hub-availability"
              >
                View Availability
              </button>

              <button
                class="button button-secondary"
                type="button"
                onclick="renderPage('claim-games')"
                data-testid="game-hub-claim-games"
              >
                Claim Games
              </button>
            `
      }
    </div>
  `;
}

function renderGameHub(context = {}) {
  gameHubNavigationContext = { origin: context.origin || "", returnPage: context.returnPage || "" };
  const reviewMode =
    context.reviewMode === true;

  const game = reviewMode
    ? portalService.getReviewGame(
        context.gameId
      )
    : portalService.getGameHub(
        context.gameId
      );

  if (!game) {
    return `
      <section
        class="page-section"
        data-testid="game-hub"
      data-review-mode="${reviewMode}"
      >
        ${renderGameHubQuickActions(reviewMode)}

        <h2>Game Hub</h2>

        <div
          class="empty-state"
          data-testid="game-hub-empty"
        >
          <p>This game is not available.</p>
        </div>
      </section>
    `;
  }

  const sections = [
    [
      "game-information",
      "Game Information",
      gameDayRenderers.renderGameInformation
    ],
    [
      "crew",
      "Crew",
      gameDayRenderers.renderPartners
    ],
    [
      "arrival",
      "Arrival",
      gameDayRenderers.renderArrival
    ],
    [
      "game-day",
      "Game Day",
      gameDayRenderers.renderGameDay
    ],
    [
      "timeline",
      "Timeline",
      gameDayRenderers.renderTimeline
    ],
    [
      "conditions",
      "Conditions",
      gameDayRenderers.renderConditions
    ],
    [
      "contacts",
      "Contacts",
      gameDayRenderers.renderContacts
    ],
    [
      "status",
      "Status",
      gameDayRenderers.renderStatus
    ]
  ];

  if (isGameHubAdministrativeView() && !reviewMode) {
    const returnToWorkbench = context.returnPage === "assigner-workbench" || context.origin === "assigner-workbench";
    const returnToOperations = context.returnPage === "operations-center" || context.origin === "operations-center";
    const backPage = returnToOperations ? "operations-center" : returnToWorkbench ? "assigner-workbench" : context.returnPage || "dashboard";
    const backLabel = returnToOperations ? "Back to Ops Center" : returnToWorkbench ? "Back to Assigner Workbench" : backPage === "dashboard" ? "Back to Dashboard" : "Back to Previous Page";
    const presentation = getGameHubPresentation(game);
    return `
      <section class="page-section game-hub game-hub-admin" data-testid="game-hub" data-game-id="${game.id}" data-review-mode="false" data-lifecycle-status="${game.lifecycleStatus}" data-read-only="${isGameHubReadOnly(game)}">
        <div class="game-hub-admin-nav"><button class="button button-secondary" type="button" onclick="renderPage('${backPage}')" data-testid="game-hub-back">← ${backLabel}</button></div>
        <header class="game-hub-admin-heading"><h1 data-testid="game-hub-matchup">${escapeGameHubText(presentation.matchup)}</h1></header>
        ${renderGameHubLifecycleBanner(game)}
        ${renderAdministrativeGameHub(game)}
      </section>
    `;
  }

  return `
    <section
      class="page-section game-hub"
      data-testid="game-hub"
      data-game-id="${game.id}"
      data-review-mode="${reviewMode}"
      data-lifecycle-status="${game.lifecycleStatus}"
      data-read-only="${isGameHubReadOnly(game)}"
    >
      ${renderGameHubQuickActions(reviewMode, game)}

      <h2>Game Hub</h2>

      ${renderUmpireGameSummary(game)}

      ${false ? `
      <div>
      ${renderGameHubLifecycleBanner(game)}

      <div
        class="card game-hub-summary"
        data-testid="game-hub-summary"
      >
        <div class="game-hub-summary-header">
          <div>
            <h3 data-testid="game-hub-matchup">
              ${game.matchup}
            </h3>

            <div
              class="game-hub-summary-date"
              data-testid="game-hub-date-time"
            >
              ${game.date} • ${dateTimeFormattingService.formatTime12Hour(game.time, "Time unavailable")}
            </div>
          </div>

          <div
            class="game-hub-summary-status"
            data-testid="game-hub-summary-status"
          >
            ${renderGameHubLifecycleBadge(game)}
            ${gameDayRenderers.renderStatus(game)}
          </div>
        </div>

        <div class="game-hub-summary-details">
          <div data-testid="game-hub-summary-field">
            <span class="muted">Field</span>
            <strong>
              ${game.gameInformation?.field || ""}
            </strong>
          </div>

          <div data-testid="game-hub-summary-level">
            <span class="muted">Level</span>
            <strong>${game.level}</strong>
          </div>

          <div data-testid="game-hub-summary-position">
            <span class="muted">Position</span>
            <strong>${game.position}</strong>
          </div>
        </div>
      </div>

      </div>
      ` : ""}

      ${renderGameHubCrewNotes(game)}

      ${renderGameHubCompletion(
        game,
        reviewMode ||
          isGameHubReadOnly(game)
      )}

      ${false ? `<div
        class="game-hub-sections"
        data-testid="game-hub-sections"
      >
        ${sections
          .map(([key, title, renderer]) =>
            renderGameHubSection(
              game,
              key,
              title,
              renderer
            )
          )
          .join("")}
      </div>` : ""}
    </section>
  `;
}
