let crewCardOrigin = null;
let crewCardPendingAdminPhoto = null;

function escapeCrewCardHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function formatCrewCardPhone(value) {
  const phone = String(value || "").trim();
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 ? `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}` : phone;
}

function getCrewCardModel(crewOrId) {
  const suppliedAccount = typeof crewOrId === "object" && Object.prototype.hasOwnProperty.call(crewOrId, "role") ? crewOrId : null;
  const crewMember = suppliedAccount ? (suppliedAccount.crewId ? crewService.getById(suppliedAccount.crewId) : null) : (typeof crewOrId === "object" ? crewOrId : crewService.getById(crewOrId));
  const account = suppliedAccount || (crewMember
    ? accountService.getAll().find(item => String(item.crewId) === String(crewMember.id)) || null
    : accountService.getById(crewOrId));
  const linkedCrew = crewMember || (account?.crewId ? crewService.getById(account.crewId) : null);
  const firstName = linkedCrew?.firstName || account?.firstName || "";
  const lastName = linkedCrew?.lastName || account?.lastName || "";
  const history = account?.officialHistory || [];
  const identityStatus = linkedCrew?.identityStatus || (account?.id && linkedCrew ? "linked" : linkedCrew?.profileId ? "unknown" : "unlinked");
  return {
    accountId: account?.id || "",
    profileId: account?.id || linkedCrew?.profileId || "",
    crewRecordId: linkedCrew?.id || "",
    crewCode: account?.personnelId || linkedCrew?.personnelId || account?.crewCode || "Not issued",
    issuedAt: account?.personnelIdIssuedAt || linkedCrew?.personnelIdIssuedAt || account?.crewCodeIssuedAt || "",
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim() || "Unnamed Crew Member",
    role: account?.role === "assigner" ? "Assigner" : "Baseball Umpire",
    status: linkedCrew?.active === false || account?.status === "rejected" ? "Inactive" : account?.status === "pending" ? "Pending" : "Active",
    email: linkedCrew?.email || "",
    loginEmail: linkedCrew?.loginEmail || (identityStatus === "linked" ? account?.email || "" : ""),
    identityStatus,
    identityConflictCode: linkedCrew?.identityConflictCode || "",
    phone: formatCrewCardPhone(account?.phone || linkedCrew?.phone),
    homePhone: formatCrewCardPhone(account?.homePhone || linkedCrew?.profileHomePhone),
    address: account?.address || linkedCrew?.profileAddress || "",
    contactPreference: account?.contactPreference || linkedCrew?.profileContactPreference || "text",
    emergencyContact: account?.emergencyContact || linkedCrew?.profileEmergencyContact || "",
    emergencyContactPhone: formatCrewCardPhone(account?.emergencyContactPhone || linkedCrew?.profileEmergencyContactPhone),
    birthdate: account?.birthdate || linkedCrew?.birthdate || "",
    age: accountService.deriveAge(account?.birthdate || linkedCrew?.birthdate),
    photoDataUrl: account?.photoUrl || account?.photoDataUrl || "",
    photoPath: account?.photoPath || "",
    levels: [...(linkedCrew?.levels || [])],
    officialHistory: history.length ? history : (linkedCrew?.officialHistory || []),
    yearsOfService: accountService.deriveYearsOfService(history.length ? history : (linkedCrew?.officialHistory || [])),
    adminNotes: account?.adminNotes || linkedCrew?.notes || "",
    accountStatus: account?.status || (identityStatus === "conflict" ? "Identity Conflict" : identityStatus === "linked" ? "Linked" : "Unlinked roster record")
    ,dailyWorkload: linkedCrew ? workloadService.getCrewWorkloadForDate(linkedCrew.id, new Date().toISOString().split("T")[0]).count : 0
    ,seasonWorkload: linkedCrew ? workloadService.getSeasonAssignments(linkedCrew.id) : 0
  };
}

function getCrewCardInitialsFromModel(model) {
  return `${model.firstName?.[0] || ""}${model.lastName?.[0] || ""}`.toUpperCase() || "CR";
}

function renderCrewCardPhoto(model, className = "") {
  return model.photoDataUrl
    ? `<img class="crew-credential-photo ${className}" src="${escapeCrewCardHtml(model.photoDataUrl)}" alt="${escapeCrewCardHtml(model.fullName)}">`
    : `<span class="crew-credential-photo crew-credential-photo-fallback ${className}" role="img" aria-label="No photo available"><span>${escapeCrewCardHtml(getCrewCardInitialsFromModel(model))}</span></span>`;
}

function formatCrewCardLevel(level) {
  const canonical = levelTerminologyService.canonicalize(level);
  return authService.isAdmin?.() === true ? canonical : levelTerminologyService.format(canonical);
}

function formatCrewCardEligibilityBadge(level) {
  const canonical = levelTerminologyService.canonicalize(level);
  if (/^juniors?$/i.test(canonical)) return "JR";
  if (/^seniors?$/i.test(canonical)) return "SR";
  return canonical;
}

