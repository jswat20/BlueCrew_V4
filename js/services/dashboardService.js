// js/services/dashboardService.js

const dashboardService = (() => {
  const UPCOMING_GAME_LIMIT = 8;

  function getToday() {
    return new Date().toISOString().split("T")[0];
  }

  function compareGames(a, b) {
    if ((a.date || "") !== (b.date || "")) {
      return String(a.date || "").localeCompare(String(b.date || ""));
    }

    if ((a.time || "") !== (b.time || "")) {
      return String(a.time || "").localeCompare(String(b.time || ""));
    }

    return String(a.field || "").localeCompare(String(b.field || ""));
  }
  function getUpcomingGameRecords() {
    const today = getToday();

    return gameService
      .getAll()
      .filter(game =>
        game.date &&
        game.date >= today &&
        gameService.getStatus(game) !==
          "cancelled"
      )
      .sort(compareGames);
  }

  function getAssignments(game) {
    if (
      typeof assignmentService !== "undefined" &&
      typeof assignmentService.getAssignments === "function"
    ) {
      return assignmentService.getAssignments(game);
    }

    return Array.isArray(game.assignments)
      ? game.assignments
      : [];
  }

  function isOpenAssignment(assignment) {
    return (
      !assignment.crewId &&
      assignment.status !== AssignmentStatus.PENDING_APPROVAL &&
      assignment.status !== AssignmentStatus.LOCKED
    );
  }

  function isPendingClaim(assignment) {
    return (
      assignment.status === AssignmentStatus.PENDING_APPROVAL &&
      Boolean(assignment.claimedBy)
    );
  }

  function getUpcomingGames() {
    return getUpcomingGameRecords()
      .slice(0, UPCOMING_GAME_LIMIT)
      .map(toDashboardGame);
  }

  function getUpcomingGameCount() {
    return getUpcomingGameRecords().length;
  }

  function getOpenAssignments() {
    return getUpcomingGameRecords().flatMap(game =>
      getAssignments(game)
        .filter(isOpenAssignment)
        .map(assignment => ({
          game,
          assignment,
          gameId: game.id,
          assignmentId: assignment.id
        }))
    );
  }

  function getPendingClaims() {
    if (
      typeof claimsQueueService !== "undefined" &&
      typeof claimsQueueService.getPendingClaims === "function"
    ) {
      return claimsQueueService
        .getPendingClaims()
        .filter(claim => !claim.date || claim.date >= getToday());
    }

    return getUpcomingGameRecords().flatMap(game =>
      getAssignments(game)
        .filter(isPendingClaim)
        .map(assignment => ({
          game,
          assignment,
          gameId: game.id,
          assignmentId: assignment.id
        }))
    );
  }

  function getPendingAccounts() {
    if (
      typeof accountService === "undefined" ||
      typeof accountService.getPendingAccounts !== "function"
    ) {
      return [];
    }

    return accountService.getPendingAccounts();
  }
function getPendingAccounts() {
  if (
    typeof accountService === "undefined" ||
    typeof accountService.getPendingAccounts !== "function"
  ) {
    return [];
  }

  return accountService.getPendingAccounts();
}

function getRoleSummary() {
  if (
    typeof accountService === "undefined" ||
    typeof accountService.getRoleSummary !== "function"
  ) {
    return {
      administrator: 0,
      assigner: 0,
      umpire: 0
    };
  }

  return accountService.getRoleSummary();
}

  function getOperationsSummary() {
    const upcomingGames = getUpcomingGameCount();
    const openAssignments = getOpenAssignments().length;
    const pendingClaims = getPendingClaims().length;
    const pendingAccounts = getPendingAccounts().length;

    return [
      {
        id: "upcoming-games",
        label: "Upcoming Games",
        value: upcomingGames,
        color: "blue",
        action: "upcoming-games"
      },
      {
        id: "open-assignments",
        label: "Open Assignments",
        value: openAssignments,
        color: openAssignments > 0 ? "orange" : "green",
        action: "open-assignments"
      },
      {
        id: "pending-claims",
        label: "Pending Claims",
        value: pendingClaims,
        color: pendingClaims > 0 ? "orange" : "green",
        action: "pending-claims"
      },
      {
        id: "pending-accounts",
        label: "Pending Accounts",
        value: pendingAccounts,
        color: pendingAccounts > 0 ? "orange" : "green",
        action: "pending-accounts"
      }
    ];
  }

  function getAvailabilityReminder() {
    const account =
      typeof loginService !== "undefined" &&
      typeof loginService.getCurrentAccount === "function"
        ? loginService.getCurrentAccount()
        : null;

    const crewId = account?.crewId || null;

    if (
      !crewId ||
      typeof availabilityService === "undefined" ||
      typeof availabilityService.getAvailabilitySummary !== "function"
    ) {
      return {
        id: "availability",
        severity: "info",
        title: "No availability entered",
        message:
          "Add your availability so assigners know when you can work.",
        action: "availability"
      };
    }

    const summary =
      availabilityService.getAvailabilitySummary(crewId);

    if (!summary || summary.total === 0) {
      return {
        id: "availability",
        severity: "info",
        title: "No availability entered",
        message:
          "Add your availability so assigners know when you can work.",
        action: "availability"
      };
    }

    const unavailableAssignment =
      summary.records.find(record =>
        record.status === "unavailable" &&
        availabilityService.hasAssignmentOnDate(
          crewId,
          record.date
        )
      );

    if (unavailableAssignment) {
      return {
        id: "availability",
        severity: "warning",
        title: "Assignment conflicts with availability",
        message:
          `You have an assigned game on ${unavailableAssignment.date}, ` +
          "when you are marked unavailable.",
        action: "availability"
      };
    }

    if (summary.nextUnavailableDate) {
      return {
        id: "availability",
        severity: "info",
        title: "Upcoming unavailable period",
        message:
          `You are marked unavailable beginning ` +
          `${summary.nextUnavailableDate}.`,
        action: "availability"
      };
    }

    return {
      id: "availability",
      severity: "success",
      title: "Availability looks good",
      message:
        "Your entered availability has no assignment conflicts.",
      action: "availability"
    };
  }

  function getRecentAssignmentActivity(limit = 5) {
    if (
      typeof activityService === "undefined" ||
      typeof activityService.getRecent !== "function"
    ) {
      return [];
    }

    const normalizedLimit =
      Number.isInteger(limit) && limit > 0
        ? limit
        : 5;

    return activityService
      .getRecent(50)
      .filter(
        activity =>
          activity?.type === "assignment"
      )
      .slice(0, normalizedLimit)
      .map(activity => ({
        id: activity.id,
        action: activity.action || "",
        actionLabel:
          formatAssignmentActivityAction(
            activity.action
          ),
        gameId: activity.gameId || "",
        matchup:
          activity.matchup ||
          "Assignment activity",
        message:
          activity.message || "",
        createdAt:
          activity.createdAt || ""
      }));
  }

  function formatAssignmentActivityAction(
    action
  ) {
    const labels = {
      assigned: "Assigned",
      cleared: "Cleared",
      opened_for_claim:
        "Opened for Claim",
      claim_submitted:
        "Claim Submitted",
      claim_approved:
        "Claim Approved",
      claim_rejected:
        "Claim Rejected",
      locked: "Locked"
    };

    return (
      labels[action] ||
      String(action || "Updated")
        .replaceAll("_", " ")
        .replace(/\b\w/g, letter =>
          letter.toUpperCase()
        )
    );
  }

  function getNeedsAttention() {
    const openAssignments = getOpenAssignments();
    const pendingClaims = getPendingClaims();
    const pendingAccounts = getPendingAccounts();

    return [
      {
        id: "open-assignments",
        title: "Open Assignments",
        count: openAssignments.length,
        severity: openAssignments.length ? "warning" : "clear",
        action: "open-assignments"
      },
      {
        id: "pending-claims",
        title: "Pending Claims",
        count: pendingClaims.length,
        severity: pendingClaims.length ? "warning" : "clear",
        action: "pending-claims"
      },
      {
        id: "pending-accounts",
        title: "Pending Accounts",
        count: pendingAccounts.length,
        severity: pendingAccounts.length ? "warning" : "clear",
        action: "pending-accounts"
      }
    ];
  }

  function getCrewNames(game) {
    const names = getAssignments(game)
      .filter(assignment => assignment.crewId)
      .map(assignment => {
        if (
          typeof crewService !== "undefined" &&
          typeof crewService.getDisplayName === "function"
        ) {
          return crewService.getDisplayName(assignment.crewId);
        }

        return assignment.crewId;
      })
      .filter(Boolean);

    return [...new Set(names)];
  }

  function toDashboardGame(game) {
    const assignments = getAssignments(game);
    const openAssignmentCount =
      assignments.filter(isOpenAssignment).length;
    const pendingClaimCount =
      assignments.filter(isPendingClaim).length;
    const crewNames = getCrewNames(game);

    return {
      id: game.id,
      date: game.date,
      time: game.time || "",
      field: game.field || "",
      level: game.level || "",
      matchup: `${game.awayTeam || "Away"} @ ${game.homeTeam || "Home"}`,
      assignmentCount: assignments.length,
      openAssignmentCount,
      pendingClaimCount,
      fullyStaffed:
        assignments.length > 0 &&
        openAssignmentCount === 0 &&
        pendingClaimCount === 0,
      crewName:
        crewNames.length > 0
          ? crewNames.join(", ")
          : "No umpire assigned"
    };
  }

  function getSeasonDashboard() {
    const assignmentReport =
      reportingService.getAssignmentReport();

    const availabilityReport =
      reportingService.getAvailabilityReport();

    const reviewReport =
      reportingService.getReviewReport();

    const assignmentDetails =
      reportingService.getAssignmentDetails();

    const approvedAccounts =
      accountService.getApprovedAccounts();

    const activeOfficials =
      approvedAccounts.filter(account =>
        account.role === "umpire" ||
        (
          Array.isArray(account.roles) &&
          account.roles.includes("umpire")
        )
      ).length;

    const operations = {
      scheduledGames:
        assignmentReport.totalGames || 0,
      completedGames:
        reviewReport.completed || 0,
      awaitingReview:
        reviewReport.submitted || 0,
      returnedReviews:
        reviewReport.returned || 0,
      approvedReviews:
        reviewReport.approved || 0
    };

    const staffing = {
      assignmentCoveragePercentage:
        assignmentReport.coveragePercentage || 0,
      fullyStaffedGames:
        assignmentReport.fullyStaffedGames || 0,
      openAssignments:
        assignmentReport.openAssignments || 0,
      pendingClaims:
        assignmentReport.pendingClaims || 0
    };

    const availability = {
      available:
        availabilityReport.available || 0,
      unavailable:
        availabilityReport.unavailable || 0,
      maybe:
        availabilityReport.maybe || 0,
      noResponse:
        availabilityReport.noResponse || 0,
      responsePercentage:
        availabilityReport.responsePercentage || 0
    };

    const officials = {
      activeOfficials,
      pendingApprovals:
        accountService.getPendingAccounts().length
    };

    const highPriorityItems = [
      {
        key: "returned-reviews",
        title: "Returned Reviews",
        count: operations.returnedReviews,
        detail:
          "Returned game reports need correction and resubmission.",
        destination: "review-queue",
        priority: "high"
      },
      {
        key: "pending-claims",
        title: "Pending Claims",
        count: staffing.pendingClaims,
        detail:
          "Assignment claims are waiting for an assigner decision.",
        destination: "claims-queue",
        priority: "high"
      },
      {
        key: "open-assignments",
        title: "Open Assignments",
        count: staffing.openAssignments,
        detail:
          "Open assignment slots still need officials.",
        destination: "schedule",
        priority: "medium"
      },
      {
        key: "pending-approvals",
        title: "Pending Official Approvals",
        count: officials.pendingApprovals,
        detail:
          "New official accounts are waiting for approval.",
        destination: "accounts",
        priority: "medium"
      }
    ]
      .filter(item => item.count > 0)
      .sort((a, b) => {
        const priorityOrder = {
          high: 0,
          medium: 1,
          low: 2
        };

        const priorityDifference =
          priorityOrder[a.priority] -
          priorityOrder[b.priority];

        if (priorityDifference !== 0) {
          return priorityDifference;
        }

        return b.count - a.count;
      });

    const upcomingDeadlines =
      assignmentDetails
        .filter(row =>
          row.openAssignments > 0 ||
          row.pendingClaims > 0
        )
        .slice(0, 5)
        .map(row => ({
          key: `staffing-${row.gameId}`,
          gameId: row.gameId,
          title: row.matchup,
          detail: [
            row.date,
            row.time,
            row.field
          ]
            .filter(Boolean)
            .join(" • "),
          status: row.status,
          openAssignments:
            row.openAssignments,
          pendingClaims:
            row.pendingClaims,
          destination: "schedule"
        }));

    const operationalHealth = [
      {
        key: "assignment-coverage",
        title: "Assignment Coverage",
        value:
          staffing.assignmentCoveragePercentage,
        valueLabel:
          `${staffing.assignmentCoveragePercentage}%`,
        status:
          staffing.assignmentCoveragePercentage >= 90
            ? "healthy"
            : staffing.assignmentCoveragePercentage >= 75
              ? "watch"
              : "critical",
        detail:
          "Percentage of assignment slots currently covered."
      },
      {
        key: "availability-response",
        title: "Availability Response",
        value:
          availability.responsePercentage,
        valueLabel:
          `${availability.responsePercentage}%`,
        status:
          availability.responsePercentage >= 80
            ? "healthy"
            : availability.responsePercentage >= 60
              ? "watch"
              : "critical",
        detail:
          "Percentage of availability requests with a response."
      },
      {
        key: "review-throughput",
        title: "Review Throughput",
        value:
          operations.approvedReviews,
        valueLabel:
          String(operations.approvedReviews),
        status:
          operations.returnedReviews > 0
            ? "watch"
            : operations.awaitingReview > 0
              ? "watch"
              : "healthy",
        detail:
          operations.returnedReviews > 0
            ? `${operations.returnedReviews} returned review${
                operations.returnedReviews === 1
                  ? ""
                  : "s"
              } need attention.`
            : operations.awaitingReview > 0
              ? `${operations.awaitingReview} review${
                  operations.awaitingReview === 1
                    ? ""
                    : "s"
                } awaiting decision.`
              : "No review backlog requires attention."
      }
    ];

    return {
      operations,
      staffing,
      availability,
      officials,

      requiresAttention:
        highPriorityItems.length > 0,

      highPriorityItems,
      upcomingDeadlines,
      operationalHealth,

      activity:
        getRecentAssignmentActivity()
    };
  }

  // Backward-compatible alias for existing callers.
  function getTodaysSchedule() {
    const today = getToday();

    return getUpcomingGameRecords()
      .filter(game => game.date === today)
      .map(toDashboardGame)
      .map(game => ({
        ...game,
        assigned: game.fullyStaffed
      }));
  }

  return {
  getOperationsSummary,
  getSeasonDashboard,
  getAvailabilityReminder,
  getRecentAssignmentActivity,
  getNeedsAttention,
  getUpcomingGames,
  getUpcomingGameCount,
  getOpenAssignments,
  getPendingClaims,
  getPendingAccounts,
  getRoleSummary,
  getTodaysSchedule
};
})();
