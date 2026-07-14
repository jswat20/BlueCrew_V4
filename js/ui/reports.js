// js/ui/reports.js

window.reportsPageState =
  window.reportsPageState || {
    startDate: "",
    endDate: "",
    status: "",
    crewId: "",
    level: "",
    field: ""
  };

const reportsPageState =
  window.reportsPageState;

window.reportsPresetPageState =
  window.reportsPresetPageState || {
    selectedPresetId: "",
    presetName: "",
    message: "",
    messageType: ""
  };

const reportsPresetPageState =
  window.reportsPresetPageState;

function renderReports() {
  const filters = {
    ...reportsPageState
  };

  const assignment =
    reportingService.getAssignmentReport(
      filters
    );

  const availability =
    reportingService.getAvailabilityReport(
      filters
    );

  const review =
    reportingService.getReviewReport(
      filters
    );

  const assignmentDetails =
    reportingService.getAssignmentDetails(
      filters
    );

  const availabilityDetails =
    reportingService.getAvailabilityDetails(
      filters
    );

  const reviewDetails =
    reportingService.getReviewDetails(
      filters
    );

  const hasReportData =
    assignment.totalGames > 0 ||
    availability.available > 0 ||
    availability.unavailable > 0 ||
    availability.maybe > 0 ||
    availability.noResponse > 0 ||
    review.submitted > 0 ||
    review.returned > 0 ||
    review.approved > 0;

  return `
    <section
      class="page-section reports-page"
      data-testid="reports-page"
    >
      <div class="page-section-header">
        <div>
          <h2>Reports</h2>
          <p>
            Read-only operational summaries and detail.
          </p>
        </div>
      </div>

      ${renderReportFilters()}
      ${renderReportPresetControls()}

      ${
        hasReportData
          ? ""
          : renderReportsEmptyState()
      }

      <div
        class="dashboard-grid"
        data-testid="reports-grid"
      >
        ${renderAssignmentReportCard(
          assignment,
          assignmentDetails
        )}

        ${renderAvailabilityReportCard(
          availability,
          availabilityDetails
        )}

        ${renderReviewReportCard(
          review,
          reviewDetails
        )}
      </div>
    </section>
  `;
}


function renderReportFilters() {
  const crewMembers =
    crewService
      .getAll()
      .filter(member =>
        member.active !== false
      );

  const levels = [
    ...new Set(
      gameService
        .getAll()
        .map(game => game.level || "")
        .filter(Boolean)
    )
  ].sort();

  const fields = [
    ...new Set(
      gameService
        .getAll()
        .map(game => game.field || "")
        .filter(Boolean)
    )
  ].sort();

  return `
    <div
      class="reports-filter-card"
      data-testid="reports-filters"
    >
      <div class="reports-filter-grid">
        ${renderReportFilterInput(
          "Start Date",
          "startDate",
          reportsPageState.startDate,
          "reports-filter-start-date"
        )}

        ${renderReportFilterInput(
          "End Date",
          "endDate",
          reportsPageState.endDate,
          "reports-filter-end-date"
        )}

        <label class="reports-filter-field">
          <span>Status</span>

          <select
            data-testid="reports-filter-status"
            onchange="handleReportFilterChange(
              'status',
              this.value
            )"
          >
            ${renderReportFilterOption(
              "",
              "All Statuses",
              reportsPageState.status
            )}

            ${[
              "open",
              "partially staffed",
              "fully staffed",
              "available",
              "unavailable",
              "maybe",
              "no-response",
              "submitted",
              "returned",
              "approved"
            ]
              .map(status =>
                renderReportFilterOption(
                  status,
                  formatReportStatus(status),
                  reportsPageState.status
                )
              )
              .join("")}
          </select>
        </label>

        <label class="reports-filter-field">
          <span>Crew Member</span>

          <select
            data-testid="reports-filter-crew"
            onchange="handleReportFilterChange(
              'crewId',
              this.value
            )"
          >
            ${renderReportFilterOption(
              "",
              "All Crew",
              reportsPageState.crewId
            )}

            ${crewMembers
              .map(member =>
                renderReportFilterOption(
                  member.id,
                  crewService.getDisplayName(
                    member.id
                  ),
                  reportsPageState.crewId
                )
              )
              .join("")}
          </select>
        </label>

        <label class="reports-filter-field">
          <span>Level</span>

          <select
            data-testid="reports-filter-level"
            onchange="handleReportFilterChange(
              'level',
              this.value
            )"
          >
            ${renderReportFilterOption(
              "",
              "All Levels",
              reportsPageState.level
            )}

            ${levels
              .map(level =>
                renderReportFilterOption(
                  level,
                  level,
                  reportsPageState.level
                )
              )
              .join("")}
          </select>
        </label>

        <label class="reports-filter-field">
          <span>Field</span>

          <select
            data-testid="reports-filter-field"
            onchange="handleReportFilterChange(
              'field',
              this.value
            )"
          >
            ${renderReportFilterOption(
              "",
              "All Fields",
              reportsPageState.field
            )}

            ${fields
              .map(field =>
                renderReportFilterOption(
                  field,
                  field,
                  reportsPageState.field
                )
              )
              .join("")}
          </select>
        </label>
      </div>

      <div class="reports-filter-actions">
        <button
          type="button"
          class="secondary-button"
          data-testid="reports-filter-reset"
          onclick="resetReportFilters()"
        >
          Reset Filters
        </button>
      </div>
    </div>
  `;
}