function renderCrewCardFront(crewMember, options = {}) {
  const model = getCrewCardModel(crewMember);
  const testId = options.testId || "crew-roster-member";
  return `<button type="button" class="crew-credential-front ${options.className || ""}" data-testid="${escapeCrewCardHtml(testId)}" data-crew-id="${escapeCrewCardHtml(model.crewRecordId)}" data-crew-active="${model.status === "Active"}" data-crew-search="${escapeCrewCardHtml(`${model.fullName} ${model.levels.join(" ")}`.toLowerCase())}" onclick="openCrewCredentialCard('${escapeCrewCardHtml(model.crewRecordId || model.accountId)}')" aria-label="Open Crew Card for ${escapeCrewCardHtml(model.fullName)}">
    <span class="crew-credential-front-main"><strong title="${escapeCrewCardHtml(model.fullName)}">${escapeCrewCardHtml(model.fullName)}</strong><span class="crew-credential-contact-summary">${model.email ? `<span title="${escapeCrewCardHtml(model.email)}">${escapeCrewCardHtml(model.email)}</span>` : ""}${model.phone ? `<span>${escapeCrewCardHtml(model.phone)}</span>` : ""}${!model.email && !model.phone ? "No contact recorded" : ""}</span>${options.hideLevels ? "" : `<span class="crew-credential-levels">${model.levels.map(level => `<i class="settings-pill">${escapeCrewCardHtml(formatCrewCardLevel(level))}</i>`).join("")}</span>`}</span>
    ${options.roleTestId ? `<span class="visually-hidden" data-testid="${escapeCrewCardHtml(options.roleTestId)}">Role: ${escapeCrewCardHtml(model.role === "Baseball Umpire" ? "Umpire" : model.role)}</span>` : ""}
  </button>`;
}

