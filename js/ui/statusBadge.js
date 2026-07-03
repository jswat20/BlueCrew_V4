// js/ui/statusBadge.js

function renderAssignmentStatusBadge(game) {
  const info = assignmentService.getStatusInfo(game);

  return `
    <span class="assignment-status-badge ${info.className}">
      ${info.icon} ${info.label}
    </span>
  `;
}