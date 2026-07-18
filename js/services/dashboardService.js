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

  function getRecentOperationalActivity(
    limit = 8
  ) {
    if (
      typeof activityService === "undefined" ||
      typeof activityService.getRecent !==
        "function"
    ) {
      return [];
    }

    const normalizedLimit =
      Number.isInteger(limit) &&
      limit > 0
        ? limit
        : 8;

    return activityService
      .getRecent(
        Math.max(
          normalizedLimit,
          50
        )
      )
      .slice(
        0,
        normalizedLimit
      )
      .map(
        activity =>
          normalizeOperationalActivity(
            activity
          )
      );
  }

  function normalizeOperationalActivity(
    activity = {}
  ) {
    const type =
      String(
        activity.type ||
        "activity"
      )
        .trim()
        .toLowerCase();

    const action =
      String(
        activity.action || ""
      )
        .trim()
        .toLowerCase();

    const relatedGame =
      activity.gameId &&
      typeof gameService !== "undefined" &&
      typeof gameService.getById === "function"
        ? gameService.getById(
            activity.gameId
          )
        : null;

    return {
      id:
        activity.id || "",

      type,

      category:
        getOperationalActivityCategory(
          type
        ),

      action:
        activity.action || "",

      actionLabel:
        getOperationalActivityLabel(
          type,
          action,
          activity
        ),

      message:
        getOperationalActivityMessage(
          type,
          action,
          activity
        ),

      matchup:
        activity.matchup || "",

      gameId:
        activity.gameId || "",

      accountId:
        activity.accountId || "",

      actor:
        activity.actor || "",

      location:
        activity.location ||
        activity.metadata?.field ||
        activity.metadata?.venue ||
        relatedGame?.field ||
        relatedGame?.venue ||
        "",

      subject:
        activity.subject || "",

      object:
        activity.object || "",

      createdAt:
        activity.createdAt || ""
    };
  }

  function getOperationalActivityCategory(
    type
  ) {
    const categories = {
      assignment: "Assignments",
      claim: "Claims",
      claims: "Claims",
      review: "Reviews",
      account: "Accounts",
      availability: "Availability",
      import: "Schedule",
      schedule: "Schedule",
      game: "Games",
      conflict: "Conflicts",
      authentication: "Accounts",
      login: "Accounts",
      profile: "Accounts",
      notification: "Communications",
      communication: "Communications"
    };

    return (
      categories[type] ||
      "Operations"
    );
  }

  function getOperationalActivityLabel(
    type,
    action,
    activity = {}
  ) {
    if (activity.actionLabel) {
      return activity.actionLabel;
    }

    const labels = {
      assigned: "Crew Assigned",
      cleared: "Assignment Cleared",
      claimed: "Assignment Claimed",
      claim_submitted: "Claim Submitted",
      claim_approved: "Claim Approved",
      claim_rejected: "Claim Rejected",
      approved: "Approved",
      rejected: "Rejected",
      submitted: "Submitted",
      returned: "Returned",
      review_approved: "Review Approved",
      review_submitted: "Review Submitted",
      review_returned: "Review Returned",
      account_created: "Account Created",
      account_approved: "Account Approved",
      account_rejected: "Account Rejected",
      availability_updated:
        "Availability Updated",
      games_imported: "Games Imported",
      schedule_updated: "Schedule Updated",
      game_created: "Game Added",
      game_updated: "Game Updated",
      game_cancelled: "Game Cancelled",
      game_deleted: "Game Deleted",
      conflict_detected:
        "Conflict Detected",
      conflict_resolved:
        "Conflict Resolved",
      profile_updated: "Profile Updated",
      signed_in: "Signed In",
      logged_in: "Signed In",
      message_sent: "Message Sent",
      notification_sent:
        "Notification Sent"
    };

    if (labels[action]) {
      return labels[action];
    }

    const fallbackByType = {
      assignment:
        "Assignment Update",
      claim:
        "Claim Update",
      claims:
        "Claim Update",
      review:
        "Review Update",
      account:
        "Account Update",
      availability:
        "Availability Update",
      import:
        "Schedule Import",
      schedule:
        "Schedule Update",
      game:
        "Game Update",
      conflict:
        "Conflict Update",
      authentication:
        "Account Activity",
      profile:
        "Profile Update",
      login:
        "Account Activity",
      notification:
        "Communication Update",
      communication:
        "Communication Update"
    };

    return (
      fallbackByType[type] ||
      "Operational Update"
    );
  }

  function getOperationalActivityMessage(
    type,
    action,
    activity = {}
  ) {
    if (activity.message) {
      return activity.message;
    }

    if (activity.story) {
      return activity.story;
    }

    const actor =
      activity.actor || "";

    const subject =
      activity.subject || "";

    const object =
      activity.object ||
      activity.matchup ||
      "";

    if (
      actor &&
      subject &&
      object
    ) {
      return (
        `${actor}: ${subject} — ` +
        `${object}`
      );
    }

    if (
      subject &&
      object
    ) {
      return (
        `${subject} — ${object}`
      );
    }

    if (object) {
      return object;
    }

    if (activity.matchup) {
      return activity.matchup;
    }

    const category =
      getOperationalActivityCategory(
        type
      );

    return (
      `${category} activity recorded.`
    );
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
      assignments: assignments.map(
        assignment => ({
          id: assignment.id || "",
          position:
            assignment.position || "Position",
          crewId: assignment.crewId || "",
          crewName: assignment.crewId
            ? crewService.getDisplayName(
                assignment.crewId
              )
            : "OPEN",
          status: assignment.status || ""
        })
      ),
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

  function getWorkbench() {
    const needsAssignment =
      assignmentService.getNeedsAssignmentGames();

    const pendingClaims =
      claimsQueueService.getPendingClaims();

    const awaitingReview =
      reviewService.getSubmittedGames();

    const returnedReviews =
      reviewService.getReturnedGames();

    const todaysPriorities =
      getTodaysSchedule()
        .filter(game => !game.assigned);

    const recentActivity =
      getRecentAssignmentActivity();

    const sections = {
      needsAssignment,
      pendingClaims,
      awaitingReview,
      returnedReviews,
      todaysPriorities,
      recentActivity
    };

    const counts = {
      needsAssignment: needsAssignment.length,
      pendingClaims: pendingClaims.length,
      awaitingReview: awaitingReview.length,
      returnedReviews: returnedReviews.length,
      todaysPriorities: todaysPriorities.length,
      recentActivity: recentActivity.length
    };

    const priorityOrder = [
      {
        key: "todaysPriorities",
        title: "Today's Priorities"
      },
      {
        key: "pendingClaims",
        title: "Pending Claims"
      },
      {
        key: "awaitingReview",
        title: "Awaiting Review"
      },
      {
        key: "returnedReviews",
        title: "Returned Reviews"
      },
      {
        key: "needsAssignment",
        title: "Needs Assignment"
      }
    ];

    const nextSection =
      priorityOrder.find(
        section => counts[section.key] > 0
      ) || null;

    return {
      sections,
      counts,
      priorityOrder,
      nextSection,

      totalActionItems:
        counts.needsAssignment +
        counts.pendingClaims +
        counts.awaitingReview +
        counts.returnedReviews +
        counts.todaysPriorities,

      requiresAttention:
        counts.needsAssignment > 0 ||
        counts.pendingClaims > 0 ||
        counts.awaitingReview > 0 ||
        counts.returnedReviews > 0 ||
        counts.todaysPriorities > 0,

      isEmpty:
        Object.values(counts)
          .every(count => count === 0)
    };
  }
function getOperationsCenter(
  requestedQueue = "all"
) {
  const role =
    typeof authorizationService !== "undefined" &&
    typeof authorizationService.currentRole === "function"
      ? authorizationService.currentRole()
      : "umpire";

  const canManageAccounts =
    typeof authorizationService !== "undefined" &&
    typeof authorizationService.canManageAccounts === "function" &&
    authorizationService.canManageAccounts(role);

  const validQueues = [
    "all",
    "assignments",
    "claims",
    "reviews",
    ...(canManageAccounts ? ["accounts"] : []),
    "conflicts"
  ];

  const normalizedQueue =
    String(requestedQueue || "all")
      .trim()
      .toLowerCase();

  const activeQueue =
    validQueues.includes(
      normalizedQueue
    )
      ? normalizedQueue
      : "all";

  const workbench = getWorkbench();

  const pendingAccounts =
    canManageAccounts &&
    typeof accountService !== "undefined" &&
    typeof accountService
      .getPendingAccounts === "function"
      ? accountService
          .getPendingAccounts()
      : [];

  const today =
    new Date()
      .toISOString()
      .split("T")[0];

  const conflicts =
    typeof conflictService !== "undefined" &&
    typeof conflictService
      .getDailyIssues === "function"
      ? (
          conflictService
            .getDailyIssues(today) || []
        )
      : [];

  const tasks = {
    todaysPriorities: {
      key: "todaysPriorities",
      title: "Today's Priorities",
      count:
        workbench.counts
          .todaysPriorities,
      action:
        getOperationsTaskAction(
          "todaysPriorities"
        ),
      items:
        workbench.sections
          .todaysPriorities || []
    },

    pendingClaims: {
      key: "pendingClaims",
      title: "Pending Claims",
      count:
        workbench.counts
          .pendingClaims,
      action:
        getOperationsTaskAction(
          "pendingClaims"
        ),
      items:
        workbench.sections
          .pendingClaims || []
    },

    awaitingReview: {
      key: "awaitingReview",
      title: "Awaiting Review",
      count:
        workbench.counts
          .awaitingReview,
      action:
        getOperationsTaskAction(
          "awaitingReview"
        ),
      items:
        workbench.sections
          .awaitingReview || []
    },

    returnedReviews: {
      key: "returnedReviews",
      title: "Returned Reviews",
      count:
        workbench.counts
          .returnedReviews,
      action:
        getOperationsTaskAction(
          "returnedReviews"
        ),
      items:
        workbench.sections
          .returnedReviews || []
    },

    needsAssignment: {
      key: "needsAssignment",
      title: "Needs Assignment",
      count:
        workbench.counts
          .needsAssignment,
      action:
        getOperationsTaskAction(
          "needsAssignment"
        ),
      items:
        workbench.sections
          .needsAssignment || []
    },

    pendingAccounts: {
      key: "pendingAccounts",
      title: "Pending Accounts",
      count: pendingAccounts.length,
      action: "pending-account",
      items: pendingAccounts
    },

    conflicts: {
      key: "conflicts",
      title: "Schedule Conflicts",
      count: conflicts.length,
      action: "schedule-conflict",
      items: conflicts
    }
  };

  const allOrder = [
    "conflicts",
    "todaysPriorities",
    "pendingClaims",
    "awaitingReview",
    "returnedReviews",
    "needsAssignment",
    ...(canManageAccounts ? ["pendingAccounts"] : [])
  ];

  const queueTaskKeys = {
    all: allOrder,

    assignments: [
      "todaysPriorities",
      "needsAssignment"
    ],

    claims: [
      "pendingClaims"
    ],

    reviews: [
      "awaitingReview",
      "returnedReviews"
    ],

    accounts: [
      "pendingAccounts"
    ],

    conflicts: [
      "conflicts"
    ]
  };

  const activeTasks =
    queueTaskKeys[activeQueue]
      .map(key => tasks[key])
      .filter(
        task =>
          task &&
          task.count > 0
      );

  const currentTask =
    activeTasks[0] || null;

  const remainingTasks =
    activeTasks.slice(1);

  const activeWorkItems =
    activeTasks.flatMap(
      task =>
        (task.items || []).map(
          (item, index) => ({
            id:
              item.id ||
              item.gameId ||
              item.accountId ||
              `${task.key}-${index}`,
            task,
            item
          })
        )
    );

  const queueCounts = {
    assignments:
      tasks.todaysPriorities.count +
      tasks.needsAssignment.count,

    claims:
      tasks.pendingClaims.count,

    reviews:
      tasks.awaitingReview.count +
      tasks.returnedReviews.count,

    accounts:
      tasks.pendingAccounts.count,

    conflicts:
      tasks.conflicts.count,

    needsAssignment:
      tasks.needsAssignment.count,

    pendingClaims:
      tasks.pendingClaims.count,

    awaitingReview:
      tasks.awaitingReview.count,

    returnedReviews:
      tasks.returnedReviews.count,

    todaysPriorities:
      tasks.todaysPriorities.count
  };

  queueCounts.all =
    queueCounts.assignments +
    queueCounts.claims +
    queueCounts.reviews +
    queueCounts.accounts +
    queueCounts.conflicts;

  const legacyKeys = [
    "todaysPriorities",
    "pendingClaims",
    "awaitingReview",
    "returnedReviews",
    "needsAssignment"
  ];

  const completed =
    legacyKeys.filter(
      key =>
        tasks[key].count === 0
    ).length;

  const operationalProgress = {
    completed,
    total: legacyKeys.length,
    percent:
      Math.round(
        (
          completed /
          legacyKeys.length
        ) * 100
      )
  };

  const todaysEvents =
    getTodaysSchedule();

  const upcomingWork =
    getUpcomingGames();

  const openPositions =
    getOpenAssignments();

  const statusMetrics = [
    {
      id: "events-today",
      label: "Events today",
      value: todaysEvents.length,
      action: "schedule-today",
      item: {}
    },
    {
      id: "fully-staffed",
      label: "Fully staffed",
      value:
        todaysEvents.filter(
          event => event.fullyStaffed
        ).length,
      action: "assigner-workbench",
      item: { staffing: "fully-staffed" }
    },
    {
      id: "open-positions",
      label: "Open positions",
      value: openPositions.length,
      requiresAction: true,
      action: "assigner-workbench",
      item: { staffing: "open" }
    },
    {
      id: "pending-claims",
      label: "Pending claims",
      value: tasks.pendingClaims.count,
      requiresAction: true,
      action: "pending-claim",
      item:
        tasks.pendingClaims.items[0] || {},
      detailItems:
        tasks.pendingClaims.items,
      detailAction: "pending-claim",
      detailActionLabel: "Review claim"
    },
    {
      id: "reviews",
      label: "Reviews requiring action",
      value: queueCounts.reviews,
      requiresAction: true,
      action:
        tasks.returnedReviews.count > 0
          ? "returned-review"
          : "awaiting-review",
      item:
        tasks.returnedReviews.items[0] ||
        tasks.awaitingReview.items[0] ||
        {},
      detailItems: [
        ...tasks.returnedReviews.items,
        ...tasks.awaitingReview.items
      ],
      detailAction:
        tasks.returnedReviews.count > 0
          ? "returned-review"
          : "awaiting-review",
      detailActionLabel: "Open review"
    },
    ...(canManageAccounts
      ? [{
          id: "pending-accounts",
          label: "Pending accounts",
          value:
            tasks.pendingAccounts.count,
          requiresAction: true,
          action: "pending-account",
          item:
            tasks.pendingAccounts.items[0] || {},
          detailItems:
            tasks.pendingAccounts.items,
          detailAction: "pending-account",
          detailActionLabel: "Review account"
        }]
      : []),
    {
      id: "active-alerts",
      label: "Active alerts",
      value: tasks.conflicts.count,
      requiresAction: true,
      action: "schedule-conflict",
      item: tasks.conflicts.items[0] || {}
    }
  ];

  const monthEnd =
    new Date(`${today}T12:00:00`);
  monthEnd.setMonth(monthEnd.getMonth() + 1, 0);

  const weekEnd =
    new Date(`${today}T12:00:00`);
  weekEnd.setDate(
    weekEnd.getDate() +
      (7 - weekEnd.getDay()) % 7
  );

  const buildStaffingPeriod = (
    id,
    label,
    startDate,
    endDate
  ) => {
    const games = gameService.getAll()
      .filter(game =>
        game.date >= startDate &&
        game.date <= endDate &&
        gameService.getStatus(game) !== "cancelled"
      )
      .map(toDashboardGame);

    const openPositions = games.reduce(
      (total, game) =>
        total + game.openAssignmentCount,
      0
    );
    const hasTodayGap = games.some(
      game =>
        game.date === today &&
        game.openAssignmentCount > 0
    );

    const gameDates = [...new Set(
      games.map(game => game.date)
    )];
    const reviewCount = games.filter(game => {
      const source = gameService.getById(game.id);
      return ["submitted", "returned"].includes(
        source?.review?.status
      );
    }).length;
    const conflictCount = gameDates.reduce(
      (total, date) =>
        total + (
          conflictService?.getDailyIssues?.(date)
            ?.length || 0
        ),
      0
    );
    const accountCount = canManageAccounts
      ? pendingAccounts.filter(account => {
          const createdDate = String(
            account.createdAt || ""
          ).split("T")[0];
          return createdDate >= startDate &&
            createdDate <= endDate;
        }).length
      : 0;
    const claimCount = games.reduce(
      (total, game) =>
        total + game.pendingClaimCount,
      0
    );
    const signalStatus = (signalId, value) => {
      if (value === 0) return "healthy";
      if (id === "today" || signalId === "conflicts") {
        return "critical";
      }
      return "watch";
    };

    return {
      id,
      label,
      eventCount: games.length,
      fullyStaffedCount:
        games.filter(game => game.fullyStaffed).length,
      openPositions,
      signals: [
        {
          id: "assignments",
          label: "Assignments",
          value: openPositions,
          status: signalStatus("assignments", openPositions)
        },
        {
          id: "claims",
          label: "Claims",
          value: claimCount,
          status: signalStatus("claims", claimCount)
        },
        {
          id: "reviews",
          label: "Reviews",
          value: reviewCount,
          status: signalStatus("reviews", reviewCount)
        },
        ...(canManageAccounts
          ? [{
              id: "accounts",
              label: "Accounts",
              value: accountCount,
              status: signalStatus("accounts", accountCount)
            }]
          : []),
        {
          id: "conflicts",
          label: "Conflicts",
          value: conflictCount,
          status: signalStatus("conflicts", conflictCount)
        }
      ],
      status: hasTodayGap
        ? "critical"
        : openPositions > 0
          ? "watch"
          : "healthy"
    };
  };

  const staffingPeriods = [
    buildStaffingPeriod("today", "Today", today, today),
    buildStaffingPeriod(
      "week",
      "This week",
      today,
      weekEnd.toISOString().split("T")[0]
    ),
    buildStaffingPeriod(
      "month",
      "This month",
      today,
      monthEnd.toISOString().split("T")[0]
    )
  ];

  return {
    activeQueue,
    role,
    canManageAccounts,
    operationalDate: today,

    queues: [
      {
        id: "all",
        label: "All Work",
        count: queueCounts.all
      },
      {
        id: "assignments",
        label: "Assignments",
        count:
          queueCounts.assignments
      },
      {
        id: "claims",
        label: "Claims",
        count: queueCounts.claims
      },
      {
        id: "reviews",
        label: "Reviews",
        count: queueCounts.reviews
      },
      ...(canManageAccounts
        ? [{
            id: "accounts",
            label: "Accounts",
            count: queueCounts.accounts
          }]
        : []),
      {
        id: "conflicts",
        label: "Conflicts",
        count: queueCounts.conflicts
      }
    ],

    activeTasks,
    activeWorkItems,
    currentTask,
    remainingTasks,
    queueCounts,
    statusMetrics,
    staffingPeriods,
    upcomingWork,

    recentActivity:
      getRecentOperationalActivity(
        50
      ),

    operationalProgress,

    outstandingCount:
      queueCounts[activeQueue],

    totalOutstandingCount:
      queueCounts.all,

    isEmpty:
      activeTasks.length === 0
  };
}

  function getOperationsTaskAction(key) {
    const actions = {
      needsAssignment:
        "needs-assignment",

      pendingClaims:
        "pending-claim",

      awaitingReview:
        "awaiting-review",

      returnedReviews:
        "returned-review",

      todaysPriorities:
        "today-priority"
    };

    return actions[key] || "";
  }

  const COMMUNICATION_CATEGORY_LABELS = {
    assignments: "Assignments",
    claims: "Claims",
    reviews: "Reviews",
    availability: "Availability",
    accounts: "Accounts",
    activityDigest: "Activity digest"
  };

  function getCommunicationPreferencesSummary() {
    const account =
      typeof loginService !== "undefined" &&
      typeof loginService.getCurrentAccount ===
        "function"
        ? loginService.getCurrentAccount()
        : null;

    const defaults =
      typeof accountService !== "undefined" &&
      typeof accountService
        .getDefaultCommunicationPreferences ===
        "function"
        ? accountService
            .getDefaultCommunicationPreferences()
        : {};

    const preferences = {
      ...defaults,
      ...(account?.communicationPreferences || {})
    };

    const categories =
      Object.entries(
        COMMUNICATION_CATEGORY_LABELS
      ).map(([key, label]) => ({
        key,
        label,
        enabled:
          preferences[key] !== false
      }));

    const muted = categories
      .filter(category => !category.enabled)
      .map(category => ({
        key: category.key,
        label: category.label,
        text: `${category.label} muted`
      }));

    return {
      categories,
      enabledCount:
        categories.filter(
          category => category.enabled
        ).length,
      disabledCount: muted.length,
      muted,
      hasMuted: muted.length > 0,
      soundEnabled:
        preferences.soundEnabled !== false,
      desktopNotifications:
        preferences.desktopNotifications ===
        true,
      destination: {
        page: "profile",
        context: {
          section: "communication"
        }
      }
    };
  }

  function getNotificationsSummary() {
    const hasNotificationService =
      typeof notificationService !==
        "undefined";

    const notifications =
      hasNotificationService &&
      typeof notificationService
        .getNotifications === "function"
        ? notificationService
            .getNotifications()
        : [];

    const unread =
      notifications.filter(
        notification =>
          !notification.read
      );

    const unreadByCategory =
      hasNotificationService &&
      typeof notificationService
        .getUnreadByCategory ===
          "function"
        ? notificationService
            .getUnreadByCategory()
        : {};

    const newestNotification =
      notifications[0] || null;

    const oldestUnread =
      hasNotificationService &&
      typeof notificationService
        .getOldestUnread === "function"
        ? notificationService
            .getOldestUnread()
        : null;

    const communicationSummary =
      getCommunicationPreferencesSummary();

    const oldestUnreadAgeMilliseconds =
      oldestUnread?.createdAt
        ? Math.max(
            Date.now() -
              new Date(
                oldestUnread.createdAt
              ).getTime(),
            0
          )
        : 0;

    const oldestUnreadAgeDays =
      oldestUnread
        ? Math.floor(
            oldestUnreadAgeMilliseconds /
              86400000
          )
        : 0;

    const oldestUnreadAgeHours =
      oldestUnread
        ? Math.floor(
            oldestUnreadAgeMilliseconds /
              3600000
          )
        : 0;

    const oldestUnreadAgeLabel =
      !oldestUnread
        ? ""
        : oldestUnreadAgeDays > 0
          ? `${oldestUnreadAgeDays}d`
          : oldestUnreadAgeHours > 0
            ? `${oldestUnreadAgeHours}h`
            : "Less than 1h";

    return {
      unreadCount: unread.length,
      hasUnread:
        unread.length > 0,
      unreadByCategory,
      unreadCategories:
        Object.entries(
          unreadByCategory
        ).map(([key, count]) => ({
          key,
          count
        })),
      newestNotification,
      oldestUnread,
      oldestUnreadAgeMilliseconds,
      oldestUnreadAgeDays,
      oldestUnreadAgeHours,
      oldestUnreadAgeLabel,
      visibleNotificationCount:
        notifications.length,
      mutedCategories:
        communicationSummary.muted,
      mutedCategoryCount:
        communicationSummary.disabledCount,
      hasMutedCategories:
        communicationSummary.hasMuted,
      destination: {
        page: "notifications",
        context: {}
      }
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
  getWorkbench,
  getAvailabilityReminder,
  getRecentAssignmentActivity,
  getRecentOperationalActivity,
  getNeedsAttention,
  getUpcomingGames,
  getUpcomingGameCount,
  getOpenAssignments,
  getPendingClaims,
  getPendingAccounts,
  getRoleSummary,
  getNotificationsSummary,
  getCommunicationPreferencesSummary,
  getTodaysSchedule,
  getOperationsCenter,
};
})();
