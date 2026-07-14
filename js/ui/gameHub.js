// js/ui/gameHub.js

function escapeGameHubText(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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
          ${game.completion?.review?.submittedForReview ? "readonly" : ""}
        rows="5"
        placeholder="Add reminders, questions, or pregame notes..."
      >${escapeGameHubText(game.crewNotes)}</textarea>

      <div class="game-hub-notes-footer">
        <button
          class="button"
          type="button"
          onclick="saveGameHubCrewNotes('${game.id}')"
          data-testid="game-hub-save-crew-notes"
          ${game.completion?.review?.submittedForReview ? "disabled" : ""}
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
          ${game.completion?.review?.submittedForReview ? "disabled" : ""}
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
          onclick="completeGameFromHub('${game.id}')"
        >
          Complete Game
        </button>

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

      <div
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
      )}

      ${renderGameHubReview(
        game,
        completion,
        reviewMode
      )}
    </section>
  `;
}

function completeGameFromHub(gameId) {
  const result =
    portalService.completeGame(gameId);

  if (result.success) {
    renderPage("game-hub", {
      gameId
    });

    return;
  }

  const status = document.querySelector(
    '[data-testid="game-hub-completion-status"]'
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

function renderGameHubQuickActions(
  reviewMode = false
) {
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
            : "my-schedule"
        }')"
        data-testid="game-hub-back"
      >
        ${
          reviewMode
            ? "← Back to Review Queue"
            : "← Back to My Schedule"
        }
      </button>

      ${
        reviewMode
          ? ""
          : `
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

  return `
    <section
      class="page-section game-hub"
      data-testid="game-hub"
      data-game-id="${game.id}"
      data-review-mode="${reviewMode}"
    >
      ${renderGameHubQuickActions(reviewMode)}

      <h2>Game Hub</h2>

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
              ${game.date} • ${game.time}
            </div>
          </div>

          <div
            class="game-hub-summary-status"
            data-testid="game-hub-summary-status"
          >
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

      ${renderGameHubCrewNotes(game)}

      ${renderGameHubChecklist(game)}

      ${renderGameHubCompletion(
        game,
        reviewMode
      )}

      <div
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
      </div>
    </section>
  `;
}
