function renderCrew() {
  const activeCrew = crew.filter(member => member.active);
  const inactiveCrew = crew.filter(member => !member.active);

  return `
    <div class="card">
      <div class="page-section-header">
        <div>
          <h3>Crew</h3>
          <p class="placeholder">Manage umpire profiles, eligibility, and assignments.</p>
        </div>
    <button class="primary-btn" onclick="openAddCrewDrawer()">+ Add Crew Member</button>
      </div>

      <div class="card-grid">
        <div class="card stat-card">
          <h3>Active Crew</h3>
          <div class="stat-number">${activeCrew.length}</div>
          <p class="placeholder">Available for assignments.</p>
        </div>

        <div class="card stat-card">
          <h3>Inactive Crew</h3>
          <div class="stat-number">${inactiveCrew.length}</div>
          <p class="placeholder">Not currently assignable.</p>
        </div>

        <div class="card stat-card">
          <h3>Total Crew</h3>
          <div class="stat-number">${crew.length}</div>
          <p class="placeholder">All crew records.</p>
        </div>
      </div>

      <div class="section-spacer"></div>

      <div class="crew-list">
        ${crew.map(member => renderCrewCard(member)).join("")}
      </div>
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
      <button class="small-btn" onclick="openEditCrewDrawer(${member.id})">Edit</button>
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
        <div class="checkbox-list">
          ${settings.levels.map(level => `
            <label class="checkbox-row">
              <input type="checkbox" value="${level}" class="crew-level-checkbox" />
              <span>${level}</span>
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

function saveNewCrewMember() {
  const firstName = document.getElementById("crew-first-name").value.trim();
  const lastName = document.getElementById("crew-last-name").value.trim();
  const email = document.getElementById("crew-email").value.trim();
  const phone = document.getElementById("crew-phone").value.trim();
  const active = document.getElementById("crew-active").checked;
  const notes = document.getElementById("crew-notes").value.trim();

  const levels = [...document.querySelectorAll(".crew-level-checkbox:checked")]
    .map(box => box.value);

  if (!firstName || !lastName) {
    alert("Please enter a first and last name.");
    return;
  }

  const newMember = {
    id: Date.now(),
    firstName,
    lastName,
    email,
    phone,
    levels,
    active,
    notes
  };

crew.push(newMember);
saveCrew();

closeCrewDrawer();
renderPage("crew");
}
function openEditCrewDrawer(memberId) {
  const member = crew.find(item => item.id === memberId);

  if (!member) return;

  const content = document.getElementById("app-content");

  content.insertAdjacentHTML("beforeend", `
    <div id="drawer-backdrop" class="drawer-backdrop" onclick="closeCrewDrawer()"></div>
    <aside id="crew-drawer" class="game-drawer open">
      ${renderEditCrewDrawerContent(member)}
    </aside>
  `);
}

function renderEditCrewDrawerContent(member) {
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
        <div class="checkbox-list">
          ${settings.levels.map(level => `
            <label class="checkbox-row">
              <input
                type="checkbox"
                value="${level}"
                class="crew-level-checkbox"
                ${member.levels.includes(level) ? "checked" : ""}
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
      <button class="danger-btn" onclick="deactivateCrewMember(${member.id})">Deactivate</button>

      <div>
        <button class="secondary-btn" onclick="closeCrewDrawer()">Cancel</button>
        <button class="primary-btn" onclick="saveCrewEdits(${member.id})">Save Changes</button>
      </div>
    </div>
  `;
}

function saveCrewEdits(memberId) {
  const member = crew.find(item => item.id === memberId);

  if (!member) return;

  const firstName = document.getElementById("crew-first-name").value.trim();
  const lastName = document.getElementById("crew-last-name").value.trim();

  if (!firstName || !lastName) {
    alert("Please enter a first and last name.");
    return;
  }

  member.firstName = firstName;
  member.lastName = lastName;
  member.email = document.getElementById("crew-email").value.trim();
  member.phone = document.getElementById("crew-phone").value.trim();
  member.active = document.getElementById("crew-active").checked;
  member.notes = document.getElementById("crew-notes").value.trim();

  member.levels = [...document.querySelectorAll(".crew-level-checkbox:checked")]
    .map(box => box.value);

  saveCrew();

  closeCrewDrawer();
  renderPage("crew");
}

function deactivateCrewMember(memberId) {
  const member = crew.find(item => item.id === memberId);

  if (!member) return;

  const confirmed = confirm(`Deactivate ${getCrewFullName(member)}?`);

  if (!confirmed) return;

  member.active = false;

  saveCrew();

  closeCrewDrawer();
  renderPage("crew");
}
