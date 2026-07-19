let crewCardOrigin = null;
let crewCardPendingAdminPhoto = null;

function escapeCrewCardHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function getCrewCardModel(crewOrId) {
  const suppliedAccount = typeof crewOrId === "object" && Object.prototype.hasOwnProperty.call(crewOrId, "role") ? crewOrId : null;
  const crewMember = suppliedAccount ? (suppliedAccount.crewId ? crewService.getById(suppliedAccount.crewId) : null) : (typeof crewOrId === "object" ? crewOrId : crewService.getById(crewOrId));
  const account = suppliedAccount || (crewMember
    ? accountService.getAll().find(item => String(item.crewId) === String(crewMember.id)) || null
    : accountService.getById(crewOrId));
  const linkedCrew = crewMember || (account?.crewId ? crewService.getById(account.crewId) : null);
  const firstName = account?.firstName || linkedCrew?.firstName || "";
  const lastName = account?.lastName || linkedCrew?.lastName || "";
  const history = account?.officialHistory || [];
  return {
    accountId: account?.id || "",
    crewRecordId: linkedCrew?.id || "",
    crewCode: account?.crewCode || "Not issued",
    issuedAt: account?.crewCodeIssuedAt || "",
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim() || "Unnamed Crew Member",
    role: account?.role === "assigner" ? "Assigner" : "Baseball Umpire",
    status: linkedCrew?.active === false || account?.status === "rejected" ? "Inactive" : account?.status === "pending" ? "Pending" : "Active",
    email: account?.email || linkedCrew?.email || "",
    phone: account?.phone || linkedCrew?.phone || "",
    homePhone: account?.homePhone || "",
    address: account?.address || "",
    contactPreference: account?.contactPreference || "text",
    birthdate: account?.birthdate || "",
    age: accountService.deriveAge(account?.birthdate),
    photoDataUrl: account?.photoDataUrl || "",
    levels: [...(linkedCrew?.levels || [])],
    officialHistory: history,
    yearsOfService: accountService.deriveYearsOfService(history),
    adminNotes: account?.adminNotes || linkedCrew?.notes || "",
    accountStatus: account?.status || "Unlinked roster record"
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

function renderCrewCardFront(crewMember, options = {}) {
  const model = getCrewCardModel(crewMember);
  const testId = options.testId || "crew-roster-member";
  return `<button type="button" class="crew-credential-front ${options.className || ""}" data-testid="${escapeCrewCardHtml(testId)}" data-crew-id="${escapeCrewCardHtml(model.crewRecordId)}" data-crew-active="${model.status === "Active"}" data-crew-search="${escapeCrewCardHtml(`${model.fullName} ${model.levels.join(" ")}`.toLowerCase())}" onclick="openCrewCard('${escapeCrewCardHtml(model.crewRecordId || model.accountId)}')" aria-label="Open Crew Card for ${escapeCrewCardHtml(model.fullName)}">
    <span class="crew-credential-front-photo">${renderCrewCardPhoto(model)}</span>
    <span class="crew-credential-front-main"><small>${escapeCrewCardHtml(model.crewCode)}</small><strong>${escapeCrewCardHtml(model.fullName)}</strong><span>${escapeCrewCardHtml(model.role)}</span><span class="crew-credential-contact-summary">${escapeCrewCardHtml(model.email || model.phone || "No contact recorded")}</span><span class="crew-credential-levels">${model.levels.map(level => `<i class="settings-pill">${escapeCrewCardHtml(level)}</i>`).join("")}</span></span>
    <span class="crew-credential-front-meta"><b data-status="${model.status.toLowerCase()}">${escapeCrewCardHtml(model.status)}</b><span>${model.yearsOfService} year${model.yearsOfService === 1 ? "" : "s"}</span>${options.roleTestId ? `<span class="visually-hidden" data-testid="${escapeCrewCardHtml(options.roleTestId)}">Role: ${escapeCrewCardHtml(model.role === "Baseball Umpire" ? "Umpire" : model.role)}</span>` : ""}</span>
  </button>`;
}

function formatCrewCardDate(value) {
  if (!value) return "Not recorded";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

function renderCrewCredentialFrontFace(model) {
  return `<section class="crew-credential-face crew-credential-face-front" aria-hidden="true">
    <div class="crew-credential-brand"><strong>The Slate</strong><span>Crew Card</span></div>
    ${renderCrewCardPhoto(model, "crew-credential-modal-photo")}
    <div class="crew-credential-front-identity"><small>${escapeCrewCardHtml(model.crewCode)}</small><h2>${escapeCrewCardHtml(model.fullName)}</h2><p>${escapeCrewCardHtml(model.role)}</p><b data-status="${model.status.toLowerCase()}">${escapeCrewCardHtml(model.status)}</b></div>
  </section>`;
}

function renderCrewCredentialBackFace(model) {
  const canSeeAdminNotes = authService.isAdmin?.() === true;
  return `<section class="crew-credential-face crew-credential-face-back" data-testid="crew-card-back">
    <header class="crew-credential-back-header"><div><strong>The Slate</strong><span>Crew Card</span></div><div><small>Crew ID</small><b data-testid="crew-card-id">${escapeCrewCardHtml(model.crewCode)}</b></div><p>Professional. Reliable. Game Ready.</p></header>
    <div class="crew-credential-identity-panel">
      <div class="crew-credential-photo-block">${renderCrewCardPhoto(model, "crew-credential-modal-photo")}<b data-status="${model.status.toLowerCase()}">${escapeCrewCardHtml(model.status)}</b></div>
      <div><h2 id="crew-card-title">${escapeCrewCardHtml(model.fullName)}</h2><h3>${escapeCrewCardHtml(model.role)}</h3><dl class="crew-credential-age"><div><dt>Age</dt><dd>${model.age ?? "—"}</dd></div><div><dt>Birthdate</dt><dd>${formatCrewCardDate(model.birthdate)}</dd></div><div><dt>Today</dt><dd>${model.dailyWorkload}</dd></div><div><dt>Season</dt><dd>${model.seasonWorkload}</dd></div></dl></div>
    </div>
    <section class="crew-credential-panel crew-credential-contact"><h3>Contact Information</h3><dl>
      <div><dt>Phone (Cell)</dt><dd>${model.phone ? `<button type="button" class="crew-contact-action" data-testid="crew-card-call-phone" onclick="confirmCrewPhoneCall('${escapeCrewCardHtml(model.phone)}')">${escapeCrewCardHtml(model.phone)}</button>` : "Not recorded"}</dd></div><div><dt>Phone (Home)</dt><dd>${escapeCrewCardHtml(model.homePhone || "Not recorded")}</dd></div><div><dt>Email</dt><dd>${model.email ? `<button type="button" class="crew-contact-action" data-testid="crew-card-copy-email" onclick="copyCrewEmail('${escapeCrewCardHtml(model.email)}', this)">${escapeCrewCardHtml(model.email)}</button>` : "Not recorded"}</dd></div><div><dt>Address</dt><dd>${escapeCrewCardHtml(model.address || "Not recorded")}</dd></div><div><dt>Preferred Contact</dt><dd>${model.contactPreference === "call" ? "Call" : "Text"}</dd></div><div><dt>Account Status</dt><dd>${escapeCrewCardHtml(model.accountStatus)}</dd></div>
    </dl></section>
    <section class="crew-credential-panel crew-credential-eligibility"><h3>Age Eligibility<span class="visually-hidden"> — Eligible Age Ranges</span></h3><div>${model.levels.length ? model.levels.map(level => `<span class="settings-pill">${escapeCrewCardHtml(level)}</span>`).join("") : "No eligibility recorded"}</div><small>Issued: ${model.issuedAt ? formatCrewCardDate(model.issuedAt.slice(0, 10)) : "Not issued"}</small></section>
    <section class="crew-credential-panel crew-credential-history"><h3>Official History</h3>${model.officialHistory.length ? `<ol>${[...model.officialHistory].sort((a,b) => b.year-a.year).map(entry => `<li><b>${entry.year}</b><span>${escapeCrewCardHtml(entry.label)}</span>${entry.note ? `<small>${escapeCrewCardHtml(entry.note)}</small>` : ""}</li>`).join("")}</ol>` : `<p>No official history recorded.</p>`}<footer><span>Years of Service</span><b>${model.yearsOfService}</b></footer></section>
    ${canSeeAdminNotes ? `<section class="crew-credential-panel crew-credential-notes"><h3>Administrator Notes</h3><p>${escapeCrewCardHtml(model.adminNotes || "No administrator notes recorded.")}</p></section>` : ""}
  </section>`;
}

function openCrewCard(memberId) {
  const model = getCrewCardModel(memberId);
  if (!model.crewRecordId && !model.accountId) return;
  document.getElementById("crew-credential-dialog")?.remove();
  crewCardOrigin = document.activeElement;
  const dialog = document.createElement("dialog");
  dialog.id = "crew-credential-dialog";
  dialog.className = "crew-credential-dialog";
  dialog.dataset.testid = "crew-card-dialog";
  dialog.setAttribute("aria-labelledby", "crew-card-title");
  dialog.setAttribute("aria-describedby", "crew-card-description");
  dialog.innerHTML = `<article class="crew-credential-modal"><p id="crew-card-description" class="visually-hidden">Detailed identity, contact, eligibility, and official history for ${escapeCrewCardHtml(model.fullName)}.</p><div class="crew-credential-dialog-actions"><button type="button" class="button button-secondary" onclick="closeCrewCard()">Close</button></div><div class="crew-credential-flipper" data-testid="crew-card-flipper">${renderCrewCredentialFrontFace(model)}${renderCrewCredentialBackFace(model)}</div><footer class="crew-credential-modal-footer">${authService.isAdmin?.() && model.accountId ? `<button type="button" class="button button-primary" data-testid="crew-card-edit" onclick="openCrewCardAdminEditor('${escapeCrewCardHtml(model.accountId)}')">Edit Crew Profile</button>` : authService.isAdmin?.() && model.crewRecordId ? `<button type="button" class="button button-primary" data-testid="crew-card-edit" onclick="closeCrewCard(); openEditCrewDrawer('${escapeCrewCardHtml(model.crewRecordId)}')">Edit Crew Profile</button>` : ""}</footer></article>`;
  dialog.addEventListener("click", event => { if (event.target === dialog) closeCrewCard(); });
  dialog.addEventListener("keydown", handleCrewCardDialogKeydown);
  dialog.addEventListener("close", () => { dialog.remove(); crewCardOrigin?.focus?.(); crewCardOrigin = null; }, { once: true });
  document.body.appendChild(dialog);
  dialog.showModal();
  dialog.querySelector("button")?.focus();
  requestAnimationFrame(() => dialog.querySelector(".crew-credential-flipper")?.classList.add("is-flipped"));
}

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
    <label>First Name<input id="crew-admin-first" value="${escapeCrewCardHtml(account.firstName)}" required></label><label>Last Name<input id="crew-admin-last" value="${escapeCrewCardHtml(account.lastName)}" required></label><label>Birthdate<input id="crew-admin-birthdate" type="date" value="${escapeCrewCardHtml(account.birthdate || "")}"></label><label>Email<input id="crew-admin-email" type="email" value="${escapeCrewCardHtml(account.email)}" required></label><label>Cell Phone<input id="crew-admin-phone" value="${escapeCrewCardHtml(account.phone || "")}"></label><label>Home Phone<input id="crew-admin-home-phone" value="${escapeCrewCardHtml(account.homePhone || "")}"></label><label class="crew-admin-address">Home Address<input id="crew-admin-address" value="${escapeCrewCardHtml(account.address || "")}"></label><label>Contact Preference<select id="crew-admin-contact"><option value="text" ${account.contactPreference !== "call" ? "selected" : ""}>Text</option><option value="call" ${account.contactPreference === "call" ? "selected" : ""}>Call</option></select></label>
    <fieldset><legend>Age Eligibility</legend>${settings.levels.map(level => `<label><input type="checkbox" class="crew-admin-level" value="${escapeCrewCardHtml(level)}" ${model.levels.includes(level) ? "checked" : ""}>${escapeCrewCardHtml(level)}</label>`).join("")}</fieldset><label class="crew-admin-history">Official History <small>One per line: year|label|note</small><textarea id="crew-admin-history">${escapeCrewCardHtml(historyText)}</textarea></label><label class="crew-admin-notes">Administrator Notes<textarea id="crew-admin-notes">${escapeCrewCardHtml(account.adminNotes || "")}</textarea></label><label class="crew-admin-active"><input type="checkbox" id="crew-admin-active" ${model.status === "Active" ? "checked" : ""}> Active for assignments</label>
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

function parseCrewHistoryInput(value) {
  return String(value || "").split(/\r?\n/).map(line => { const [year, label, note = ""] = line.split("|"); return { year: Number(year), label: String(label || "").trim(), note: String(note || "").trim() }; }).filter(entry => entry.year && entry.label);
}

function saveCrewCardAdminProfile(event, accountId) {
  event.preventDefault();
  const changes = { firstName: document.getElementById("crew-admin-first").value, lastName: document.getElementById("crew-admin-last").value, birthdate: document.getElementById("crew-admin-birthdate").value, email: document.getElementById("crew-admin-email").value, phone: document.getElementById("crew-admin-phone").value, homePhone: document.getElementById("crew-admin-home-phone").value, address: document.getElementById("crew-admin-address").value, contactPreference: document.getElementById("crew-admin-contact").value, levels: [...document.querySelectorAll(".crew-admin-level:checked")].map(input => input.value), officialHistory: parseCrewHistoryInput(document.getElementById("crew-admin-history").value), adminNotes: document.getElementById("crew-admin-notes").value, active: document.getElementById("crew-admin-active").checked, photoDataUrl: crewCardPendingAdminPhoto };
  const result = accountService.updateCrewProfileAsAdmin(accountId, changes);
  const error = document.querySelector('#crew-card-admin-dialog [data-testid="crew-admin-error"]');
  if (!result.success) { error.hidden = false; error.textContent = result.message; return; }
  document.getElementById("crew-card-admin-dialog")?.close(); document.getElementById("crew-credential-dialog")?.close(); renderPage(document.body.dataset.page || "crew");
  if (result.data.crewId) requestAnimationFrame(() => openCrewCard(result.data.crewId));
}
