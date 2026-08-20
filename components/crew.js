function getCrewComponentFullName(member) {
  return `${member?.firstName || ""} ${member?.lastName || ""}`.trim();
}

function escapeCrewComponentHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function serializeOfficialServiceHistory(history = []) {
  return history.map(entry => [entry.year, entry.season || "Unspecified", entry.role || "umpire", entry.level || "", entry.note || ""].join("|")).join("\n");
}

function parseOfficialServiceHistory(value) {
  const entries = String(value || "").split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
    const [year, season = "Unspecified", role = "umpire", level = "", ...note] = line.split("|");
    return { year: Number(year), season: season.trim() || "Unspecified", role: role.trim() || "umpire", level: level.trim(), note: note.join("|").trim() };
  });
  const invalid = entries.find(entry => !Number.isInteger(entry.year) || entry.year < 1900 || entry.year > new Date().getFullYear() + 1 || !["umpire", "assigner", "administrator"].includes(entry.role));
  if (invalid) throw new Error("Official history must use year|season|role|level|notes with a valid year and role.");
  const keys = entries.map(entry => `${entry.year}:${entry.season.toLowerCase()}`);
  if (new Set(keys).size !== keys.length) throw new Error("Official history cannot contain the same year and season twice.");
  return entries;
}

function officialHistoryKey(entry = {}) {
  return [entry.year, entry.season, entry.role, entry.level].map(value => String(value || "").trim().toLowerCase()).join(":");
}

function renderOfficialHistoryEditor(member) {
  const currentYear = new Date().getFullYear();
  const history = member.officialHistory || [];
  const years = accountService.deriveYearsOfService(history);
  return `<section class="crew-official-history-editor" data-testid="crew-official-history-editor">
    <div class="crew-history-heading"><div><strong>Official History</strong><small>Add one entry at a time.</small></div><b data-testid="crew-history-years">${years} ${years === 1 ? "year" : "years"} of service</b></div>
    <div class="crew-history-add-row" data-testid="crew-history-add-row">
      <label>Year<select data-history-new="year"><option value="">Select</option>${Array.from({length: currentYear + 3 - 2020}, (_, index) => 2020 + index).map(year => `<option value="${year}">${year}</option>`).join("")}</select></label>
      <label>Season<select data-history-new="season"><option value="">Select</option>${["Spring","Summer","Fall","Winter"].map(value => `<option>${value}</option>`).join("")}</select></label>
      <label>Position<select data-history-new="role"><option value="">Select</option><option value="umpire">Umpire</option></select></label>
      <label>Level<select data-history-new="level"><option value="">Select</option>${["6U","8U","10U","12U","14U","16U","18U"].map(value => `<option>${value}</option>`).join("")}</select></label>
      <button type="button" class="secondary-btn" data-testid="crew-history-add" onclick="addOfficialHistoryEntry('${escapeCrewComponentHtml(member.id)}')">Add History Entry</button>
    </div>
    <div class="crew-history-list" data-testid="crew-official-history-list">${history.length ? history.map((entry, index) => `<label class="crew-history-list-row"><input type="checkbox" data-history-delete-index="${index}"><span>${escapeCrewComponentHtml(entry.year)}</span><span>${escapeCrewComponentHtml(entry.season)}</span><span>${escapeCrewComponentHtml(entry.role === "umpire" ? "Umpire" : entry.role)}</span><span>${escapeCrewComponentHtml(entry.level)}</span></label>`).join("") : `<p data-testid="crew-history-empty">No official history recorded.</p>`}</div>
    <button type="button" class="danger-btn" data-testid="crew-history-delete" onclick="deleteSelectedOfficialHistory('${escapeCrewComponentHtml(member.id)}')" ${history.length ? "" : "disabled"}>Delete Selected</button>
  </section>`;
}