function formatCrewCardDate(value) {
  if (!value) return "Not recorded";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

function renderCrewCredentialFrontFace(model, options = {}) {
  return `<section class="crew-credential-face crew-credential-face-front">
    <div class="crew-credential-brand"><strong>The Slate</strong><span>Crew Card</span></div>
    ${renderCrewCardPhoto(model, "crew-credential-modal-photo")}
    <div class="crew-credential-front-identity"><small>${escapeCrewCardHtml(model.crewCode)}</small><h2>${escapeCrewCardHtml(model.fullName)}</h2><p>${escapeCrewCardHtml(model.role)}</p>${options.showEligibility ? `<div class="crew-credential-levels crew-credential-front-eligibility" data-testid="profile-front-eligibility">${model.levels.length ? model.levels.map(level => `<i class="settings-pill">${escapeCrewCardHtml(formatCrewCardEligibilityBadge(level))}</i>`).join("") : `<span>No eligibility levels assigned.</span>`}</div>` : ""}${options.showStatus === false ? "" : `<b data-status="${model.status.toLowerCase()}">${escapeCrewCardHtml(model.status)}</b>`}</div>
  </section>`;
}

function renderCrewCredentialBackFace(model) {
  const canSeeAdminNotes = authService.isAdmin?.() === true;
  const adminNoteItems = String(model.adminNotes || "")
    .split(/\r?\n|\s*•\s*/)
    .map(note => note.trim())
    .filter(Boolean);
  return `<section class="crew-credential-face crew-credential-face-back" data-testid="crew-card-back">
    <header class="crew-credential-back-header"><div><img class="crew-card-site-logo" src="assets/the-slate-logo.png" alt="The Slate logo"><strong>The Slate</strong><span>Crew Card</span></div><div><small>Crew ID</small><b data-testid="crew-card-id">${escapeCrewCardHtml(model.crewCode)}</b></div><p>Professional. Reliable. Game Ready.</p></header>
    <div class="crew-credential-identity-panel">
      <div class="crew-credential-photo-column"><div class="crew-credential-photo-block">${renderCrewCardPhoto(model, "crew-credential-modal-photo")}<b data-status="${model.status.toLowerCase()}">${escapeCrewCardHtml(model.status)}</b></div><section class="crew-credential-history-launch"><h3>Official History</h3><strong>${model.yearsOfService} ${model.yearsOfService === 1 ? "Season" : "Seasons"}</strong><button type="button" class="button button-secondary" data-testid="crew-card-view-official-history" onclick="openOfficialHistoryModal('${escapeCrewCardHtml(model.crewRecordId || model.accountId)}')">View Official History</button></section></div>
      <div class="crew-credential-identity-details" style="--crew-name-length:${model.fullName.length}"><h3>${escapeCrewCardHtml(model.role)}</h3><h2 id="crew-card-title">${escapeCrewCardHtml(model.fullName)}</h2><p class="crew-credential-inline-id"><span>Crew ID</span> ${escapeCrewCardHtml(model.crewCode)}</p><dl class="crew-credential-age"><div><dt>Age</dt><dd>${model.age ?? "Not recorded"}</dd></div><div><dt>Birthdate</dt><dd>${formatCrewCardDate(model.birthdate)}</dd></div><div><dt>Games Today</dt><dd>${model.dailyWorkload}</dd></div><div><dt>Season Total</dt><dd>${model.seasonWorkload}</dd></div></dl><section class="crew-credential-eligibility crew-credential-identity-eligibility" data-testid="crew-card-identity-eligibility"><h4>Eligibility</h4><div>${model.levels.length ? model.levels.map(level => `<span class="settings-pill">${escapeCrewCardHtml(formatCrewCardEligibilityBadge(level))}</span>`).join("") : "No eligibility levels assigned."}</div></section></div>
    </div>
    <section class="crew-credential-panel crew-credential-contact"><h3>Contact Information</h3><dl>
      <div><dt>Phone (Cell)</dt><dd>${model.phone ? `<button type="button" class="crew-contact-action" data-testid="crew-card-call-phone" onclick="confirmCrewPhoneCall('${escapeCrewCardHtml(model.phone)}')">${escapeCrewCardHtml(model.phone)}</button>` : "Not recorded"}</dd></div><div><dt>Phone (Home)</dt><dd>${escapeCrewCardHtml(model.homePhone || "Not recorded")}</dd></div>${canSeeAdminNotes ? `<div><dt>Login Identity</dt><dd data-testid="crew-card-identity-status">${model.identityStatus === "conflict" ? "Identity Conflict" : model.identityStatus === "linked" ? "Linked" : "Unlinked"}</dd></div><div><dt>Login Email</dt><dd data-testid="crew-card-login-email">${escapeCrewCardHtml(model.loginEmail || (model.identityStatus === "conflict" ? "Needs identity review" : "No login account linked"))}</dd></div>` : ""}<div><dt>Contact Email</dt><dd>${model.email ? `<button type="button" class="crew-contact-action" data-testid="crew-card-copy-email" onclick="copyCrewEmail('${escapeCrewCardHtml(model.email)}', this)">${escapeCrewCardHtml(model.email)}</button>` : "Not recorded"}</dd></div><div><dt>Address</dt><dd>${escapeCrewCardHtml(model.address || "Not recorded")}</dd></div><div><dt>Preferred Contact</dt><dd>${model.contactPreference === "call" ? "Call" : "Text"}</dd></div><div><dt>Account Status</dt><dd>${escapeCrewCardHtml(model.accountStatus)}</dd></div>
      <div><dt>Emergency Contact</dt><dd data-testid="crew-card-emergency-contact">${escapeCrewCardHtml(model.emergencyContact || "Not recorded")}</dd></div><div><dt>Emergency Phone</dt><dd data-testid="crew-card-emergency-phone">${escapeCrewCardHtml(model.emergencyContactPhone || "Not recorded")}</dd></div>
    </dl></section>
    ${canSeeAdminNotes ? `<section class="crew-credential-panel crew-credential-notes"><h3>Administrator Notes</h3><ul>${adminNoteItems.length ? adminNoteItems.map(note => `<li>${escapeCrewCardHtml(note)}</li>`).join("") : `<li>No administrator notes recorded.</li>`}</ul></section>` : ""}
  </section>`;
}

function openOfficialHistoryModal(memberId) {
  const model = getCrewCardModel(memberId);
  const origin = document.activeElement;
  document.getElementById("official-history-dialog")?.remove();
  const dialog = document.createElement("dialog");
  dialog.id = "official-history-dialog";
  dialog.className = "official-history-dialog";
  dialog.dataset.testid = "official-history-dialog";
  dialog.setAttribute("aria-labelledby", "official-history-title");
  const records = [...model.officialHistory].sort((a, b) => Number(b.year) - Number(a.year));
  dialog.innerHTML = `<article><header><div><span>Read-only record</span><h2 id="official-history-title">Official History</h2><p>${escapeCrewCardHtml(model.fullName)} · ${model.yearsOfService} official ${model.yearsOfService === 1 ? "season" : "seasons"}</p></div><button type="button" class="button button-secondary" data-testid="official-history-close" onclick="closeOfficialHistoryModal()">Close</button></header><ol data-testid="official-history-records">${records.length ? records.map(entry => `<li><b>${escapeCrewCardHtml(entry.year)}</b><span>${escapeCrewCardHtml(entry.label)}</span>${entry.note ? `<small>${escapeCrewCardHtml(entry.note)}</small>` : ""}</li>`).join("") : `<li>No official history recorded.</li>`}</ol></article>`;
  dialog.addEventListener("click", event => { if (event.target === dialog) closeOfficialHistoryModal(); });
  dialog.addEventListener("keydown", handleOfficialHistoryDialogKeydown);
  dialog.addEventListener("close", () => { dialog.remove(); origin?.focus?.(); }, { once: true });
  document.body.appendChild(dialog);
  dialog.showModal();
  dialog.querySelector('[data-testid="official-history-close"]')?.focus();
}

function closeOfficialHistoryModal() {
  document.getElementById("official-history-dialog")?.close();
}

function handleOfficialHistoryDialogKeydown(event) {
  if (event.key === "Escape") {
    event.preventDefault();
    closeOfficialHistoryModal();
    return;
  }
  handleCrewCardDialogKeydown(event);
}

function openCrewCredentialCard(memberId) {
  const model = getCrewCardModel(memberId);
  if (!model.crewRecordId && !model.accountId) return;
  document.getElementById("crew-credential-dialog")?.remove();
  crewCardOrigin = document.activeElement;
  const dialog = document.createElement("dialog");
  dialog.id = "crew-credential-dialog";
  dialog.className = "crew-credential-dialog";
  dialog.dataset.testid = "crew-card-dialog";
  dialog.setAttribute("aria-labelledby", "crew-card-title");
  const resetDisabled = model.identityStatus !== "linked";
  const identityAction = model.identityStatus === "unlinked" ? "link" : "relink";
  const useHostedCrewEditor = crewService.isSharedMode?.() && model.crewRecordId;
  dialog.innerHTML = `<article class="crew-credential-modal"><div class="crew-credential-dialog-actions"><button type="button" class="button button-secondary" onclick="closeCrewCard()">Close</button></div><div class="crew-credential-flipper" data-testid="crew-card-flipper">${renderCrewCredentialFrontFace(model)}${renderCrewCredentialBackFace(model)}</div><footer class="crew-credential-modal-footer">${authService.isAdmin?.() && model.crewRecordId ? `<button type="button" class="button button-secondary" data-testid="crew-card-password-reset" ${resetDisabled ? `disabled title="This crew member's login identity needs review before a password reset can be sent."` : `onclick="sendAdministrativePasswordReset('${escapeCrewCardHtml(model.profileId)}','${escapeCrewCardHtml(model.crewRecordId)}')"`}>Send Password Reset</button><button type="button" class="button button-secondary" data-testid="crew-card-${identityAction}-identity" onclick="openCrewIdentityManager('${escapeCrewCardHtml(model.crewRecordId)}','${identityAction}')">${identityAction === "link" ? "Link" : "Relink"} Login Account</button>${model.profileId ? `<button type="button" class="button button-secondary" data-testid="crew-card-unlink-identity" onclick="manageCrewIdentity('${escapeCrewCardHtml(model.crewRecordId)}','unlink')">Unlink Login Account</button>` : ""}` : ""}${authService.isAdmin?.() && useHostedCrewEditor ? `<button type="button" class="button button-primary" data-testid="crew-card-edit" data-crew-id="${escapeCrewCardHtml(model.crewRecordId)}">Edit Crew Profile</button>` : authService.isAdmin?.() && model.accountId ? `<button type="button" class="button button-primary" data-testid="crew-card-edit" onclick="openCrewCardAdminEditor('${escapeCrewCardHtml(model.accountId)}')">Edit Crew Profile</button>` : authService.isAdmin?.() && model.crewRecordId ? `<button type="button" class="button button-primary" data-testid="crew-card-edit" data-crew-id="${escapeCrewCardHtml(model.crewRecordId)}">Edit Crew Profile</button>` : ""}</footer></article>`;
  dialog.addEventListener("click", event => { if (event.target === dialog) closeCrewCard(); });
  dialog.addEventListener("keydown", handleCrewCardDialogKeydown);
  dialog.addEventListener("close", () => { dialog.remove(); crewCardOrigin?.focus?.(); crewCardOrigin = null; }, { once: true });
  document.body.appendChild(dialog);
  dialog.showModal();
  dialog.querySelector("button")?.focus();
  requestAnimationFrame(() => dialog.querySelector(".crew-credential-flipper")?.classList.add("is-flipped"));
}

function openHostedCrewEditorFromCard(event, crewMemberId) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  if (!openEditCrewDrawer(crewMemberId)) return false;
  closeCrewCard();
  document.querySelector("#crew-drawer input:not([readonly])")?.focus();
  return true;
}

