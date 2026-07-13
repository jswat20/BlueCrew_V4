// js/services/portalService.js

const portalService = (() => {
  const DEFAULT_ARRIVAL_MINUTES = 30;

  const STATUS_LABELS = Object.freeze({
    needs_assignment: "Needs Assignment",
    open_for_claim: "Open for Claim",
    pending_approval: "Pending Approval",
    assigned: "Assigned",
    locked: "Locked"
  });

  function getCurrentAccount() {
    return loginService.getCurrentAccount();
  }

  function getMySchedule() {
    const account = getCurrentAccount();

    if (!account || !account.crewId) {
      return [];
    }

    return gameService
      .getAll()
      .filter(game =>
        isGameAssignedToCrew(game, account.crewId)
      )
      .sort(sortByDateTime)
      .map(game => mapGame(game, account.crewId));
  }

  function getClaimableGames() {
    const account = getCurrentAccount();

    if (!account || !account.crewId) {
      return [];
    }

    return assignmentService
      .getClaimableGames()
      .sort(sortByDateTime)
      .map(game => mapGame(game, account.crewId));
  }

  function claimGame(gameId) {
    const account = getCurrentAccount();

    if (!account || !account.crewId) {
      return {
        success: false,
        message: "No logged in umpire."
      };
    }

    return assignmentService.claimGame(
      gameId,
      account.crewId
    );
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

  function getCrewAssignments(game, crewId) {
    return getAssignments(game).filter(
      assignment =>
        String(assignment.crewId) === String(crewId)
    );
  }

  function isGameAssignedToCrew(game, crewId) {
    if (String(game.crewId) === String(crewId)) {
      return true;
    }

    return getCrewAssignments(game, crewId).length > 0;
  }

  function getStatus(game, crewAssignments) {
    const lockedAssignment = crewAssignments.find(
      assignment =>
        assignment.locked === true ||
        assignment.status === "locked"
    );

    if (lockedAssignment) {
      return "locked";
    }

    const pendingAssignment = crewAssignments.find(
      assignment =>
        assignment.status === "pending_approval"
    );

    if (pendingAssignment) {
      return "pending_approval";
    }

    const assignedAssignment = crewAssignments.find(
      assignment =>
        assignment.status === "assigned"
    );

    if (assignedAssignment) {
      return "assigned";
    }

    if (
      typeof assignmentService !== "undefined" &&
      typeof assignmentService.getOverallStatus === "function"
    ) {
      return assignmentService.getOverallStatus(game);
    }

    if (
      typeof assignmentService !== "undefined" &&
      typeof assignmentService.getStatus === "function"
    ) {
      return assignmentService.getStatus(game);
    }

    return game.assignmentStatus || "assigned";
  }

  function getStatusLabel(status) {
    return STATUS_LABELS[status] || status || "Assigned";
  }

  function getPositions(crewAssignments) {
    const positions = crewAssignments
      .map(assignment => assignment.position)
      .filter(Boolean);

    return positions.length
      ? positions
      : ["Assigned"];
  }

  function getPartners(game, crewId) {
    const seenCrewIds = new Set();

    return getAssignments(game)
      .filter(assignment => {
        if (!assignment.crewId) {
          return false;
        }

        const assignmentCrewId =
          String(assignment.crewId);

        if (assignmentCrewId === String(crewId)) {
          return false;
        }

        if (seenCrewIds.has(assignmentCrewId)) {
          return false;
        }

        seenCrewIds.add(assignmentCrewId);
        return true;
      })
      .map(assignment => ({
        id: assignment.crewId,
        name:
          typeof crewService !== "undefined" &&
          typeof crewService.getDisplayName === "function"
            ? crewService.getDisplayName(
                assignment.crewId
              )
            : "Crew Member",
        position:
          assignment.position || "Assigned"
      }));
  }

  function parseTime(timeValue) {
    const value = String(timeValue || "").trim();

    const twelveHourMatch = value.match(
      /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i
    );

    if (twelveHourMatch) {
      let hours = Number(twelveHourMatch[1]);
      const minutes = Number(twelveHourMatch[2]);
      const period =
        twelveHourMatch[3].toUpperCase();

      if (hours === 12) {
        hours = 0;
      }

      if (period === "PM") {
        hours += 12;
      }

      return {
        hours,
        minutes
      };
    }

    const twentyFourHourMatch = value.match(
      /^(\d{1,2}):(\d{2})$/
    );

    if (twentyFourHourMatch) {
      return {
        hours: Number(twentyFourHourMatch[1]),
        minutes: Number(twentyFourHourMatch[2])
      };
    }

    return null;
  }

  function formatTime(hours, minutes) {
    const normalizedHours =
      ((hours % 24) + 24) % 24;

    const period =
      normalizedHours >= 12 ? "PM" : "AM";

    const twelveHour =
      normalizedHours % 12 || 12;

    return `${twelveHour}:${String(minutes).padStart(
      2,
      "0"
    )} ${period}`;
  }

  function getArrivalRecommendation(
    game,
    minutesEarly = DEFAULT_ARRIVAL_MINUTES
  ) {
    const parsedTime = parseTime(game.time);

    if (!parsedTime) {
      return {
        minutesEarly,
        arrivalTime: "",
        text: `Arrive ${minutesEarly} minutes early`
      };
    }

    const gameMinutes =
      parsedTime.hours * 60 + parsedTime.minutes;

    const arrivalMinutes =
      gameMinutes - minutesEarly;

    const normalizedArrivalMinutes =
      ((arrivalMinutes % 1440) + 1440) % 1440;

    const arrivalHours = Math.floor(
      normalizedArrivalMinutes / 60
    );

    const arrivalMinuteValue =
      normalizedArrivalMinutes % 60;

    const arrivalTime = formatTime(
      arrivalHours,
      arrivalMinuteValue
    );

    return {
      minutesEarly,
      arrivalTime,
      text: `Arrive by ${arrivalTime}`
    };
  }

  function getStatusBadges(status) {
    return [
      {
        key: status,
        label: getStatusLabel(status)
      }
    ];
  }

  function getGameDayStatus(status) {
    const statuses = {
      assigned: {
        key: "assigned",
        title: "Ready for game day",
        detail: "No action needed.",
        requiresAttention: false
      },

      pending_approval: {
        key: "pending_approval",
        title: "Waiting for approval",
        detail: "Your claim has been submitted.",
        requiresAttention: false
      },

      locked: {
        key: "locked",
        title: "Assignment confirmed",
        detail: "Everything is finalized.",
        requiresAttention: false
      },

      open_for_claim: {
        key: "open_for_claim",
        title: "Assignment not confirmed",
        detail: "This assignment is still open for claim.",
        requiresAttention: true
      },

      needs_assignment: {
        key: "needs_assignment",
        title: "Assignment incomplete",
        detail: "Contact your assigner if this looks incorrect.",
        requiresAttention: true
      }
    };

    return statuses[status] || {
      key: "unknown",
      title: "Check assignment",
      detail: "Review the assignment details before game day.",
      requiresAttention: true
    };
  }

  function mapGame(game, crewId) {
    const crewAssignments =
      getCrewAssignments(game, crewId);

    const status =
      getStatus(game, crewAssignments);

    const positions =
      getPositions(crewAssignments);

    return {
      id: game.id,
      date: game.date,
      time: game.time,
      field: game.field,
      level: game.level,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      matchup:
        `${game.awayTeam} @ ${game.homeTeam}`,
      position: positions.join(", "),
      positions,
      partners: getPartners(game, crewId),
      assignmentStatus: status,
      assignmentStatusLabel:
        getStatusLabel(status),
      arrivalRecommendation:
        getArrivalRecommendation(game),
      statusBadges:
        getStatusBadges(status),
      gameDayStatus:
        getGameDayStatus(status)
    };
  }

  function sortByDateTime(a, b) {
    return `${a.date} ${a.time}`.localeCompare(
      `${b.date} ${b.time}`
    );
  }

  function getMyPendingClaims() {
    const account = getCurrentAccount();

    if (!account || !account.crewId) {
      return [];
    }

    return gameService
      .getAll()
      .flatMap(game =>
        (game.assignments || [])
          .filter(
            assignment =>
              assignment.status ===
                AssignmentStatus.PENDING_APPROVAL &&
              assignment.claimedBy ===
                account.crewId
          )
          .map(assignment => ({
            game,
            assignment
          }))
      );
  }

  return {
    getCurrentAccount,
    getMySchedule,
    getClaimableGames,
    claimGame,
    getMyPendingClaims,
    getArrivalRecommendation
  };
})();