function refreshOfficialHistoryEditor(memberId) {
  const member = crewService.getById(memberId);
  const editor = document.querySelector("[data-testid='crew-official-history-editor']");
  if (member && editor) editor.outerHTML = renderOfficialHistoryEditor(member);
}

async function addOfficialHistoryEntry(memberId) {
  const values = Object.fromEntries([...document.querySelectorAll("[data-history-new]")].map(input => [input.dataset.historyNew, input.value]));
  if (!values.year || !values.season || !values.role || !values.level) return showCrewMutationError("Year, Season, Position, and Level are required.");
  const member = crewService.getById(memberId);
  if (!member) return showCrewMutationError("Crew member not found.");
  const entry = { year: Number(values.year), season: values.season, role: values.role, level: values.level, note: "" };
  if ((member.officialHistory || []).some(existing => officialHistoryKey(existing) === officialHistoryKey(entry))) return showCrewMutationError("That exact Official History entry already exists.");
  const result = await crewService.updateMember(memberId, { officialHistory: [...(member.officialHistory || []), entry] });
  if (!result.success) return showCrewMutationError(result.message);
  document.querySelector('[data-testid="crew-mutation-error"]')?.remove();
  refreshOfficialHistoryEditor(memberId);
  toastService?.success?.("Official History entry added.");
}

async function deleteSelectedOfficialHistory(memberId) {
  const selected = [...document.querySelectorAll("[data-history-delete-index]:checked")].map(input => Number(input.dataset.historyDeleteIndex));
  if (!selected.length) return showCrewMutationError("Select at least one Official History entry to delete.");
  const member = crewService.getById(memberId);
  if (!member) return showCrewMutationError("Crew member not found.");
  const result = await crewService.updateMember(memberId, { officialHistory: (member.officialHistory || []).filter((_, index) => !selected.includes(index)) });
  if (!result.success) return showCrewMutationError(result.message);
  document.querySelector('[data-testid="crew-mutation-error"]')?.remove();
  refreshOfficialHistoryEditor(memberId);
  toastService?.success?.("Selected Official History deleted.");
}

function renderCrew() {
  const roster = crewService.getAll();
  const sharedState = crewService.getAdministrativeCrewState?.() || { status: "ready" };
  if (crewService.isSharedMode() && sharedState.status === "idle") {
    crewService.loadAdministrativeCrew().then(() => {
      if (document.body.dataset.page === "crew") renderPage("crew");
    });
  }
  if (crewService.isSharedMode() && sharedState.status !== "ready") {
    const message = sharedState.status === "error" ? sharedState.message : "Loading crew roster…";
    return `<div class="card crew-page-shell" data-testid="crew-shared-state"><h3>Crew</h3><p role="${sharedState.status === "error" ? "alert" : "status"}">${message}</p>${sharedState.status === "error" ? '<button type="button" onclick="crewService.loadAdministrativeCrew().then(() => renderPage(\'crew\'))">Retry</button>' : ""}</div>`;
  }
  const activeCrew = roster.filter(member => member.active);
  const inactiveCrew = roster.filter(member => !member.active);

  return `
    <div class="card crew-page-shell">
      <div class="page-section-header">
        <div>
          <h3>Crew</h3>
          <p class="placeholder">Manage umpire profiles, eligibility, and assignments.</p>
        </div>
    <button class="primary-btn" onclick="openAddCrewDrawer()">+ Add Crew Member</button>
      </div>

      <div class="card-grid crew-summary-grid">
        <div class="card stat-card crew-summary-card crew-summary-active">
          <h3>Active Crew</h3>
          <div class="stat-number" data-testid="crew-active-count">${activeCrew.length}</div>
          <p class="placeholder">Available for assignments.</p>
        </div>

        <div class="card stat-card crew-summary-card crew-summary-inactive">
          <h3>Inactive Crew</h3>
          <div class="stat-number" data-testid="crew-inactive-count">${inactiveCrew.length}</div>
          <p class="placeholder">Not currently assignable.</p>
        </div>

        <div class="card stat-card crew-summary-card crew-summary-total">
          <h3>Total Crew</h3>
          <div class="stat-number" data-testid="crew-total-count">${roster.length}</div>
          <p class="placeholder">All crew records.</p>
        </div>
      </div>

      <div class="section-spacer"></div>

      ${typeof renderCrewWorkloadOverview === "function" ? renderCrewWorkloadOverview() : ""}
    </div>
  `;
}

