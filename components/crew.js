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
        <h3>${getCrewFullName(member)}</h3>
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

function showCrewMutationError(message) {
  let status = document.querySelector('[data-testid="crew-mutation-error"]');
  if (!status) {
    status = document.createElement("p");
    status.dataset.testid = "crew-mutation-error";
    status.className = "form-status";
    status.setAttribute("role", "alert");
    document.querySelector("#crew-drawer .drawer-footer")?.before(status);
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

  if (!member) return;

  const content = document.getElementById("app-content");

  content.insertAdjacentHTML("beforeend", `
    <div id="drawer-backdrop" class="drawer-backdrop" onclick="closeCrewDrawer()"></div>
    <aside id="crew-drawer" class="game-drawer open">
      ${renderEditCrewDrawerContent(member)}
    </aside>
  `);
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
      getCrewFullName(a).localeCompare(getCrewFullName(b))
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
        <span>${getCrewFullName(c)}</span>
      </label>
    `)
    .join("");
}

function renderEditCrewDrawerContent(member) {
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
        <p>${getCrewFullName(member)}</p>
      </div>
      <button class="drawer-close-btn" onclick="closeCrewDrawer()">×</button>
    </div>

    <div class="drawer-body">
      <div class="form-group">
        <label>First Name</label>
        <input id="crew-first-name" type="text" value="${member.firstName}" />
      </div>

      <div class="form-group">
        <label>Last Name</label>
        <input id="crew-last-name" type="text" value="${member.lastName}" />
      </div>

      <div class="form-group">
        <label>Email</label>
        <input id="crew-email" type="email" value="${member.email}" />
      </div>

      <div class="form-group">
        <label>Phone</label>
        <input id="crew-phone" type="tel" value="${member.phone}" />
      </div>

      <div class="form-group">
        <label>Certification Levels</label>
        <label class="checkbox-row"><input type="checkbox" data-testid="crew-level-select-all" onchange="toggleCrewLevels(this.checked)" /><span>Select All</span></label>
        <div class="checkbox-list">
          ${levelTerminologyService.checkboxOptions(settings.levels).map(option => `
            <label class="checkbox-row">
              <input
                type="checkbox"
                value="${option.value}"
                data-canonical="${option.canonical}"
                data-level-kind="${option.kind}"
                class="crew-level-checkbox"
                ${member.levels.includes(option.canonical) ? "checked" : ""}
                onchange="levelTerminologyService.synchronizeCheckbox(this)"
              />
              <span>${option.label}</span>
            </label>
          `).join("")}
        </div>
      </div>
      <div class="form-group">
        <label>Preferred Partners</label>

        <div class="checkbox-list">
          ${renderPreferenceCheckboxList(
            member,
            preferences.preferredCrewIds,
            "crew-preferred-checkbox"
          )}
        </div>
      </div>

      <div class="form-group">
        <label>Avoid Partners</label>

        <div class="checkbox-list">
          ${renderPreferenceCheckboxList(
            member,
            preferences.avoidedCrewIds,
            "crew-avoided-checkbox"
          )}
        </div>
      </div>

      <div class="form-group">
        <label>Preferred Game Levels</label>

        <div class="checkbox-list">
          ${settings.levels.map(level => `
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

      <div class="form-group">
        <label class="checkbox-row">
          <input id="crew-active" type="checkbox" ${member.active ? "checked" : ""} />
          <span>Active</span>
        </label>
      </div>

      <div class="form-group">
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
    levels: levelTerminologyService.normalizeLevels([...document.querySelectorAll(".crew-level-checkbox:checked")].map(box => box.value))
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

  const result = await crewService.updateMember(member.id, changes);
  if (!result.success) return showCrewMutationError(result.message);

  closeCrewDrawer();
  renderPage("crew");
}

async function deactivateCrewMember(memberId) {
  const member = crewService.getById(memberId);

  if (!member) return;

  const confirmed = confirm(`Deactivate ${getCrewFullName(member)}?`);

  if (!confirmed) return;

  const result = await crewService.updateMember(member.id, { active: false });
  if (!result.success) return showCrewMutationError(result.message);

  closeCrewDrawer();
  renderPage("crew");
}
