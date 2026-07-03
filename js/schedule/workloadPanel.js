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
  const crewList = crewService.getAll();

  if (!crewList.length) {
    return `
      <section class="crew-workload-panel">
        <div class="panel-header">
          <div>
            <h3>Crew Workload</h3>
            <p>No crew members found.</p>
          </div>
        </div>
      </section>
    `;
  }

  const selectedId = getSelectedWorkloadCrewId();

  return `
    <section class="crew-workload-panel">

      <div class="panel-header">

        <div>
          <h3>Crew Workload</h3>
          <p>
            Click a crew member to filter today's schedule.
          </p>
        </div>

        ${
          selectedId
            ? `
              <button
                class="secondary small-btn"
                onclick="clearWorkloadCrewFilter()">
                Clear Filter
              </button>
            `
            : ""
        }

      </div>

      <div class="crew-workload-grid">

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

  const seasonAssignments =
    workloadService.getSeasonAssignments(
      member.id
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
      class="crew-workload-card ${
        selected ? "selected" : ""
      }"
      onclick="toggleWorkloadCrewFilter('${member.id}')">

      <div class="crew-workload-main">

        <div>

          <h4>

            <span
              class="crew-status-dot ${status.className}">
            </span>

            ${crewService.getName(member)}

          </h4>

          <p>${levelText}</p>

        </div>

        <span
          class="workload-badge ${status.className}">

          ${status.label}

        </span>

      </div>

      <div class="crew-workload-stats">

        <div>
          <strong>${workload.count}</strong>
          <span>Today</span>
        </div>

        <div>
          <strong>${seasonAssignments}</strong>
          <span>Season</span>
        </div>

      </div>

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