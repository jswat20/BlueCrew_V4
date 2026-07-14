// js/ui/profile.js

let profileFormSnapshot = null;
let profileFormMessage = "";
let profileFormError = "";

function escapeProfileHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatProfileRole(role) {
  return String(role || "umpire")
    .replaceAll("_", " ")
    .replace(/\b\w/g, letter =>
      letter.toUpperCase()
    );
}

function renderProfile() {
  const profile = portalService.getProfile();

  if (!profile) {
    return `
      <section
        class="page-section"
        data-testid="profile-unavailable"
      >
        <h2>Profile unavailable</h2>
        <p>Log in to view your profile.</p>
      </section>
    `;
  }

  profileFormSnapshot = { ...profile };

  return renderProfileForm(profile);
}

const COMMUNICATION_PROFILE_OPTIONS = [
  {
    key: "assignments",
    label: "Assignment notifications"
  },
  {
    key: "claims",
    label: "Claim notifications"
  },
  {
    key: "reviews",
    label: "Review notifications"
  },
  {
    key: "availability",
    label: "Availability notifications"
  },
  {
    key: "accounts",
    label: "Account notifications"
  },
  {
    key: "activityDigest",
    label: "Activity digest"
  },
  {
    key: "soundEnabled",
    label: "Sound enabled"
  },
  {
    key: "desktopNotifications",
    label: "Desktop notifications",
    description:
      "Future-ready browser notification preference."
  }
];

function renderCommunicationProfileOption(
  option,
  preferences
) {
  return `
    <label
      class="settings-option"
      data-testid="communication-option-${
        escapeProfileHtml(option.key)
      }"
    >
      <span>
        <strong>
          ${escapeProfileHtml(option.label)}
        </strong>

        ${
          option.description
            ? `
                <small class="muted">
                  ${escapeProfileHtml(
                    option.description
                  )}
                </small>
              `
            : ""
        }
      </span>

      <input
        type="checkbox"
        role="switch"
        data-testid="communication-${
          escapeProfileHtml(option.key)
        }"
        ${
          preferences[option.key] === true
            ? "checked"
            : ""
        }
        onchange="handleCommunicationPreferenceChange(
          '${escapeProfileHtml(option.key)}',
          this.checked
        )"
      >
    </label>
  `;
}

function renderProfileForm(profile) {
  return `
    <section
      class="page-section"
      data-testid="profile"
    >
      <div class="section-header">
        <div>
          <h2>My Profile</h2>
          <p>
            Manage your contact and emergency
            information.
          </p>
        </div>
      </div>

      ${
        profileFormMessage
          ? `
            <div
              class="success-message"
              data-testid="profile-success"
            >
              ${escapeProfileHtml(
                profileFormMessage
              )}
            </div>
          `
          : ""
      }

      ${
        profileFormError
          ? `
            <div
              class="validation-message"
              data-testid="profile-error"
              role="alert"
            >
              ${escapeProfileHtml(
                profileFormError
              )}
            </div>
          `
          : ""
      }

      <form
        class="form-card"
        data-testid="profile-form"
        novalidate
        onsubmit="handleSaveProfile(event)"
      >
        <div class="form-grid">
          <label>
            Name
            <input
              type="text"
              data-testid="profile-name"
              value="${escapeProfileHtml(
                profile.name
              )}"
              disabled
            >
          </label>

          <label>
            Role
            <input
              type="text"
              data-testid="profile-role"
              value="${escapeProfileHtml(
                formatProfileRole(profile.role)
              )}"
              disabled
            >
          </label>

          <label>
            Crew Assignment
            <input
              type="text"
              data-testid="profile-crew"
              value="${escapeProfileHtml(
                profile.crewName
              )}"
              disabled
            >
          </label>

          <label>
            Email
            <input
              type="email"
              id="profile-email"
              data-testid="profile-email"
              value="${escapeProfileHtml(
                profile.email
              )}"
              required
            >
          </label>

          <label>
            Phone
            <input
              type="tel"
              id="profile-phone"
              data-testid="profile-phone"
              value="${escapeProfileHtml(
                profile.phone
              )}"
            >
          </label>

          <label>
            Address
            <input
              type="text"
              id="profile-address"
              data-testid="profile-address"
              value="${escapeProfileHtml(
                profile.address
              )}"
            >
          </label>

          <label>
            Emergency Contact
            <input
              type="text"
              id="profile-emergency-contact"
              data-testid="profile-emergency-contact"
              value="${escapeProfileHtml(
                profile.emergencyContact
              )}"
            >
          </label>

          <label>
            Emergency Contact Phone
            <input
              type="tel"
              id="profile-emergency-phone"
              data-testid="profile-emergency-phone"
              value="${escapeProfileHtml(
                profile.emergencyContactPhone
              )}"
            >
          </label>
        </div>

        <section
          class="settings-section"
          id="profile-communication"
          data-testid="profile-communication"
        >
          <div class="section-header">
            <div>
              <h3>Communication</h3>

              <p class="muted">
                Choose which in-app updates
                appear in your Notification Center.
              </p>
            </div>
          </div>

          <div
            class="settings-options"
            data-testid="communication-options"
          >
            ${COMMUNICATION_PROFILE_OPTIONS
              .map(option =>
                renderCommunicationProfileOption(
                  option,
                  profile
                    .communicationPreferences ||
                    accountService
                      .getDefaultCommunicationPreferences()
                )
              )
              .join("")}
          </div>
        </section>

        <div class="form-actions">
          <button
            type="submit"
            data-testid="profile-save"
          >
            Save
          </button>

          <button
            type="button"
            class="secondary"
            data-testid="profile-cancel"
            onclick="handleCancelProfileEdit()"
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  `;
}

