// js/conflicts/conflictCard.js

const CONFLICT_ACTIONS = {
  open_assignment: {
    key: "assign",
    label: "Assign"
  },

  double_booking: {
    key: "resolve",
    label: "Resolve"
  },

  eligibility_issue: {
    key: "review",
    label: "Review"
  },

  overloaded_crew: {
    key: "redistribute",
    label: "Redistribute"
  },

  inactive_assignment: {
    key: "review",
    label: "Review"
  }
};

const CONFLICT_LABELS = {
  open_assignment: "Open Assignment",
  double_booking: "Double Booking",
  eligibility_issue: "Eligibility Issue",
  overloaded_crew: "Overloaded Crew",
  inactive_assignment: "Inactive Assignment"
};

function renderConflictCard(issue, handlers = {}) {
  const type =
    normalizeIssueType(issue.type);

  const action =
    CONFLICT_ACTIONS[type] || {
      key: "review",
      label: "Review"
    };

  return `
    <article class="conflict-card conflict-card-${type}">

      <div class="conflict-card-main">

        <div class="conflict-card-kicker">
          ${CONFLICT_LABELS[type] || "Issue"}
        </div>

        <h3>
          ${escapeHtml(issue.title || "Issue detected")}
        </h3>

        <p>
          ${escapeHtml(
            issue.message ||
            issue.description ||
            ""
          )}
        </p>

        ${
          issue.meta
            ? renderMeta(issue.meta)
            : ""
        }

      </div>

      <div class="conflict-card-action">

        <button
          class="conflict-action-btn"
          data-conflict-action="${action.key}"
          data-game-id="${issue.gameId || ""}"
          data-crew-id="${issue.crewId || ""}"
          data-issue-id="${issue.id || ""}">

          ${action.label}

        </button>

      </div>

    </article>
  `;
}

function bindConflictCardActions(
  container,
  handlers = {}
) {
  container
    .querySelectorAll("[data-conflict-action]")
    .forEach(button => {

      button.addEventListener("click", () => {

        const action =
          button.dataset.conflictAction;

        const payload = {

          issueId:
            button.dataset.issueId,

          gameId:
            button.dataset.gameId,

          crewId:
            button.dataset.crewId

        };

        if (handlers[action]) {
          handlers[action](payload);
          return;
        }

        window.dispatchEvent(
          new CustomEvent(
            "bluecrew:conflict-action",
            {
              detail: {
                action,
                payload
              }
            }
          )
        );

      });

    });
}

function normalizeIssueType(type = "") {
  return String(type)
    .trim()
    .toLowerCase()
    .replaceAll(" ", "_")
    .replaceAll("-", "_");
}

function renderMeta(meta) {

  if (!meta) {
    return "";
  }

  return `
    <div class="conflict-card-meta">

      ${Object.entries(meta)
        .map(([key, value]) => `
          <span>
            <strong>
              ${escapeHtml(
                formatMetaKey(key)
              )}:
            </strong>

            ${escapeHtml(value)}

          </span>
        `)
        .join("")}

    </div>
  `;
}

function formatMetaKey(key) {
  return String(key)
    .replace(/([A-Z])/g, " $1")
    .replaceAll("_", " ")
    .replace(/^./, c => c.toUpperCase());
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}