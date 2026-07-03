const FILTERS = [
  { key: "all", label: "All" },
  { key: "open_assignment", label: "Open" },
  { key: "double_booking", label: "Double Bookings" },
  { key: "eligibility_issue", label: "Eligibility" },
  { key: "overloaded_crew", label: "Overloaded" },
  { key: "inactive_assignment", label: "Inactive" }
];

function renderConflictFilters(activeFilter = "all", issues = []) {
  return `
    <div class="conflict-filters">
      ${FILTERS.map(filter => {
        const count = getFilterCount(filter.key, issues);
        const activeClass = filter.key === activeFilter ? "active" : "";

        return `
          <button
            class="conflict-filter-btn ${activeClass}"
            data-conflict-filter="${filter.key}"
          >
            ${filter.label}
            <span>${count}</span>
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function bindConflictFilters(container, onFilterChange) {
  container.querySelectorAll("[data-conflict-filter]").forEach(button => {
    button.addEventListener("click", () => {
      onFilterChange(button.dataset.conflictFilter);
    });
  });
}

function filterIssues(issues = [], activeFilter = "all") {
  if (activeFilter === "all") return issues;

  return issues.filter(issue => normalizeIssueType(issue.type) === activeFilter);
}

function getFilterCount(filterKey, issues = []) {
  if (filterKey === "all") return issues.length;

  return issues.filter(issue => normalizeIssueType(issue.type) === filterKey).length;
}

function normalizeIssueType(type = "") {
  return String(type)
    .trim()
    .toLowerCase()
    .replaceAll(" ", "_")
    .replaceAll("-", "_");
}