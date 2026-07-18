// js/schedule/workloadPanel.js

let selectedWorkloadCrewId = null;

function toggleWorkloadCrewFilter(crewId) {
  selectedWorkloadCrewId =
    String(selectedWorkloadCrewId) === String(crewId)
      ? null
      : crewId;

  renderScheduleContent();
}

function clearWorkloadCrewFilter() {
  selectedWorkloadCrewId = null;
  renderScheduleContent();
}

function getSelectedWorkloadCrewId() {
  return selectedWorkloadCrewId;
}

function renderCrewWorkloadPanel(date) {
  const workingCrewIds = new Set(
    gameService.getByDate(date).flatMap(game => [
      game.crewId,
      ...assignmentService.getAssignments(game).map(assignment => assignment.crewId)
    ]).filter(Boolean).map(String)
  );
  const assignedCrewList = crewService.getAll().filter(member =>
    workingCrewIds.has(String(member.id))
  );

  if (!assignedCrewList.length) {
    return `
      <div class="crew-workload-section">
        <div class="daily-section-heading"><h3>Crew Workload</h3></div>
        <section class="crew-workload-panel presentation-panel">
          <p>No crew members are assigned on this date.</p>
        </section>
      </div>
    `;
  }

  const selectedId = getSelectedWorkloadCrewId();
  const crewList = selectedId
    ? assignedCrewList.filter(member =>
        String(member.id) === String(selectedId)
      )
    : assignedCrewList;

  return `
    <div class="crew-workload-section">
      <div class="daily-section-heading">
        <div><h3>Crew Workload</h3><p>Click a crew member to show only their assigned games.</p></div>

        ${
          selectedId
            ? `
              <button
                class="button button-secondary button-compact secondary small-btn"
                data-testid="schedule-workload-show-all"
                onclick="clearWorkloadCrewFilter()">
                Show All
              </button>
            `
            : ""
        }
      </div>

    <section class="crew-workload-panel presentation-panel">

      <div class="crew-workload-list-compact">

        ${crewList
          .map(member =>
            renderCrewWorkloadCard(
              member,
              date,
              selectedId
            )
          )
          .join("")}

      </div>

    </section>
  `;
}

function renderCrewWorkloadCard(
  member,
  date,
  selectedId
) {
  const workload =
    workloadService.getCrewWorkloadForDate(
      member.id,
      date
    );

  const status =
    getDailyWorkloadStatus(workload.count);

  const selected =
    String(selectedId) === String(member.id);

  const levelText =
    Array.isArray(member.levels)
      ? member.levels.join(", ")
      : "Crew Member";

  return `
    <button
      class="crew-workload-row ${
        selected ? "selected" : ""
      }"
      data-testid="schedule-workload-crew-${member.id}"
      data-crew-id="${member.id}"
      aria-pressed="${selected}"
      onclick="toggleWorkloadCrewFilter('${member.id}')">

      <span class="crew-status-dot ${status.className}" aria-hidden="true"></span>
      <span class="crew-workload-sentence"><strong>${crewService.getName(member)}</strong> <span>(${levelText})</span> assigned <strong>${workload.count}</strong> today.</span>

    </button>
  `;
}

function getDailyWorkloadStatus(count) {

  if (count === 0) {
    return {
      label: "Available",
      className: "workload-light"
    };
  }

  if (count === 1) {
    return {
      label: "Assigned",
      className: "workload-balanced"
    };
  }

  if (count === 2) {
    return {
      label: "Busy",
      className: "workload-busy"
    };
  }

  return {
    label: "Maxed",
    className: "workload-heavy"
  };
}