function renderCrewCard(member) {
  const statusClass = member.active ? "status-assigned" : "status-unassigned";
  const statusText = member.active ? "Active" : "Inactive";

  return `
    <div class="crew-card">
      <div>
        <h3>${getCrewComponentFullName(member)}</h3>
        <p>${member.email}</p>
        <p>${member.phone}</p>

        <div class="settings-list">
          ${member.levels.map(level => `<span class="settings-pill">${level}</span>`).join("")}
        </div>
      </div>

      <div class="crew-card-right">
        <span class="status-pill ${statusClass}">${statusText}</span>
      <button class="small-btn" onclick="openEditCrewDrawer('${member.id}')">Edit</button>
      </div>
    </div>
  `;
}
function openAddCrewDrawer() {
  const content = document.getElementById("app-content");

  content.insertAdjacentHTML("beforeend", `
    <div id="drawer-backdrop" class="drawer-backdrop" onclick="closeCrewDrawer()"></div>
    <aside id="crew-drawer" class="game-drawer open">
      ${renderAddCrewDrawerContent()}
    </aside>
  `);
}

function closeCrewDrawer() {
  const drawer = document.getElementById("crew-drawer");
  const backdrop = document.getElementById("drawer-backdrop");

  if (drawer) drawer.remove();
  if (backdrop) backdrop.remove();
}

function renderAddCrewDrawerContent() {
  return `
    <div class="drawer-header">
      <div>
        <h3>Add Crew Member</h3>
        <p>Create a new umpire profile.</p>
      </div>
      <button class="drawer-close-btn" onclick="closeCrewDrawer()">×</button>
    </div>

    <div class="drawer-body">
      <div class="form-group">
        <label>First Name</label>
        <input id="crew-first-name" type="text" />
      </div>

      <div class="form-group">
        <label>Last Name</label>
        <input id="crew-last-name" type="text" />
      </div>

      <div class="form-group">
        <label>Email</label>
        <input id="crew-email" type="email" />
      </div>

      <div class="form-group">
        <label>Phone</label>
        <input id="crew-phone" type="tel" />
      </div>

      <div class="form-group">
        <label>Certification Levels</label>
        <label class="checkbox-row"><input type="checkbox" data-testid="crew-level-select-all" onchange="toggleCrewLevels(this.checked)" /><span>Select All</span></label>
        <div class="checkbox-list">
          ${levelTerminologyService.checkboxOptions(settings.levels).map(option => `
            <label class="checkbox-row">
              <input type="checkbox" value="${option.value}" data-canonical="${option.canonical}" data-level-kind="${option.kind}" class="crew-level-checkbox" onchange="levelTerminologyService.synchronizeCheckbox(this)" />
              <span>${option.label}</span>
            </label>
          `).join("")}
        </div>
      </div>

      <div class="form-group">
        <label class="checkbox-row">
          <input id="crew-active" type="checkbox" checked />
          <span>Active</span>
        </label>
      </div>

      <div class="form-group">
        <label>Notes</label>
        <textarea id="crew-notes" placeholder="Optional notes..."></textarea>
      </div>
    </div>

    <div class="drawer-footer">
      <button class="secondary-btn" onclick="closeCrewDrawer()">Cancel</button>
      <button class="primary-btn" onclick="saveNewCrewMember()">Save Crew Member</button>
    </div>
  `;
}

function toggleCrewLevels(checked) {
  document.querySelectorAll(".crew-level-checkbox").forEach(box => { box.checked = checked; });
}