function renderReportFilterInput(
  label,
  key,
  value,
  testId
) {
  return `
    <label class="reports-filter-field">
      <span>${escapeReportHtml(label)}</span>

      <input
        type="date"
        value="${escapeReportHtml(value)}"
        data-testid="${escapeReportHtml(testId)}"
        onchange="handleReportFilterChange(
          '${escapeReportHtml(key)}',
          this.value
        )"
      >
    </label>
  `;
}

function renderReportFilterOption(
  value,
  label,
  selectedValue
) {
  return `
    <option
      value="${escapeReportHtml(value)}"
      ${
        String(value) ===
        String(selectedValue)
          ? "selected"
          : ""
      }
    >
      ${escapeReportHtml(label)}
    </option>
  `;
}

function handleReportFilterChange(
  key,
  value
) {
  if (
    !Object.prototype.hasOwnProperty.call(
      reportsPageState,
      key
    )
  ) {
    return;
  }

  reportsPageState[key] =
    String(value || "");

  renderPage("reports");
}

function resetReportFilters() {
  Object.keys(reportsPageState)
    .forEach(key => {
      reportsPageState[key] = "";
    });

  renderPage("reports");
}


function renderReportPresetControls() {
  const presets =
    reportPresetService.getAll();

  return `
    <div
      class="reports-preset-card"
      data-testid="reports-presets"
    >
      <div class="reports-preset-grid">
        <label class="reports-filter-field">
          <span>Saved Preset</span>

          <select
            data-testid="reports-preset-select"
            onchange="handleReportPresetSelection(
              this.value
            )"
          >
            ${renderReportFilterOption(
              "",
              "Choose a preset",
              reportsPresetPageState
                .selectedPresetId
            )}

            ${presets
              .map(preset =>
                renderReportFilterOption(
                  preset.id,
                  preset.name,
                  reportsPresetPageState
                    .selectedPresetId
                )
              )
              .join("")}
          </select>
        </label>

        <label class="reports-filter-field">
          <span>Preset Name</span>

          <input
            type="text"
            value="${escapeReportHtml(
              reportsPresetPageState
                .presetName
            )}"
            data-testid="reports-preset-name"
            placeholder="Example: Weekend 12U"
            oninput="handleReportPresetNameChange(
              this.value
            )"
          >
        </label>
      </div>

      <div class="reports-preset-actions">
        <button
          type="button"
          class="secondary-button"
          data-testid="reports-preset-apply"
          onclick="handleApplyReportPreset()"
          ${
            reportsPresetPageState
              .selectedPresetId
              ? ""
              : "disabled"
          }
        >
          Apply Preset
        </button>

        <button
          type="button"
          class="secondary-button"
          data-testid="reports-preset-save"
          onclick="handleSaveReportPreset()"
        >
          ${
            reportsPresetPageState
              .selectedPresetId
              ? "Update Preset"
              : "Save Preset"
          }
        </button>

        <button
          type="button"
          class="secondary-button"
          data-testid="reports-preset-new"
          onclick="handleNewReportPreset()"
        >
          New Preset
        </button>

        <button
          type="button"
          class="secondary-button"
          data-testid="reports-preset-delete"
          onclick="handleDeleteReportPreset()"
          ${
            reportsPresetPageState
              .selectedPresetId
              ? ""
              : "disabled"
          }
        >
          Delete Preset
        </button>
      </div>

      ${
        reportsPresetPageState.message
          ? `
              <p
                class="reports-preset-message reports-preset-message-${
                  escapeReportHtml(
                    reportsPresetPageState
                      .messageType
                  )
                }"
                data-testid="reports-preset-message"
              >
                ${escapeReportHtml(
                  reportsPresetPageState
                    .message
                )}
              </p>
            `
          : ""
      }
    </div>
  `;
}