function renderCrewCardEditShell(title, subtitle, body, testId) {
  return `<article class="crew-credential-modal crew-card-edit-mode" data-testid="${testId}"><header class="crew-card-edit-header"><div><span>Crew Card</span><h2>${escapeCrewCardHtml(title)}</h2><p>${escapeCrewCardHtml(subtitle)}</p></div><button type="button" class="button button-secondary" onclick="cancelCrewCardEditMode()">Cancel</button></header>${body}</article>`;
}

function openCrewCardAdminEditMode(crewMemberId) {
  if (!authService.isAdmin?.()) return false;
  const member = crewService.getById(crewMemberId);
  const dialog = document.getElementById("crew-credential-dialog");
  if (!member || !dialog || typeof renderEditCrewDrawerContent !== "function") return false;
  dialog.dataset.editMode = "administrator";
  dialog.dataset.crewId = String(member.id);
  dialog.innerHTML = renderCrewCardEditShell("Edit Crew Member", getCrewComponentFullName(member), `<div class="unified-crew-admin-editor">${renderEditCrewDrawerContent(member)}</div>`, "crew-card-admin-edit-mode");
  dialog.querySelectorAll('[onclick="closeCrewDrawer()"]')?.forEach(control => control.setAttribute("onclick", "cancelCrewCardEditMode()"));
  dialog.querySelector("input:not([readonly])")?.focus();
  return true;
}