function toggleCrewPreferredLevels(checked) {
  document.querySelectorAll(".crew-preferred-level-checkbox").forEach(box => { box.checked = checked; });
}

function showCrewMutationError(message) {
  let status = document.querySelector('[data-testid="crew-mutation-error"]');
  if (!status) {
    status = document.createElement("p");
    status.dataset.testid = "crew-mutation-error";
    status.className = "form-status";
    status.setAttribute("role", "alert");
    document.querySelector("#crew-drawer .drawer-footer, #crew-credential-dialog .drawer-footer")?.before(status);
  }
  status.textContent = message || "Crew member could not be saved.";
}

async function saveNewCrewMember() {
  const firstName = document.getElementById("crew-first-name").value.trim();
  const lastName = document.getElementById("crew-last-name").value.trim();
  const email = document.getElementById("crew-email").value.trim();
  const phone = document.getElementById("crew-phone").value.trim();
  const active = document.getElementById("crew-active").checked;
  const notes = document.getElementById("crew-notes").value.trim();

  const levels = levelTerminologyService.normalizeLevels([...document.querySelectorAll(".crew-level-checkbox:checked")].map(box => box.value));

  if (!firstName || !lastName) {
    alert("Please enter a first and last name.");
    return;
  }

  const newMember = {
    firstName,
    lastName,
    email,
    phone,
    levels,
    active,
    notes
  };

  const result = await crewService.create(newMember);
  if (!result.success) return showCrewMutationError(result.message);
  closeCrewDrawer();
  renderPage("crew");
}
function openEditCrewDrawer(memberId) {
  const member = crewService.getAll().find(item =>
    String(item.id) === String(memberId)
  );

  if (!member) {
    const error = new Error("Crew editor member lookup failed.");
    error.crewEditCode = "CREW-EDIT-E1";
    throw error;
  }

  const content = document.getElementById("app-content");
  if (!content) {
    const error = new Error("Crew editor host is unavailable.");
    error.crewEditCode = "CREW-EDIT-E2";
    throw error;
  }

  closeCrewDrawer();

  let drawerContent;
  try {
    drawerContent = renderEditCrewDrawerContent(member);
  } catch (cause) {
    const error = new Error("Crew editor rendering failed.", { cause });
    error.crewEditCode = "CREW-EDIT-E3";
    throw error;
  }

  try {
    content.insertAdjacentHTML("beforeend", `
      <div id="drawer-backdrop" class="drawer-backdrop" onclick="closeCrewDrawer()"></div>
      <aside id="crew-drawer" class="game-drawer open">
        ${drawerContent}
      </aside>
    `);
  } catch (cause) {
    const error = new Error("Crew editor mounting failed.", { cause });
    error.crewEditCode = "CREW-EDIT-E4";
    throw error;
  }
  const drawer = document.getElementById("crew-drawer");
  if (!drawer) {
    const error = new Error("Crew editor was not mounted.");
    error.crewEditCode = "CREW-EDIT-E5";
    throw error;
  }
  return drawer;
}
function renderPreferenceCheckboxList(
  member,
  selectedIds = [],
  inputClass
) {
  const selected = new Set(
    (selectedIds || []).map(id => String(id))
  );

  return crewService.getAll()
    .filter(c => String(c.id) !== String(member.id))
    .sort((a, b) =>
      getCrewComponentFullName(a).localeCompare(getCrewComponentFullName(b))
    )
    .map(c => `
      <label class="checkbox-row">
        <input
          type="checkbox"
          class="${inputClass}"
          value="${c.id}"
          ${
            selected.has(String(c.id))
              ? "checked"
              : ""
          }
        />
        <span>${getCrewComponentFullName(c)}</span>
      </label>
    `)
    .join("");
}