function renderCrewWorkloadOverview() {
  const today = new Date().toISOString().split("T")[0];
  return `
    <section class="crew-roster-workload presentation-panel" data-testid="crew-page-workload">
      <div class="panel-header crew-roster-header">
        <div>
          <h3>Crew Workload &amp; Roster</h3>
          <p>Contact details, eligibility, status, and assignment load in one place.</p>
        </div>
        <span>${crewService.getAll().length} crew members</span>
      </div>
      <div class="crew-roster-columns" aria-hidden="true">
        <span>Crew member</span><span>Eligibility</span><span>Contact</span><span>Workload</span>
      </div>
      <div class="crew-roster-list">
        ${crewService.getAll().map(member => {
          const workload = workloadService.getCrewWorkloadForDate(member.id, today);
          const season = workloadService.getSeasonAssignments(member.id);
          const status = getDailyWorkloadStatus(workload.count);
          const memberId = escapeCrewOverviewJs(member.id);
          return `
            <button
              type="button"
              class="crew-roster-row"
              data-testid="crew-roster-member"
              data-crew-id="${escapeCrewOverviewHtml(member.id)}"
              onclick="openCrewCard('${memberId}')"
              aria-label="Open Crew Card for ${escapeCrewOverviewHtml(crewService.getName(member))}"
            >
              <span class="crew-roster-identity">
                <span class="crew-status-dot ${member.active === false ? "workload-heavy" : status.className}" aria-hidden="true"></span>
                <span><strong>${escapeCrewOverviewHtml(crewService.getName(member))}</strong><small>${member.active === false ? "Inactive" : "Active"}</small></span>
              </span>
              <span class="crew-roster-levels">
                ${(member.levels || []).length
                  ? member.levels.map(level => `<span class="settings-pill">${escapeCrewOverviewHtml(level)}</span>`).join("")
                  : `<span class="crew-roster-muted">No levels recorded</span>`}
              </span>
              <span class="crew-roster-contact">
                <strong>${escapeCrewOverviewHtml(member.email || "No email recorded")}</strong>
                <small>${escapeCrewOverviewHtml(member.phone || "No phone recorded")}</small>
              </span>
              <span class="crew-workload-stats">
                <span><strong>${workload.count}</strong><small>Today</small></span>
                <span><strong>${season}</strong><small>Season</small></span>
              </span>
            </button>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function escapeCrewOverviewHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeCrewOverviewJs(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'");
}

function getCrewCardInitials(member) {
  const words = crewService.getName(member).trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map(word => word[0]).join("").toUpperCase() || "CR";
}

let crewCardTriggerElement = null;

function openCrewCard(memberId) {
  const member = crewService.getById(memberId);
  if (!member) return;

  document.getElementById("crew-card-dialog")?.remove();
  crewCardTriggerElement = document.activeElement;

  const today = new Date().toISOString().split("T")[0];
  const dailyWorkload = workloadService.getCrewWorkloadForDate(member.id, today);
  const seasonAssignments = workloadService.getSeasonAssignments(member.id);
  const dialog = document.createElement("dialog");
  dialog.id = "crew-card-dialog";
  dialog.className = "crew-profile-card-dialog";
  dialog.dataset.testid = "crew-card-dialog";
  dialog.setAttribute("aria-labelledby", "crew-card-name");
  dialog.innerHTML = `
    <article class="crew-profile-card">
      <header class="crew-profile-card-header">
        <span class="crew-profile-card-avatar" aria-hidden="true">${escapeCrewOverviewHtml(getCrewCardInitials(member))}</span>
        <div>
          <span class="crew-profile-card-kicker">The Slate Crew Card</span>
          <h2 id="crew-card-name">${escapeCrewOverviewHtml(crewService.getName(member))}</h2>
          <span class="crew-profile-card-status" data-status="${member.active === false ? "inactive" : "active"}">${member.active === false ? "Inactive" : "Active"}</span>
        </div>
        <button type="button" class="crew-profile-card-close" onclick="closeCrewCard()" aria-label="Close Crew Card">&times;</button>
      </header>

      <div class="crew-profile-card-body">
        <section aria-labelledby="crew-card-eligibility">
          <h3 id="crew-card-eligibility">Eligible Age Ranges</h3>
          <div class="crew-profile-card-levels">
            ${(member.levels || []).length
              ? member.levels.map(level => `<span class="settings-pill">${escapeCrewOverviewHtml(level)}</span>`).join("")
              : `<span class="crew-roster-muted">No eligible levels recorded.</span>`}
          </div>
        </section>

        <section class="crew-profile-card-stats" aria-label="Assignment workload">
          <div><strong>${dailyWorkload.count}</strong><span>Today</span></div>
          <div><strong>${seasonAssignments}</strong><span>Season</span></div>
        </section>

        <section class="crew-profile-card-contact" aria-labelledby="crew-card-contact">
          <h3 id="crew-card-contact">Contact</h3>
          <dl>
            <div><dt>Email</dt><dd>${escapeCrewOverviewHtml(member.email || "Not recorded")}</dd></div>
            <div><dt>Phone</dt><dd>${escapeCrewOverviewHtml(member.phone || "Not recorded")}</dd></div>
          </dl>
        </section>

        ${member.notes ? `
          <section class="crew-profile-card-notes" aria-labelledby="crew-card-notes">
            <h3 id="crew-card-notes">Notes</h3>
            <p>${escapeCrewOverviewHtml(member.notes)}</p>
          </section>
        ` : ""}
      </div>

      <footer class="crew-profile-card-footer">
        <button type="button" class="button button-secondary" onclick="closeCrewCard()">Close</button>
        <button type="button" class="button button-primary" data-testid="crew-card-edit" onclick="editCrewFromCard('${escapeCrewOverviewJs(member.id)}')">Edit Crew Member</button>
      </footer>
    </article>
  `;

  dialog.addEventListener("click", event => {
    if (event.target === dialog) closeCrewCard();
  });
  dialog.addEventListener("close", () => {
    dialog.remove();
    crewCardTriggerElement?.focus?.();
    crewCardTriggerElement = null;
  }, { once: true });
  document.body.appendChild(dialog);
  dialog.showModal();
}

function closeCrewCard() {
  const dialog = document.getElementById("crew-card-dialog");
  if (!dialog) return;
  dialog.close();
}

function editCrewFromCard(memberId) {
  const dialog = document.getElementById("crew-card-dialog");
  if (dialog) {
    dialog.close();
  }
  openEditCrewDrawer(memberId);
}
