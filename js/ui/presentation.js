// js/ui/presentation.js

function escapePresentationHtml(
  value
) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const PRESENTATION_BUTTON_VARIANTS =
  Object.freeze({
    primary: "button-primary",
    secondary: "button-secondary",
    destructive: "button-danger",
    link: "button-link"
  });

function getPresentationButtonClass({
  variant = "secondary",
  compact = false,
  className = ""
} = {}) {
  const variantClass =
    PRESENTATION_BUTTON_VARIANTS[
      variant
    ] ||
    PRESENTATION_BUTTON_VARIANTS.secondary;

  return [
    "button",
    variantClass,
    compact
      ? "button-compact"
      : "",
    className
  ]
    .filter(Boolean)
    .join(" ");
}

function renderPageHeader({
  title,
  subtitle = "",
  badge = "",
  badgeTestId = "",
  actions = "",
  className = "section-header"
} = {}) {
  return `
    <div
      class="${escapePresentationHtml(
        className
      )} presentation-page-header"
    >
      <div>
        <h2
          tabindex="-1"
          data-page-heading
        >
          ${escapePresentationHtml(title)}
        </h2>

        ${
          subtitle
            ? `
                <p class="muted">
                  ${escapePresentationHtml(
                    subtitle
                  )}
                </p>
              `
            : ""
        }
      </div>

      ${
        badge || actions
          ? `
              <div
                class="presentation-header-actions"
              >
                ${
                  badge
                    ? `
                        <span
                          class="status-pill"
                          ${
                            badgeTestId
                              ? `data-testid="${escapePresentationHtml(
                                  badgeTestId
                                )}"`
                              : ""
                          }
                        >
                          ${escapePresentationHtml(
                            badge
                          )}
                        </span>
                      `
                    : ""
                }

                ${actions}
              </div>
            `
          : ""
      }
    </div>
  `;
}

function renderCardHeader({
  title,
  subtitle = "",
  badge = "",
  badgeTestId = "",
  headingLevel = 2,
  className =
    "dashboard-card-header"
} = {}) {
  const headingTag =
    Number(headingLevel) === 3
      ? "h3"
      : "h2";

  return `
    <div
      class="${escapePresentationHtml(
        className
      )} presentation-card-header"
    >
      <div>
        <${headingTag}>
          ${escapePresentationHtml(title)}
        </${headingTag}>

        ${
          subtitle
            ? `
                <span class="card-subtitle">
                  ${escapePresentationHtml(
                    subtitle
                  )}
                </span>
              `
            : ""
        }
      </div>

      ${
        badge !== "" &&
        badge !== null &&
        badge !== undefined
          ? `
              <span
                class="status-badge"
                ${
                  badgeTestId
                    ? `data-testid="${escapePresentationHtml(
                        badgeTestId
                      )}"`
                    : ""
                }
              >
                ${escapePresentationHtml(
                  badge
                )}
              </span>
            `
          : ""
      }
    </div>
  `;
}

function renderEmptyState({
  title = "",
  message,
  action = "",
  testId = "",
  compact = false
} = {}) {
  return `
    <div
      class="empty-state presentation-empty-state${
        compact
          ? " presentation-empty-state-compact"
          : ""
      }"
      ${
        testId
          ? `data-testid="${escapePresentationHtml(
              testId
            )}"`
          : ""
      }
      role="status"
      aria-live="polite"
    >
      ${
        title
          ? `
              <h3>
                ${escapePresentationHtml(
                  title
                )}
              </h3>
            `
          : ""
      }

      <p>
        ${escapePresentationHtml(
          message || ""
        )}
      </p>

      ${action}
    </div>
  `;
}

function renderErrorState({
  title = "Something went wrong",
  message,
  action = "",
  testId = ""
} = {}) {
  return `
    <div
      class="presentation-error-state"
      ${
        testId
          ? `data-testid="${escapePresentationHtml(
              testId
            )}"`
          : ""
      }
      role="alert"
      aria-live="assertive"
    >
      <h3>
        ${escapePresentationHtml(title)}
      </h3>

      <p>
        ${escapePresentationHtml(
          message || ""
        )}
      </p>

      ${action}
    </div>
  `;
}

function renderStatusBadge({
  label,
  status = "neutral",
  testId = ""
} = {}) {
  return `
    <span
      class="status-badge status-badge-${escapePresentationHtml(
        status
      )}"
      data-status="${escapePresentationHtml(
        status
      )}"
      ${
        testId
          ? `data-testid="${escapePresentationHtml(
              testId
            )}"`
          : ""
      }
    >
      ${escapePresentationHtml(label)}
    </span>
  `;
}

function ensureAccessibilityLiveRegion() {
  let region =
    document.getElementById(
      "bluecrew-live-region"
    );

  if (region) {
    return region;
  }

  region =
    document.createElement("div");

  region.id =
    "bluecrew-live-region";

  region.className =
    "sr-only";

  region.setAttribute(
    "role",
    "status"
  );

  region.setAttribute(
    "aria-live",
    "polite"
  );

  region.setAttribute(
    "aria-atomic",
    "true"
  );

  document.body.appendChild(region);

  return region;
}

function announceToScreenReader(
  message
) {
  const region =
    ensureAccessibilityLiveRegion();

  region.textContent = "";

  window.requestAnimationFrame(() => {
    region.textContent =
      String(message || "");
  });
}

function focusElementWhenReady(
  selector,
  options = {}
) {
  window.requestAnimationFrame(() => {
    const element =
      document.querySelector(selector);

    if (!element) {
      return;
    }

    if (
      !element.hasAttribute("tabindex") &&
      !element.matches(
        "button, input, select, textarea, a[href]"
      )
    ) {
      element.setAttribute(
        "tabindex",
        "-1"
      );
    }

    element.focus({
      preventScroll:
        options.preventScroll === true
    });
  });
}

function focusPageHeading() {
  focusElementWhenReady(
    "#app-content [data-page-heading], " +
    "#app-content h1, " +
    "#app-content h2"
  );
}

function handleAccessibleActivation(
  event,
  callback
) {
  if (
    event.key !== "Enter" &&
    event.key !== " "
  ) {
    return;
  }

  event.preventDefault();

  if (
    typeof callback === "function"
  ) {
    callback();
  }
}