function renderEditCrewDrawerContent(member) {
  const memberLevels = levelTerminologyService.normalizeLevels(
    Array.isArray(member?.levels) ? member.levels : member?.eligible_levels
  );
  const configuredLevels = levelTerminologyService.normalizeLevels(
    Array.isArray(settings?.levels) ? settings.levels : []
  );
  const officialFieldsDisabled = member.profileId ? "" : "disabled";
   const preferences =
    typeof crewService !== "undefined" &&
    crewService.getPreferences
      ? crewService.getPreferences(member.id)
      : {
          preferredCrewIds: [],
          avoidedCrewIds: [],
          preferredLevels: []
        };
  return `
    <div class="drawer-header">
      <div>
        <h3>Edit Crew Member</h3>
        <p>${getCrewComponentFullName(member)}</p>
      </div>
      <button class="drawer-close-btn" onclick="closeCrewDrawer()">×</button>
    </div>

    <div class="drawer-body crew-editor-grid">
      <div class="form-group crew-field-first-name">
        <label>First Name</label>
        <input id="crew-first-name" type="text" value="${member.firstName}" />
      </div>

      <div class="form-group crew-field-last-name">
        <label>Last Name</label>
        <input id="crew-last-name" type="text" value="${member.lastName}" />
      </div>

      <div class="form-group crew-field-email">
        <label>Email</label>
        <input id="crew-email" type="email" value="${member.email}" />
      </div>

      <div class="form-group crew-field-phone">
        <label>Phone</label>
        <input id="crew-phone" type="tel" value="${member.phone}" />
      </div>

      <div class="form-group crew-field-personnel-id">
        <label>Crew ID</label>
        <input id="crew-personnel-id" value="${escapeCrewComponentHtml(member.personnelId || "Not issued")}" readonly data-testid="crew-personnel-id" />
      </div>

      <div class="form-group crew-field-birthdate">
        <label>Date of Birth</label>
        <input id="crew-birthdate" type="date" value="${escapeCrewComponentHtml(member.birthdate || "")}" ${officialFieldsDisabled} data-testid="crew-birthdate" />
        ${member.profileId ? "<small>Administrator-controlled identity correction.</small>" : "<small>Link an approved profile before recording DOB.</small>"}
      </div>

      ${member.profileId ? renderOfficialHistoryEditor(member) : `<div class="form-group crew-official-history-editor"><label>Official History</label><small>Link an approved profile before recording history.</small></div>`}

      <div class="form-group crew-field-levels">
        <label>Certification Levels</label>
        <label class="checkbox-row"><input type="checkbox" data-testid="crew-level-select-all" onchange="toggleCrewLevels(this.checked)" /><span>Select All</span></label>
        <div class="checkbox-list">
          ${levelTerminologyService.checkboxOptions(configuredLevels).map(option => `
            <label class="checkbox-row">
              <input
                type="checkbox"
                value="${option.value}"
                data-canonical="${option.canonical}"
                data-level-kind="${option.kind}"
                class="crew-level-checkbox"
                ${memberLevels.includes(option.canonical) ? "checked" : ""}
                onchange="levelTerminologyService.synchronizeCheckbox(this)"
              />
              <span>${option.label}</span>
            </label>
          `).join("")}
        </div>
      </div>
      <div class="form-group crew-field-preferred-partners">
        <label>Preferred Partners</label>

        <div class="checkbox-list">
          ${renderPreferenceCheckboxList(
            member,
            preferences.preferredCrewIds,
            "crew-preferred-checkbox"
          )}
        </div>
      </div>

      <div class="form-group crew-field-avoid-partners">
        <label>Avoid Partners</label>

        <div class="checkbox-list">
          ${renderPreferenceCheckboxList(
            member,
            preferences.avoidedCrewIds,
            "crew-avoided-checkbox"
          )}
        </div>
      </div>

      <div class="form-group crew-field-preferred-levels">
        <label>Preferred Game Levels</label>

        <label class="checkbox-row"><input type="checkbox" data-testid="crew-preferred-level-select-all" onchange="toggleCrewPreferredLevels(this.checked)" ${configuredLevels.length ? "" : "disabled"} /><span>Select All</span></label>

        <div class="checkbox-list">
          ${configuredLevels.map(level => `
            <label class="checkbox-row">
              <input
                type="checkbox"
                class="crew-preferred-level-checkbox"
                value="${level}"
                ${
                  (preferences.preferredLevels || [])
                    .includes(level)
                      ? "checked"
                      : ""
                }
              />
              <span>${level}</span>
            </label>
          `).join("")}
        </div>
      </div>

      <div class="form-group crew-field-active">
        <label class="checkbox-row">
          <input id="crew-active" type="checkbox" ${member.active ? "checked" : ""} />
          <span>Active</span>
        </label>
      </div>

      <div class="form-group crew-field-notes">
        <label>Notes</label>
        <textarea id="crew-notes" placeholder="Optional notes...">${member.notes || ""}</textarea>
      </div>
    </div>

    <div class="drawer-footer drawer-footer-split">
      <button class="danger-btn" onclick="deactivateCrewMember('${member.id}')">Deactivate</button>

      <div>
        <button class="secondary-btn" onclick="closeCrewDrawer()">Cancel</button>
        <button class="primary-btn" onclick="saveCrewEdits('${member.id}')">Save Changes</button>
      </div>
    </div>
  `;
}

