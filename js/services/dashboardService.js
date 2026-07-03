// dashboardService.js

const dashboardService = (() => {

  function getDashboardConflicts() {
    if (
      typeof conflictService !== "undefined" &&
      typeof conflictService.getConflicts === "function"
    ) {
      return conflictService.getConflicts();
    }

    if (
      typeof conflictService !== "undefined" &&
      typeof conflictService.findConflicts === "function"
    ) {
      return conflictService.findConflicts();
    }

    return [];
  }

  
  function getOperationsSummary() {

  const allGames = gameService.getAll();

  const today = new Date().toISOString().split("T")[0];

  const todaysGames = allGames.filter(game => game.date === today);

  const assigned = todaysGames.filter(game => {
    const status = assignmentService.getStatus(game);

    return (
      status === AssignmentStatus.ASSIGNED ||
      status === AssignmentStatus.LOCKED
    );
  });

  const open = todaysGames.filter(game => {
    const status = assignmentService.getStatus(game);

    return (
      status === AssignmentStatus.NEEDS_ASSIGNMENT ||
      status === AssignmentStatus.OPEN_FOR_CLAIM ||
      status === AssignmentStatus.PENDING_APPROVAL
    );
  });

  const conflicts = getDashboardConflicts().length;

  const activeCrew = crewService
    .getAll()
    .filter(member => member.active)
    .length;

  const coverage =
    todaysGames.length === 0
      ? 100
      : Math.round((assigned.length / todaysGames.length) * 100);

  return [
    {
      id: "today",
      label: "Today's Games",
      value: todaysGames.length,
      color: "blue",
      action: "today"
    },
    {
      id: "assigned",
      label: "Assigned / Locked",
      value: assigned.length,
      color: "green",
      action: "assigned"
    },
    {
      id: "open",
      label: "Needs Workflow",
      value: open.length,
      color: open.length > 0 ? "orange" : "green",
      action: "open"
    },
    {
      id: "coverage",
      label: "Coverage",
      value: `${coverage}%`,
      color:
        coverage >= 90
          ? "green"
          : coverage >= 70
          ? "orange"
          : "red",
      action: "coverage"
    },
    {
      id: "conflicts",
      label: "Conflicts",
      value: conflicts,
      color: conflicts > 0 ? "red" : "green",
      action: "conflicts"
    },
    {
      id: "crew",
      label: "Active Crew",
      value: activeCrew,
      color: "purple",
      action: "crew"
    }
  ];
}

  function getNeedsAttention() {

    const openAssignments = assignmentService.getOpenGames();

    const conflicts = getDashboardConflicts();

    const inactiveAssignments =
      assignmentService.getInactiveAssignments();

    const eligibilityIssues =
      assignmentService.getEligibilityIssues();

    return [
      {
        id: "openAssignments",
        title: "Open Assignments",
        count: openAssignments.length,
        severity:
          openAssignments.length > 0
            ? "warning"
            : "success",
        action: "openAssignments"
      },
      {
        id: "conflicts",
        title: "Conflicts",
        count: conflicts.length,
        severity:
          conflicts.length > 0
            ? "danger"
            : "success",
        action: "conflicts"
      },
      {
        id: "inactiveAssignments",
        title: "Inactive Crew Assigned",
        count: inactiveAssignments.length,
        severity:
          inactiveAssignments.length > 0
            ? "warning"
            : "success",
        action: "inactiveAssignments"
      },
      {
        id: "eligibilityIssues",
        title: "Eligibility Issues",
        count: eligibilityIssues.length,
        severity:
          eligibilityIssues.length > 0
            ? "danger"
            : "success",
        action: "eligibilityIssues"
      }
    ];
  }

  function getPendingClaims() {

  return gameService
    .getAll()
    .filter(game =>
      assignmentService.isPendingApproval(game)
    )
    .map(game => ({
      id: game.id,
      matchup: `${game.awayTeam} @ ${game.homeTeam}`,
      date: game.date,
      time: game.time,
      claimedBy:
        crewService.getDisplayName(game.claimedBy)
    }));

}

  function getTodaysSchedule() {

    const today = new Date().toISOString().split("T")[0];

    return gameService
      .getAll()
      .filter(game => game.date === today)
      .sort((a, b) => a.time.localeCompare(b.time))
      .map(game => {

        const assigned =
          assignmentService.isAssigned(game);

        return {
  id: game.id,
  time: game.time,
  matchup: `${game.awayTeam} @ ${game.homeTeam}`,
  field: game.field,
  level: game.level,
  assigned,
  assignmentStatus: assignmentService.getStatus(game),
  assignmentStatusLabel:
    typeof getAssignmentStatusLabel === "function"
      ? getAssignmentStatusLabel(game)
      : assignmentService.getStatus(game),
  crewName: assigned
    ? crewService.getDisplayName(game.crewId)
    : "Needs Crew"
};

      });

  }

  return {
    getOperationsSummary,
    getNeedsAttention,
    getTodaysSchedule,
    getPendingClaims
  };

})();