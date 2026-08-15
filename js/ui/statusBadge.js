// js/ui/statusBadge.js

function renderAssignmentStatusBadge(game) {
  const lifecycleStatus = String(
    game?.lifecycleStatus || game?.lifecycle_status ||
    (typeof gameService !== "undefined" ? gameService.getStatus(game) : game?.status || "")
  ).toLowerCase();

  if (lifecycleStatus === "cancelled") {
    return `
      <span class="assignment-status-badge status-badge ${presentationFormattingService.getStatusBadgeClass("Cancelled")}" data-status="cancelled">
        Cancelled
      </span>
    `;
  }

  const info = assignmentService.getStatusInfo(game);

  return `
    <span class="assignment-status-badge ${info.className}">
      ${info.icon} ${info.label}
    </span>
  `;
}