function getProfileFormValues() {
  return {
    email:
      document.getElementById(
        "profile-email"
      )?.value || "",
    phone:
      document.getElementById(
        "profile-phone"
      )?.value || "",
    address:
      document.getElementById(
        "profile-address"
      )?.value || "",
    emergencyContact:
      document.getElementById(
        "profile-emergency-contact"
      )?.value || "",
    emergencyContactPhone:
      document.getElementById(
        "profile-emergency-phone"
      )?.value || "",
    communicationPreferences:
      portalService.getProfile()
        ?.communicationPreferences ||
      accountService
        .getDefaultCommunicationPreferences()
  };
}

function handleCommunicationPreferenceChange(
  key,
  enabled
) {
  profileFormMessage = "";
  profileFormError = "";

  const current =
    portalService.getProfile();

  if (!current) {
    profileFormError =
      "Unable to save communication preference.";

    renderPage("profile", {
      section: "communication"
    });

    return;
  }

  const result =
    portalService.saveProfile({
      ...getProfileFormValues(),
      communicationPreferences: {
        ...current.communicationPreferences,
        [key]: enabled === true
      }
    });

  if (!result.success) {
    profileFormError =
      result.message ||
      "Unable to save communication preference.";

    renderPage("profile", {
      section: "communication"
    });

    return;
  }

  profileFormMessage =
    "Communication preference saved.";

  profileFormSnapshot = {
    ...portalService.getProfile()
  };

  renderPage("profile", {
    section: "communication"
  });
}

function handleSaveProfile(event) {
  event?.preventDefault();

  profileFormMessage = "";
  profileFormError = "";

  const result = portalService.saveProfile(
    getProfileFormValues()
  );

  if (!result.success) {
    profileFormError =
      result.message ||
      "Unable to save profile.";

    renderPage("profile");
    return;
  }

  profileFormMessage =
    result.message || "Profile saved.";

  profileFormSnapshot =
    portalService.getProfile();

  renderPage("profile");
}

function handleCancelProfileEdit() {
  profileFormMessage = "";
  profileFormError = "";

  const current =
    profileFormSnapshot ||
    portalService.getProfile();

  const content =
    document.getElementById("app-content");

  if (!content || !current) {
    renderPage("profile");
    return;
  }

  content.innerHTML = `
    <div
      class="page-wrapper"
      data-testid="page-profile"
    >
      ${renderProfileForm(current)}
    </div>
  `;
}