function renderOwnCrewCardEditForm(profile) {
  const model = getCrewCardModel(accountService.getById(profile.id) || profile);
  const hostedPhotoControls = supabaseClientService.isConfigured() ? `<section class="profile-photo-editor" aria-labelledby="profile-photo-title"><h3 id="profile-photo-title">Profile Photo</h3><div class="profile-photo-editor-content"><div data-testid="profile-photo-preview">${renderCrewCardPhoto(model, "crew-credential-modal-photo")}</div><div><label for="profile-photo">Choose a photo</label><input id="profile-photo" data-testid="profile-photo-input" type="file" accept="image/jpeg,image/png,image/webp" onchange="handleOwnProfilePhotoSelected(this)"><p class="muted">JPEG, PNG, or WebP. Maximum 5 MB.</p><div class="profile-photo-actions"><button type="button" class="button button-secondary" data-testid="profile-photo-upload" onclick="uploadOwnProfilePhoto()" disabled>Upload Photo</button><button type="button" class="button button-secondary" data-testid="profile-photo-remove" onclick="removeOwnProfilePhoto()" ${profile.photoPath ? "" : "disabled"}>Remove Photo</button></div></div></div><div class="validation-message" data-testid="profile-photo-error" role="alert" hidden></div><div class="success-message" data-testid="profile-photo-status" role="status" aria-live="polite" hidden></div></section>` : "";
  return `<form class="unified-crew-self-editor" data-testid="crew-card-self-edit-mode" onsubmit="saveOwnCrewCardEdit(event)">${hostedPhotoControls}<section><h3>Contact Information</h3><div class="unified-crew-edit-grid"><label>Primary / Cell Phone<input id="profile-phone" data-testid="profile-phone" type="tel" value="${escapeCrewCardHtml(profile.phone || "")}"></label><label>Home Phone<input id="profile-home-phone" data-testid="profile-home-phone" type="tel" value="${escapeCrewCardHtml(profile.homePhone || "")}"></label><label class="wide">Address<input id="profile-address" data-testid="profile-address" value="${escapeCrewCardHtml(profile.address || "")}"></label><label>Preferred Contact<select id="profile-contact-preference" data-testid="profile-contact-preference"><option value="text" ${profile.contactPreference !== "call" ? "selected" : ""}>Text</option><option value="call" ${profile.contactPreference === "call" ? "selected" : ""}>Call</option></select></label><label class="wide">Login Email<input value="${escapeCrewCardHtml(profile.email || "")}" readonly data-testid="profile-login-email-readonly"></label></div></section><section><h3>Emergency Contact</h3><div class="unified-crew-edit-grid"><label>Emergency Contact<input id="profile-emergency-contact" data-testid="profile-emergency-contact" value="${escapeCrewCardHtml(profile.emergencyContact || "")}"></label><label>Emergency Phone<input id="profile-emergency-phone" data-testid="profile-emergency-phone" type="tel" value="${escapeCrewCardHtml(profile.emergencyContactPhone || "")}"></label></div></section><div class="validation-message" data-testid="profile-error" hidden role="alert"></div><footer><button type="button" class="button button-secondary" onclick="cancelCrewCardEditMode()">Cancel</button><button type="submit" class="button button-primary" data-testid="profile-save">Save My Information</button></footer></form>`;
}

let pendingOwnProfilePhoto = null;

function setOwnProfilePhotoMessage(message, isError = false) {
  const error = document.querySelector('[data-testid="profile-photo-error"]');
  const status = document.querySelector('[data-testid="profile-photo-status"]');
  if (error) { error.hidden = !isError; error.textContent = isError ? message : ""; }
  if (status) { status.hidden = isError || !message; status.textContent = !isError ? message : ""; }
}

function handleOwnProfilePhotoSelected(input) {
  const validation = profilePhotoService.validateFile(input.files?.[0]);
  const upload = document.querySelector('[data-testid="profile-photo-upload"]');
  if (!validation.success) {
    pendingOwnProfilePhoto = null;
    input.value = "";
    upload?.setAttribute("disabled", "");
    setOwnProfilePhotoMessage(validation.message, true);
    return;
  }
  pendingOwnProfilePhoto = validation.data;
  const preview = document.querySelector('[data-testid="profile-photo-preview"]');
  if (preview) preview.innerHTML = `<img class="crew-credential-photo crew-credential-modal-photo" src="${escapeCrewCardHtml(URL.createObjectURL(validation.data))}" alt="Selected profile photo preview">`;
  upload?.removeAttribute("disabled");
  setOwnProfilePhotoMessage("Photo ready to upload.");
}