function handleReportPresetSelection(
  presetId
) {
  reportsPresetPageState
    .selectedPresetId =
      String(presetId || "");

  const preset =
    reportPresetService.getById(
      reportsPresetPageState
        .selectedPresetId
    );

  reportsPresetPageState.presetName =
    preset?.name || "";

  reportsPresetPageState.message = "";
  reportsPresetPageState.messageType = "";

  renderPage("reports");
}

function handleReportPresetNameChange(
  value
) {
  reportsPresetPageState.presetName =
    String(value || "");
}

function handleApplyReportPreset() {
  const preset =
    reportPresetService.getById(
      reportsPresetPageState
        .selectedPresetId
    );

  if (!preset) {
    setReportPresetMessage(
      "Choose a saved preset.",
      "error"
    );

    renderPage("reports");
    return;
  }

  Object.keys(reportsPageState)
    .forEach(key => {
      reportsPageState[key] =
        preset.filters[key] || "";
    });

  reportsPresetPageState.presetName =
    preset.name;

  setReportPresetMessage(
    "Report preset applied.",
    "success"
  );

  renderPage("reports");
}

function handleSaveReportPreset() {
  const result =
    reportPresetService.save({
      id:
        reportsPresetPageState
          .selectedPresetId,
      name:
        reportsPresetPageState
          .presetName,
      filters: {
        ...reportsPageState
      }
    });

  if (!result.success) {
    setReportPresetMessage(
      result.message,
      "error"
    );

    renderPage("reports");
    return;
  }

  reportsPresetPageState
    .selectedPresetId =
      result.data.id;

  reportsPresetPageState.presetName =
    result.data.name;

  setReportPresetMessage(
    result.message,
    "success"
  );

  renderPage("reports");
}

function handleNewReportPreset() {
  reportsPresetPageState
    .selectedPresetId = "";

  reportsPresetPageState.presetName = "";
  reportsPresetPageState.message = "";
  reportsPresetPageState.messageType = "";

  renderPage("reports");
}

function handleDeleteReportPreset() {
  const result =
    reportPresetService.remove(
      reportsPresetPageState
        .selectedPresetId
    );

  if (!result.success) {
    setReportPresetMessage(
      result.message,
      "error"
    );

    renderPage("reports");
    return;
  }

  reportsPresetPageState
    .selectedPresetId = "";

  reportsPresetPageState.presetName = "";

  setReportPresetMessage(
    result.message,
    "success"
  );

  renderPage("reports");
}

function setReportPresetMessage(
  message,
  type
) {
  reportsPresetPageState.message =
    String(message || "");

  reportsPresetPageState.messageType =
    String(type || "");
}

function renderReportsEmptyState() {
  return `
    <div
      class="empty-state"
      data-testid="reports-empty"
    >
      <h3>No reporting data yet</h3>
      <p>
        Reports update automatically as operational
        data is recorded.
      </p>
    </div>
  `;
}

function renderAssignmentReportCard(
  report,
  details
) {
  return `
    <article
      class="dashboard-card report-card"
      data-testid="assignment-report-card"
    >
      ${renderReportCardHeader(
        "Assignment Summary",
        "Current game staffing and claim status.",
        "assignment"
      )}

      <dl class="report-summary-list">
        ${renderReportMetric(
          "Total Games",
          report.totalGames,
          "assignment-report-total-games"
        )}

        ${renderReportMetric(
          "Assigned",
          report.assigned,
          "assignment-report-assigned"
        )}

        ${renderReportMetric(
          "Open Assignments",
          report.openAssignments,
          "assignment-report-open"
        )}

        ${renderReportMetric(
          "Pending Claims",
          report.pendingClaims,
          "assignment-report-pending-claims"
        )}

        ${renderReportMetric(
          "Fully Staffed",
          report.fullyStaffed,
          "assignment-report-fully-staffed"
        )}

        ${renderReportMetric(
          "Assignment Rate",
          `${report.assignmentRate}%`,
          "assignment-report-rate"
        )}
      </dl>

      ${renderAssignmentDetails(details)}
    </article>
  `;
}