async function saveCrewEdits(memberId) {
  const member = crewService.getById(memberId);

  if (!member) return;

  const firstName = document.getElementById("crew-first-name").value.trim();
  const lastName = document.getElementById("crew-last-name").value.trim();

  if (!firstName || !lastName) {
    alert("Please enter a first and last name.");
    return;
  }

  const changes = {
    firstName,
    lastName,
    email: document.getElementById("crew-email").value.trim(),
    phone: document.getElementById("crew-phone").value.trim(),
    active: document.getElementById("crew-active").checked,
    notes: document.getElementById("crew-notes").value.trim(),
    levels: levelTerminologyService.normalizeLevels([...document.querySelectorAll(".crew-level-checkbox:checked")].map(box => box.value)),
    birthdate: document.getElementById("crew-birthdate")?.value || null,
    officialHistory: member.officialHistory || []
  };

    const preferredCrewIds = [
  ...document.querySelectorAll(
    ".crew-preferred-checkbox:checked"
  )
].map(box => box.value);

const avoidedCrewIds = [
  ...document.querySelectorAll(
    ".crew-avoided-checkbox:checked"
  )
].map(box => box.value);

const preferredLevels = [
  ...document.querySelectorAll(
    ".crew-preferred-level-checkbox:checked"
  )
].map(box => box.value);

  changes.preferences = {
      preferredCrewIds,
      avoidedCrewIds,
      preferredLevels
    };

  let result;
  try {
    result = await crewService.updateMember(member.id, changes);
  } catch (error) {
    return showCrewMutationError(error?.message || "Crew member could not be saved.");
  }
  if (!result.success) return showCrewMutationError(result.message);

  const cardDialog = document.getElementById("crew-credential-dialog");
  const cardEditMode = cardDialog?.dataset.editMode === "administrator";
  closeCrewDrawer();
  renderPage("crew");
  toastService?.success?.("Crew member saved.");
  if (cardEditMode) {
    cardDialog.close();
    requestAnimationFrame(() => openCrewCredentialCard(member.id));
  }
}

async function deactivateCrewMember(memberId) {
  const member = crewService.getById(memberId);

  if (!member) return;

  const confirmed = confirm(`Deactivate ${getCrewComponentFullName(member)}?`);

  if (!confirmed) return;

  const result = await crewService.updateMember(member.id, { active: false });
  if (!result.success) return showCrewMutationError(result.message);

  closeCrewDrawer();
  renderPage("crew");
}