async function uploadOwnProfilePhoto() {
  if (!pendingOwnProfilePhoto) return;
  const result = await profilePhotoService.uploadOwnPhoto(pendingOwnProfilePhoto);
  if (!result.success) { setOwnProfilePhotoMessage(result.message, true); return; }
  pendingOwnProfilePhoto = null;
  renderPage("profile");
  openOwnCrewCardEditMode();
  setOwnProfilePhotoMessage(result.message);
}

async function removeOwnProfilePhoto() {
  const result = await profilePhotoService.removeOwnPhoto();
  if (!result.success) { setOwnProfilePhotoMessage(result.message, true); return; }
  renderPage("profile");
  openOwnCrewCardEditMode();
  setOwnProfilePhotoMessage(result.message);
}

function openOwnCrewCardEditMode() {
  const profile = portalService.getProfile();
  if (!profile) return false;
  const account = accountService.getById(profile.id) || profile;
  if (account.crewId) openCrewCredentialCard(account.crewId);
  else {
    closeCrewCard();
    const selfDialog = document.createElement("dialog");
    selfDialog.id = "crew-credential-dialog";
    selfDialog.className = "crew-credential-dialog";
    document.body.appendChild(selfDialog);
    selfDialog.addEventListener("close", () => selfDialog.remove(), { once: true });
    selfDialog.showModal();
  }
  const dialog = document.getElementById("crew-credential-dialog");
  if (!dialog) return false;
  dialog.dataset.editMode = "self";
  dialog.dataset.crewId = String(account.crewId || "");
  dialog.innerHTML = renderCrewCardEditShell("Edit My Information", "Only your authorized profile fields can be changed.", renderOwnCrewCardEditForm(profile), "crew-card-self-edit-shell");
  dialog.querySelector("input:not([readonly])")?.focus();
  return true;
}

async function saveOwnCrewCardEdit(event) {
  event.preventDefault();
  const profile = portalService.getProfile();
  const error = document.querySelector('#crew-credential-dialog [data-testid="profile-error"]');
  const values = { email: profile.email, phone: document.getElementById("profile-phone").value, homePhone: document.getElementById("profile-home-phone").value, address: document.getElementById("profile-address").value, contactPreference: document.getElementById("profile-contact-preference").value, emergencyContact: document.getElementById("profile-emergency-contact").value, emergencyContactPhone: document.getElementById("profile-emergency-phone").value, communicationPreferences: profile.communicationPreferences };
  const result = typeof supabaseClientService !== "undefined" && supabaseClientService.isConfigured() ? await portalService.saveProfileShared(values) : portalService.saveProfile(values);
  if (!result.success) { error.hidden = false; error.textContent = result.message || "Profile could not be saved."; return; }
  profileFormMessage = result.message || "Profile saved.";
  closeCrewCard();
  renderPage("profile");
  toastService?.success?.("Profile saved.");
  announceToScreenReader?.("Profile saved.");
  focusElementWhenReady?.('[data-testid="profile-success"]');
}

function cancelCrewCardEditMode() {
  const dialog = document.getElementById("crew-credential-dialog");
  const crewId = dialog?.dataset.crewId;
  closeCrewCard();
  if (dialog?.dataset.editMode === "administrator" && crewId) requestAnimationFrame(() => openCrewCredentialCard(crewId));
}

function showCrewEditorLaunchError(code = "CREW-EDIT-E6") {
  const safeCode = /^CREW-EDIT-E[1-6]$/.test(code) ? code : "CREW-EDIT-E6";
  const message = `Unable to open Crew editor. Please try again. [${safeCode}]`;
  if (typeof toastService !== "undefined" && typeof toastService.error === "function") {
    toastService.error(message);
    return;
  }
  const dialog = document.querySelector("#crew-credential-dialog, #crew-card-dialog");
  if (!dialog) return;
  let status = dialog.querySelector('[data-testid="crew-editor-launch-error"]');
  if (!status) {
    status = document.createElement("p");
    status.dataset.testid = "crew-editor-launch-error";
    status.className = "form-status";
    status.setAttribute("role", "alert");
    dialog.querySelector("footer")?.before(status);
  }
  status.textContent = message;
}

async function launchHostedCrewEditor(crewMemberId) {
  try {
    await Promise.resolve(openEditCrewDrawer(crewMemberId));
    await new Promise(resolve => requestAnimationFrame(resolve));
    const drawer = document.getElementById("crew-drawer");
    if (!drawer) throw new Error("crew_editor_not_created");
    for (const selector of ["#crew-credential-dialog", "#crew-card-dialog"]) {
      const dialog = document.querySelector(selector);
      if (dialog?.open) dialog.close();
    }
    drawer.querySelector("input:not([readonly])")?.focus();
    return true;
  } catch (error) {
    console.error("Crew editor launch failed.", error);
    showCrewEditorLaunchError(error?.crewEditCode);
    return false;
  }
}