function renderAvailabilityReportCard(
  report,
  details
) {
  return `
    <article
      class="dashboard-card report-card"
      data-testid="availability-report-card"
    >
      ${renderReportCardHeader(
        "Availability Summary",
        "Current availability responses.",
        "availability"
      )}

      <dl class="report-summary-list">
        ${renderReportMetric(
          "Available",
          report.available,
          "availability-report-available"
        )}

        ${renderReportMetric(
          "Unavailable",
          report.unavailable,
          "availability-report-unavailable"
        )}

        ${renderReportMetric(
          "Maybe",
          report.maybe,
          "availability-report-maybe"
        )}

        ${renderReportMetric(
          "No Response",
          report.noResponse,
          "availability-report-no-response"
        )}
      </dl>

      ${renderAvailabilityDetails(details)}
    </article>
  `;
}

function renderReviewReportCard(
  report,
  details
) {
  return `
    <article
      class="dashboard-card report-card"
      data-testid="review-report-card"
    >
      ${renderReportCardHeader(
        "Review Summary",
        "Current completion and review outcomes.",
        "review"
      )}

      <dl class="report-summary-list">
        ${renderReportMetric(
          "Submitted",
          report.submitted,
          "review-report-submitted"
        )}

        ${renderReportMetric(
          "Returned",
          report.returned,
          "review-report-returned"
        )}

        ${renderReportMetric(
          "Approved",
          report.approved,
          "review-report-approved"
        )}

        ${renderReportMetric(
          "Completion",
          `${report.completionPercentage}%`,
          "review-report-completion"
        )}
      </dl>

      ${renderReviewDetails(details)}
    </article>
  `;
}

function renderReportCardHeader(
  title,
  description,
  section
) {
  return `
    <div class="dashboard-card-header">
      <div>
        <h3>${escapeReportHtml(title)}</h3>
        <p>${escapeReportHtml(description)}</p>
      </div>

      <div class="report-card-actions">
        <button
          type="button"
          class="secondary-button"
          data-testid="${section}-report-export"
          onclick="handleReportExport('${section}')"
        >
          Export CSV
        </button>

        <button
          type="button"
          class="secondary-button report-detail-toggle"
          data-testid="${section}-report-toggle"
          aria-expanded="false"
          onclick="toggleReportDetails('${section}')"
        >
          View Details
        </button>
      </div>
    </div>
  `;
}

function renderAssignmentDetails(details) {
  return `
    <div
      class="report-detail"
      data-testid="assignment-report-detail"
      hidden
    >
      ${
        details.length
          ? `
              <div class="report-table-wrapper">
                <table
                  class="report-table"
                  data-testid="assignment-report-table"
                >
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Game</th>
                      <th>Field</th>
                      <th>Status</th>
                      <th>Assigned</th>
                      <th>Open</th>
                      <th>Claims</th>
                    </tr>
                  </thead>

                  <tbody>
                    ${details
                      .map(renderAssignmentDetailRow)
                      .join("")}
                  </tbody>
                </table>
              </div>
            `
          : renderReportDetailEmpty(
              "assignment-report-detail-empty",
              "No games are available."
            )
      }
    </div>
  `;
}

function renderAssignmentDetailRow(row) {
  return `
    <tr
      data-testid="assignment-report-row"
      data-game-id="${escapeReportHtml(
        row.gameId
      )}"
    >
      <td>${escapeReportHtml(
        formatReportDate(row.date)
      )}</td>

      <td>
        <strong>${escapeReportHtml(
          row.matchup
        )}</strong>
        <span class="report-table-secondary">
          ${escapeReportHtml(row.level)}
          ${
            row.time
              ? ` • ${escapeReportHtml(
                  row.time
                )}`
              : ""
          }
        </span>
      </td>

      <td>${escapeReportHtml(row.field)}</td>
      <td>${escapeReportHtml(row.status)}</td>
      <td>${escapeReportHtml(row.assignedCount)}</td>
      <td>${escapeReportHtml(row.openAssignments)}</td>
      <td>${escapeReportHtml(row.pendingClaims)}</td>
    </tr>
  `;
}

