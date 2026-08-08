// js/ui/profile.js

let profileFormSnapshot = null;
let profileFormMessage = "";
let profileFormError = "";
let profilePendingPhotoDataUrl = "";

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
  profilePendingPhotoDataUrl = profile.photoDataUrl || "";

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
  const account = accountService.getById(profile.id);
  const crewCard =
    typeof getCrewCardModel === "function"
      ? getCrewCardModel(account)
      : null;

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
              role="status"
              aria-live="polite"
              tabindex="-1"
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

      <div class="profile-crew-card-preview" data-testid="profile-crew-card-front">
        ${typeof renderCrewCardFront === "function" ? renderCrewCardFront(accountService.getById(profile.id), { testId: "profile-crew-card", hideLevels: true }) : ""}
      </div>

      <form
        class="form-card profile-form-card"
        data-testid="profile-form"
        novalidate
        onsubmit="handleSaveProfile(event)"
      >
        <section class="profile-details-section" aria-labelledby="profile-details-title">
          <div class="profile-section-heading"><div><h3 id="profile-details-title">Profile Details</h3><p>Account identity, contact, and emergency information.</p></div></div>
        <div class="form-grid profile-details-grid">
          <label>
            Crew ID
            <input type="text" data-testid="profile-crew-id" value="${escapeProfileHtml(profile.crewCode || "Not issued")}" disabled>
          </label>

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
            Birthdate
            <input type="text" data-testid="profile-birthdate" value="${escapeProfileHtml(profile.birthdate ? formatCrewCardDate(profile.birthdate) : "Not recorded")}" disabled>
          </label>

          <label>
            Age
            <input type="text" data-testid="profile-age" value="${escapeProfileHtml(profile.age ?? "Not recorded")}" disabled>
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
            Home Phone
            <input type="tel" id="profile-home-phone" data-testid="profile-home-phone" value="${escapeProfileHtml(profile.homePhone || "")}">
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
            Contact Preference
            <select id="profile-contact-preference" data-testid="profile-contact-preference"><option value="text" ${profile.contactPreference !== "call" ? "selected" : ""}>Text</option><option value="call" ${profile.contactPreference === "call" ? "selected" : ""}>Call</option></select>
          </label>

          <label>
            Crew Photo
            <input type="file" id="profile-photo" data-testid="profile-photo" accept="image/jpeg,image/png,image/webp" onchange="handleProfilePhotoSelected(this)">
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
        </div></section>

        <section class="profile-credentials" data-testid="profile-credentials">
          <div class="section-header">
            <div>
              <h3>Crew Information</h3>
              <p class="muted">Verified crew and service information.</p>
            </div>
          </div>
          <div class="profile-credential-grid">
            <div>
              <span>Status</span>
              <strong>${escapeProfileHtml(crewCard?.statusLabel || profile.status || "Pending")}</strong>
            </div>
            <div>
              <span>Years of Service</span>
              <strong>${escapeProfileHtml(crewCard?.yearsOfService ?? profile.yearsOfService ?? 0)}</strong>
            </div>
            <div>
              <span>Crew Assignment</span>
              <strong>${escapeProfileHtml(profile.crewName || "Not assigned")}</strong>
            </div>
          </div>
        </section>

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

        <div class="form-actions responsive-actions">
          <button
            type="submit"
            class="button button-primary"
            data-testid="profile-save"
          >
            Save
          </button>

          <button
            type="button"
            class="button button-secondary"
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
    homePhone: document.getElementById("profile-home-phone")?.value || "",
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
    contactPreference: document.getElementById("profile-contact-preference")?.value || "text",
    photoDataUrl: profilePendingPhotoDataUrl,
    communicationPreferences:
      portalService.getProfile()
        ?.communicationPreferences ||
      accountService
        .getDefaultCommunicationPreferences()
  };
}

async function handleProfilePhotoSelected(input) {
  profileFormMessage = "";
  const result = await crewPhotoService.processFile(input.files?.[0]);
  if (!result.success) {
    profileFormError = result.message;
    input.value = "";
    const error = document.querySelector('[data-testid="profile-error"]');
    if (error) error.textContent = result.message;
    return;
  }
  profilePendingPhotoDataUrl = result.data;
  profileFormMessage = "Photo ready to save.";
  const photo = document.querySelector('[data-testid="profile-crew-card"] .crew-credential-photo');
  if (photo) {
    const preview = document.createElement("img");
    preview.className = photo.className.replace("crew-credential-photo-fallback", "");
    preview.src = result.data;
    preview.alt = "Selected crew photo preview";
    photo.replaceWith(preview);
  }
}

async function handleCommunicationPreferenceChange(
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

  const profileChanges = {
      ...getProfileFormValues(),
      communicationPreferences: {
        ...current.communicationPreferences,
        [key]: enabled === true
      }
    };
  const result = typeof supabaseClientService !== "undefined" && supabaseClientService.isConfigured()
    ? await portalService.saveProfileShared(profileChanges)
    : portalService.saveProfile(profileChanges);

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

  announceToScreenReader(
    profileFormMessage
  );

  focusElementWhenReady(
    '[data-testid="profile-success"]'
  );
}

async function handleSaveProfile(event) {
  event?.preventDefault();

  profileFormMessage = "";
  profileFormError = "";

  const values = getProfileFormValues();
  const result = typeof supabaseClientService !== "undefined" && supabaseClientService.isConfigured()
    ? await portalService.saveProfileShared(values)
    : portalService.saveProfile(values);

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

  announceToScreenReader(
    profileFormMessage
  );

  focusElementWhenReady(
    '[data-testid="profile-success"]'
  );
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