if (!window.__slateHostedCrewEditListener) {
  window.__slateHostedCrewEditListener = true;
  document.addEventListener("click", event => {
    const control = event.target.closest?.('[data-testid="crew-card-edit"][data-crew-id]');
    if (!control || !crewService.isSharedMode?.()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (document.getElementById("crew-credential-dialog")) openCrewCardAdminEditMode(control.dataset.crewId);
    else void launchHostedCrewEditor(control.dataset.crewId);
  }, true);
}

async function openCrewIdentityManager(crewMemberId, action) {
  const choices = await crewService.getLinkableLoginProfiles();
  if (!choices.success) return showToast(choices.message, "error");
  const available = choices.data.filter(item => String(item.profile_id) !== String(loginService.getCurrentAccount()?.id));
  if (!available.length) return showToast("No compatible approved umpire login account is available.", "error");
  const selected = window.prompt(`Enter the exact Login Email to ${action}:\n${available.map(item => item.login_email).join("\n")}`);
  if (!selected) return;
  const target = available.find(item => String(item.login_email).toLowerCase() === String(selected).trim().toLowerCase());
  if (!target) return showToast("Select an available Login Email exactly as shown.", "error");
  if (!window.confirm(`${action === "relink" ? "Relink" : "Link"} this crew record to ${target.login_email}? Contact Email will not change.`)) return;
  await manageCrewIdentity(crewMemberId, action, target.profile_id);
}

async function manageCrewIdentity(crewMemberId, action, profileId = null) {
  if (action === "unlink" && !window.confirm("Unlink this login account? The Auth user and Contact Email will not be deleted or changed.")) return;
  const result = await crewService.manageLoginIdentity(crewMemberId, action, profileId);
  showToast(result.message, result.success ? "success" : "error");
  if (result.success) { closeCrewCard(); renderPage(currentPage); }
}

// Preserve every existing call site while ensuring it resolves to this credential modal,
// not the retired workload-panel implementation loaded earlier in the page.
window.openCrewCard = openCrewCredentialCard;

function handleCrewCardDialogKeydown(event) {
  const dialog = event.currentTarget;
  if (event.key === "Escape") { event.preventDefault(); closeCrewCard(); return; }
  if (event.key !== "Tab") return;
  const focusable = [...dialog.querySelectorAll('button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])')].filter(element => !element.disabled && !element.hidden);
  if (!focusable.length) return;
  const first = focusable[0]; const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

function closeCrewCard() {
  document.getElementById("crew-credential-dialog")?.close();
}

function openCrewCardAdminEditor(accountId) {
  const account = accountService.getById(accountId); if (!account || !authService.isAdmin?.()) return;
  const model = getCrewCardModel(account.crewId || account.id); crewCardPendingAdminPhoto = account.photoDataUrl || "";
  document.getElementById("crew-card-admin-dialog")?.remove();
  const dialog = document.createElement("dialog"); dialog.id = "crew-card-admin-dialog"; dialog.className = "crew-card-admin-dialog"; dialog.dataset.testid = "crew-card-admin-dialog";
  const historyText = (account.officialHistory || []).map(entry => `${entry.year}|${entry.label}|${entry.note || ""}`).join("\n");
  dialog.innerHTML = `<form method="dialog" class="crew-card-admin-form" onsubmit="saveCrewCardAdminProfile(event, '${escapeCrewCardHtml(account.id)}')"><header><div><span>Administrator Edit</span><h2>Edit ${escapeCrewCardHtml(model.fullName)}</h2></div><button type="button" class="button button-secondary" onclick="this.closest('dialog').close()">Close</button></header><div class="crew-card-admin-grid">
    <label>Crew ID<input value="${escapeCrewCardHtml(account.crewCode)}" readonly data-testid="crew-admin-id"></label><label>Photo<input type="file" accept="image/jpeg,image/png,image/webp" data-testid="crew-admin-photo" onchange="handleCrewAdminPhotoSelected(this)"><span class="crew-admin-photo-preview" data-testid="crew-admin-photo-preview">${renderCrewCardPhoto(model)}</span></label>
    <label>First Name<input id="crew-admin-first" value="${escapeCrewCardHtml(account.firstName)}" required></label><label>Last Name<input id="crew-admin-last" value="${escapeCrewCardHtml(account.lastName)}" required></label><label>Birthdate<input id="crew-admin-birthdate" type="date" value="${escapeCrewCardHtml(account.birthdate || "")}"></label><label>Contact Email<input id="crew-admin-email" type="email" value="${escapeCrewCardHtml(account.email)}" required></label><label>Cell Phone<input id="crew-admin-phone" value="${escapeCrewCardHtml(account.phone || "")}"></label><label>Home Phone<input id="crew-admin-home-phone" value="${escapeCrewCardHtml(account.homePhone || "")}"></label><label class="crew-admin-address">Home Address<input id="crew-admin-address" value="${escapeCrewCardHtml(account.address || "")}"></label><label>Contact Preference<select id="crew-admin-contact"><option value="text" ${account.contactPreference !== "call" ? "selected" : ""}>Text</option><option value="call" ${account.contactPreference === "call" ? "selected" : ""}>Call</option></select></label>
    <fieldset class="crew-admin-eligibility"><legend>Age Eligibility</legend><label class="crew-admin-select-all"><input type="checkbox" data-testid="crew-admin-level-select-all" onchange="toggleCrewAdminLevels(this.checked)">Select All</label>${levelTerminologyService.checkboxOptions(settings.levels).map(option => `<label><input type="checkbox" class="crew-admin-level" value="${escapeCrewCardHtml(option.value)}" data-canonical="${escapeCrewCardHtml(option.canonical)}" ${model.levels.includes(option.canonical) ? "checked" : ""} onchange="levelTerminologyService.synchronizeCheckbox(this, '.crew-admin-level')">${escapeCrewCardHtml(option.label)}</label>`).join("")}</fieldset><label>Years of Service<input id="crew-admin-years" type="number" min="0" max="80" step="1" value="${model.yearsOfService}" data-testid="crew-admin-years"></label><label class="crew-admin-history">Official History <small>One per line: year|label|note</small><textarea id="crew-admin-history">${escapeCrewCardHtml(historyText)}</textarea></label><label class="crew-admin-notes">Administrator Notes<textarea id="crew-admin-notes">${escapeCrewCardHtml(account.adminNotes || "")}</textarea></label><label class="crew-admin-active"><input type="checkbox" id="crew-admin-active" ${model.status === "Active" ? "checked" : ""}> Active for assignments</label>
  </div><div class="validation-message" data-testid="crew-admin-error" hidden></div><footer><button type="submit" class="button button-primary" data-testid="crew-admin-save">Save Crew Profile</button></footer></form>`;
  document.body.appendChild(dialog); dialog.addEventListener("close", () => dialog.remove(), { once: true }); dialog.showModal(); dialog.querySelector("input:not([readonly])")?.focus();
}

async function handleCrewAdminPhotoSelected(input) {
  const result = await crewPhotoService.processFile(input.files?.[0]);
  const error = input.closest("form").querySelector('[data-testid="crew-admin-error"]');
  if (!result.success) { error.hidden = false; error.textContent = result.message; input.value = ""; return; }
  crewCardPendingAdminPhoto = result.data; error.hidden = true;
  const preview = input.closest("label").querySelector('[data-testid="crew-admin-photo-preview"]');
  if (preview) preview.innerHTML = `<img class="crew-credential-photo" src="${escapeCrewCardHtml(result.data)}" alt="Selected crew photo preview">`;
}

function toggleCrewAdminLevels(checked) {
  document.querySelectorAll(".crew-admin-level").forEach(input => { input.checked = checked; });
}

function parseCrewHistoryInput(value) {
  return String(value || "").split(/\r?\n/).map(line => { const [year, label, note = ""] = line.split("|"); return { year: Number(year), label: String(label || "").trim(), note: String(note || "").trim() }; }).filter(entry => entry.year && entry.label);
}

function saveCrewCardAdminProfile(event, accountId) {
  event.preventDefault();
  const changes = { firstName: document.getElementById("crew-admin-first").value, lastName: document.getElementById("crew-admin-last").value, birthdate: document.getElementById("crew-admin-birthdate").value, email: document.getElementById("crew-admin-email").value, phone: document.getElementById("crew-admin-phone").value, homePhone: document.getElementById("crew-admin-home-phone").value, address: document.getElementById("crew-admin-address").value, contactPreference: document.getElementById("crew-admin-contact").value, levels: levelTerminologyService.normalizeLevels([...document.querySelectorAll(".crew-admin-level:checked")].map(input => input.value)), yearsOfServiceOverride: Number(document.getElementById("crew-admin-years").value), officialHistory: parseCrewHistoryInput(document.getElementById("crew-admin-history").value), adminNotes: document.getElementById("crew-admin-notes").value, active: document.getElementById("crew-admin-active").checked, photoDataUrl: crewCardPendingAdminPhoto };
  const result = accountService.updateCrewProfileAsAdmin(accountId, changes);
  const error = document.querySelector('#crew-card-admin-dialog [data-testid="crew-admin-error"]');
  if (!result.success) { error.hidden = false; error.textContent = result.message; return; }
  document.getElementById("crew-card-admin-dialog")?.close(); document.getElementById("crew-credential-dialog")?.close(); renderPage(document.body.dataset.page || "crew");
  if (result.data.crewId) requestAnimationFrame(() => openCrewCard(result.data.crewId));
}