function renderAvailabilityDetails(details) {
  return `
    <div
      class="report-detail"
      data-testid="availability-report-detail"
      hidden
    >
      ${
        details.length
          ? `
              <div class="report-table-wrapper">
                <table
                  class="report-table"
                  data-testid="availability-report-table"
                >
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Crew Member</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    ${details
                      .map(renderAvailabilityDetailRow)
                      .join("")}
                  </tbody>
                </table>
              </div>
            `
          : renderReportDetailEmpty(
              "availability-report-detail-empty",
              "No availability responses are available."
            )
      }
    </div>
  `;
}

function renderAvailabilityDetailRow(row) {
  return `
    <tr
      data-testid="availability-report-row"
      data-crew-id="${escapeReportHtml(
        row.crewId
      )}"
    >
      <td>${escapeReportHtml(
        formatReportDate(row.date)
      )}</td>

      <td>${escapeReportHtml(
        row.crewName
      )}</td>

      <td>${escapeReportHtml(
        formatReportStatus(row.status)
      )}</td>
    </tr>
  `;
}

function renderReviewDetails(details) {
  return `
    <div
      class="report-detail"
      data-testid="review-report-detail"
      hidden
    >
      ${
        details.length
          ? `
              <div class="report-table-wrapper">
                <table
                  class="report-table"
                  data-testid="review-report-table"
                >
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Game</th>
                      <th>Field</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    ${details
                      .map(renderReviewDetailRow)
                      .join("")}
                  </tbody>
                </table>
              </div>
            `
          : renderReportDetailEmpty(
              "review-report-detail-empty",
              "No submitted reviews are available."
            )
      }
    </div>
  `;
}

function renderReviewDetailRow(row) {
  return `
    <tr
      data-testid="review-report-row"
      data-game-id="${escapeReportHtml(
        row.gameId
      )}"
    >
      <td>${escapeReportHtml(
        formatReportDate(row.date)
      )}</td>

      <td>
        <strong>${escapeReportHtml(
          row.matchup
        )}</strong>

        <span class="report-table-secondary">
          ${escapeReportHtml(row.level)}
        </span>
      </td>

      <td>${escapeReportHtml(row.field)}</td>
      <td>${escapeReportHtml(row.statusLabel)}</td>
    </tr>
  `;
}

function renderReportDetailEmpty(
  testId,
  message
) {
  return `
    <div
      class="report-detail-empty"
      data-testid="${escapeReportHtml(testId)}"
    >
      ${escapeReportHtml(message)}
    </div>
  `;
}

function renderReportMetric(
  label,
  value,
  testId
) {
  return `
    <div class="report-summary-row">
      <dt>${escapeReportHtml(label)}</dt>
      <dd data-testid="${escapeReportHtml(testId)}">
        ${escapeReportHtml(value)}
      </dd>
    </div>
  `;
}

function handleReportExport(section) {
  const filters = {
    ...reportsPageState
  };

  const factories = {
    assignment:
      reportExportService
        .getAssignmentExport,
    availability:
      reportExportService
        .getAvailabilityExport,
    review:
      reportExportService
        .getReviewExport
  };

  const factory = factories[section];

  if (!factory) {
    return false;
  }

  const exportFile =
    factory(filters);

  return reportExportService.download(
    exportFile
  );
}

function toggleReportDetails(section) {
  const detail = document.querySelector(
    `[data-testid="${section}-report-detail"]`
  );

  const button = document.querySelector(
    `[data-testid="${section}-report-toggle"]`
  );

  if (!detail || !button) {
    return;
  }

  const nextExpanded = detail.hidden;

  detail.hidden = !nextExpanded;

  button.setAttribute(
    "aria-expanded",
    String(nextExpanded)
  );

  button.textContent = nextExpanded
    ? "Hide Details"
    : "View Details";
}

function formatReportDate(dateString) {
  if (!dateString) {
    return "";
  }

  const date = new Date(
    `${dateString}T00:00:00`
  );

  return date.toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric"
    }
  );
}

function formatReportStatus(status) {
  return String(status || "no-response")
    .split("-")
    .map(word =>
      word
        ? word[0].toUpperCase() +
          word.slice(1)
        : ""
    )
    .join(" ");
}

function escapeReportHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
