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

  function getGameHub(gameId) {
    const account = getCurrentAccount();

    if (!account || !account.crewId) {
      return null;
    }

    const game = gameService
      .getAll()
      .find(
        candidate =>
          String(candidate.id) === String(gameId)
      );

    if (
      !game ||
      !isGameAssignedToCrew(game, account.crewId)
    ) {
      return null;
    }

    return mapGame(game, account.crewId);
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

  function getGameDayChecklist({
    status,
    position,
    arrivalRecommendation
  }) {
    const assignmentConfirmed =
      status === "assigned" ||
      status === "locked";

    return [
      {
        key: "uniform",
        label: "Uniform ready",
        detail:
          "Bring your umpire shirt, hat, belt, and game shoes.",
        status: "reminder"
      },
      {
        key: "equipment",
        label: "Equipment packed",
        detail:
          position.includes("Plate")
            ? "Bring your indicator and plate protective gear."
            : "Bring your indicator and field equipment.",
        status: "reminder"
      },
      {
        key: "arrival",
        label: arrivalRecommendation.text,
        detail:
          `Plan to arrive ${arrivalRecommendation.minutesEarly} minutes before game time.`,
        status: "scheduled"
      },
      {
        key: "assignment",
        label: assignmentConfirmed
          ? "Assignment confirmed"
          : "Review assignment",
        detail: assignmentConfirmed
          ? `You are working ${position}.`
          : "Check your assignment status before leaving.",
        status: assignmentConfirmed
          ? "complete"
          : "attention"
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



  function getGameReports(gameId) {
    const game = gameService.getById(gameId);

    const reports =
      game &&
      game.reports &&
      typeof game.reports === "object"
        ? game.reports
        : {};

    return {
      incidents:
        reports.incidents === true,
      ejections:
        reports.ejections === true,
      protests:
        reports.protests === true,
      rainout:
        reports.rainout === true,
      notes:
        reports.notes === null ||
        reports.notes === undefined
          ? ""
          : String(reports.notes)
    };
  }

  function saveGameReports(
    gameId,
    reports = {}
  ) {
    const account = getCurrentAccount();

    if (!account || !account.crewId) {
      return {
        success: false,
        message: "No logged in umpire."
      };
    }

    const game = gameService.getById(gameId);

    if (!game) {
      return {
        success: false,
        message: "Game not found."
      };
    }

    if (
      !isGameAssignedToCrew(
        game,
        account.crewId
      )
    ) {
      return {
        success: false,
        message:
          "You are not assigned to this game."
      };
    }

    if (game.completed !== true) {
      return {
        success: false,
        message:
          "Complete the game before saving reports."
      };
    }

    const normalizedReports = {
      incidents:
        reports.incidents === true,
      ejections:
        reports.ejections === true,
      protests:
        reports.protests === true,
      rainout:
        reports.rainout === true,
      notes:
        reports.notes === null ||
        reports.notes === undefined
          ? ""
          : String(reports.notes).trim()
    };

    const result = gameService.update(
      gameId,
      {
        reports: normalizedReports
      }
    );

    if (!result.success) {
      return result;
    }

    return {
      success: true,
      message: "Game reports saved.",
      data: getGameReports(gameId)
    };
  }

  function getGameCompletion(gameId) {
    const game = gameService.getById(gameId);

    if (!game) {
      return {
        completed: false,
        completionTime: null,
        completedBy: "",
        completionStatus: "incomplete",
        homeScore: null,
        awayScore: null,
        reports: getGameReports(gameId)
      };
    }

    return {
      completed: game.completed === true,
      completionTime:
        game.completionTime || null,
      completedBy:
        game.completedBy || "",
      completionStatus:
        game.completionStatus ||
        (game.completed === true
          ? "completed"
          : "incomplete"),
      homeScore:
        game.homeScore === null ||
        game.homeScore === undefined
          ? null
          : Number(game.homeScore),
      awayScore:
        game.awayScore === null ||
        game.awayScore === undefined
          ? null
          : Number(game.awayScore),
      reports: getGameReports(gameId)
    };
  }

  function getCompletionAccountName(account) {
    if (!account) {
      return "";
    }

    const fullName = [
      account.firstName,
      account.lastName
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    return (
      fullName ||
      account.name ||
      account.email ||
      "Umpire"
    );
  }

  function completeGame(gameId) {
    const account = getCurrentAccount();

    if (!account || !account.crewId) {
      return {
        success: false,
        message: "No logged in umpire."
      };
    }

    const game = gameService.getById(gameId);

    if (!game) {
      return {
        success: false,
        message: "Game not found."
      };
    }

    if (
      !isGameAssignedToCrew(
        game,
        account.crewId
      )
    ) {
      return {
        success: false,
        message:
          "You are not assigned to this game."
      };
    }

    if (game.completed === true) {
      return {
        success: true,
        message: "Game already completed.",
        data: getGameCompletion(gameId)
      };
    }

    const completionTime =
      new Date().toISOString();

    const completedBy =
      getCompletionAccountName(account);

    const result = gameService.update(
      gameId,
      {
        completed: true,
        completionTime,
        completedBy,
        completionStatus: "completed"
      }
    );

    if (!result.success) {
      return result;
    }

    return {
      success: true,
      message: "Game completed.",
      data: getGameCompletion(gameId)
    };
  }


  function saveGameScore(
    gameId,
    homeScore,
    awayScore
  ) {
    const account = getCurrentAccount();

    if (!account || !account.crewId) {
      return {
        success: false,
        message: "No logged in umpire."
      };
    }

    const game = gameService.getById(gameId);

    if (!game) {
      return {
        success: false,
        message: "Game not found."
      };
    }

    if (
      !isGameAssignedToCrew(
        game,
        account.crewId
      )
    ) {
      return {
        success: false,
        message:
          "You are not assigned to this game."
      };
    }

    if (game.completed !== true) {
      return {
        success: false,
        message:
          "Complete the game before saving a score."
      };
    }

    const normalizedHomeScore =
      Number(homeScore);

    const normalizedAwayScore =
      Number(awayScore);

    if (
      !Number.isFinite(normalizedHomeScore) ||
      !Number.isFinite(normalizedAwayScore)
    ) {
      return {
        success: false,
        message:
          "Enter a numeric score for both teams."
      };
    }

    const result = gameService.update(
      gameId,
      {
        homeScore: normalizedHomeScore,
        awayScore: normalizedAwayScore
      }
    );

    if (!result.success) {
      return result;
    }

    return {
      success: true,
      message: "Final score saved.",
      data: getGameCompletion(gameId)
    };
  }

  function normalizeOptionalValue(value) {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value).trim();
  }

  function getGameInformation(game) {
    return {
      field: normalizeOptionalValue(game.field),
      venue: normalizeOptionalValue(game.venue),
      address: normalizeOptionalValue(game.address),
      notes: normalizeOptionalValue(
        game.notes || game.gameNotes
      ),
      specialInstructions: normalizeOptionalValue(
        game.specialInstructions ||
        game.instructions
      )
    };
  }

  function getCrewMember(crewId) {
    if (
      typeof crewService === "undefined" ||
      typeof crewService.getAll !== "function"
    ) {
      return null;
    }

    return crewService
      .getAll()
      .find(
        member =>
          String(member.id) === String(crewId)
      ) || null;
  }

  function getContactDetails(source = {}) {
    return {
      phone: normalizeOptionalValue(
        source.phone ||
        source.phoneNumber ||
        source.mobile
      ),
      email: normalizeOptionalValue(
        source.email ||
        source.emailAddress
      )
    };
  }

  function hasContactDetails(contact) {
    return Boolean(
      contact.phone ||
      contact.email
    );
  }

  function getGameDayContacts(game, crewId) {
    const configuredContact =
      game.contact &&
      typeof game.contact === "object"
        ? game.contact
        : {};

    const primaryDetails =
      getContactDetails({
        phone:
          configuredContact.phone ||
          game.contactPhone ||
          game.assignerPhone,
        email:
          configuredContact.email ||
          game.contactEmail ||
          game.assignerEmail
      });

    const primaryName =
      normalizeOptionalValue(
        configuredContact.name ||
        game.contactName ||
        game.assignerName
      );

    const primaryContact =
      hasContactDetails(primaryDetails)
        ? {
            name:
              primaryName ||
              "Game Contact",
            role: normalizeOptionalValue(
              configuredContact.role ||
              game.contactRole ||
              "Game Contact"
            ),
            ...primaryDetails
          }
        : null;

    const partners = getPartners(
      game,
      crewId
    )
      .map(partner => {
        const member =
          getCrewMember(partner.id);

        const contact =
          getContactDetails(
            member || {}
          );

        if (!hasContactDetails(contact)) {
          return null;
        }

        return {
          id: partner.id,
          name: partner.name,
          role: partner.position,
          ...contact
        };
      })
      .filter(Boolean);

    return {
      primaryContact,
      partners
    };
  }

  function getGameConditions(game) {
    const conditions =
      game.conditions &&
      typeof game.conditions === "object"
        ? game.conditions
        : {};

    return {
      summary: normalizeOptionalValue(
        conditions.summary ||
        game.weatherSummary
      ),
      temperature: normalizeOptionalValue(
        conditions.temperature ||
        game.temperature
      ),
      weatherAdvisory: normalizeOptionalValue(
        conditions.weatherAdvisory ||
        conditions.rainAdvisory ||
        game.weatherAdvisory ||
        game.rainAdvisory
      ),
      fieldStatus: normalizeOptionalValue(
        conditions.fieldStatus ||
        game.fieldStatus
      ),
      cancellationNotice: normalizeOptionalValue(
        conditions.cancellationNotice ||
        game.cancellationNotice
      ),
      advisory: normalizeOptionalValue(
        conditions.advisory ||
        game.gameDayAdvisory
      )
    };
  }

  function getGameDayTimeline({
    game,
    position,
    partners,
    arrivalRecommendation,
    gameInformation
  }) {
    const location =
      gameInformation.field ||
      gameInformation.venue;

    const partnerNames =
      partners
        .map(partner => partner.name)
        .filter(Boolean);

    const meetDetail =
      partnerNames.length
        ? `Meet ${partnerNames.join(", ")} at ${
            location || "the field"
          }.`
        : `Check in at ${
            location || "the field"
          }.`;

    const pregameDetail =
      position.includes("Plate")
        ? "Meet with the coaches, review ground rules, and confirm game balls."
        : "Meet with your crew and review coverage responsibilities.";

    return [
      {
        key: "prepare",
        phase: "Before leaving",
        title: "Complete your equipment check",
        detail:
          "Confirm your uniform, indicator, water, and game equipment are packed.",
        status: "upcoming"
      },
      {
        key: "arrival",
        phase: "Arrival",
        title: arrivalRecommendation.text,
        detail: location
          ? `Plan to be ready at ${location} ${arrivalRecommendation.minutesEarly} minutes before game time.`
          : `Plan to be ready ${arrivalRecommendation.minutesEarly} minutes before game time.`,
        status: "scheduled"
      },
      {
        key: "meet",
        phase: "At the field",
        title: "Meet your crew",
        detail: meetDetail,
        status: "upcoming"
      },
      {
        key: "pregame",
        phase: "Before first pitch",
        title: "Complete the pregame meeting",
        detail: pregameDetail,
        status: "upcoming"
      },
      {
        key: "game",
        phase: "During the game",
        title: `Work your ${position} assignment`,
        detail:
          "Stay focused, communicate clearly, and support your crew.",
        status: "upcoming"
      },
      {
        key: "postgame",
        phase: "After the game",
        title: "Finish game-day responsibilities",
        detail:
          "Confirm the final score, complete any required report, and check out with your crew.",
        status: "upcoming"
      }
    ];
  }

  function getCrewNotes(game, crewId) {
    const notesByCrew =
      game.crewNotesByCrewId &&
      typeof game.crewNotesByCrewId === "object"
        ? game.crewNotesByCrewId
        : {};

    return normalizeOptionalValue(
      notesByCrew[String(crewId)]
    );
  }

  function saveCrewNotes(gameId, notes) {
    const account = getCurrentAccount();

    if (!account || !account.crewId) {
      return {
        success: false,
        message: "No logged in umpire."
      };
    }

    const game = gameService.getById(gameId);

    if (
      !game ||
      !isGameAssignedToCrew(game, account.crewId)
    ) {
      return {
        success: false,
        message: "Game is not available."
      };
    }

    const crewNotesByCrewId = {
      ...(
        game.crewNotesByCrewId &&
        typeof game.crewNotesByCrewId === "object"
          ? game.crewNotesByCrewId
          : {}
      ),
      [String(account.crewId)]:
        normalizeOptionalValue(notes)
    };

    const result = gameService.update(
      game.id,
      {
        crewNotesByCrewId
      }
    );

    return {
      success: result.success,
      message: result.success
        ? "Crew notes saved."
        : result.message,
      notes:
        crewNotesByCrewId[
          String(account.crewId)
        ]
    };
  }

  function getChecklistState(game, crewId) {
    const stateByCrew =
      game.gameDayChecklistByCrewId &&
      typeof game.gameDayChecklistByCrewId === "object"
        ? game.gameDayChecklistByCrewId
        : {};

    const crewState =
      stateByCrew[String(crewId)];

    return (
      crewState &&
      typeof crewState === "object"
        ? crewState
        : {}
    );
  }

  function toggleChecklistItem(
    gameId,
    itemKey
  ) {
    const account = getCurrentAccount();

    if (!account || !account.crewId) {
      return {
        success: false,
        message: "No logged in umpire."
      };
    }

    const game = gameService.getById(gameId);

    if (
      !game ||
      !isGameAssignedToCrew(
        game,
        account.crewId
      )
    ) {
      return {
        success: false,
        message: "Game is not available."
      };
    }

    const crewAssignments =
      getCrewAssignments(
        game,
        account.crewId
      );

    const status =
      getStatus(
        game,
        crewAssignments
      );

    const positions =
      getPositions(crewAssignments);

    const arrivalRecommendation =
      getArrivalRecommendation(game);

    const checklist =
      getGameDayChecklist({
        status,
        position: positions.join(", "),
        arrivalRecommendation
      });

    const item = checklist.find(
      candidate =>
        candidate.key === itemKey
    );

    if (!item) {
      return {
        success: false,
        message: "Checklist item not found."
      };
    }

    const existingState =
      getChecklistState(
        game,
        account.crewId
      );

    const updatedCrewState = {
      ...existingState,
      [itemKey]:
        existingState[itemKey] !== true
    };

    const gameDayChecklistByCrewId = {
      ...(
        game.gameDayChecklistByCrewId &&
        typeof game.gameDayChecklistByCrewId ===
          "object"
          ? game.gameDayChecklistByCrewId
          : {}
      ),
      [String(account.crewId)]:
        updatedCrewState
    };

    const result = gameService.update(
      game.id,
      {
        gameDayChecklistByCrewId
      }
    );

    return {
      success: result.success,
      message: result.success
        ? "Checklist updated."
        : result.message,
      itemKey,
      completed:
        updatedCrewState[itemKey] === true
    };
  }

  function mapGame(game, crewId) {
    const crewAssignments =
      getCrewAssignments(game, crewId);

    const status =
      getStatus(game, crewAssignments);

    const positions =
      getPositions(crewAssignments);

    const arrivalRecommendation =
      getArrivalRecommendation(game);

    const gameInformation =
      getGameInformation(game);

    const gameDayContacts =
      getGameDayContacts(game, crewId);

    const gameConditions =
      getGameConditions(game);

    const partners =
      getPartners(game, crewId);

    const position =
      positions.join(", ");

    const gameDayTimeline =
      getGameDayTimeline({
        game,
        position,
        partners,
        arrivalRecommendation,
        gameInformation
      });

    const checklistState =
      getChecklistState(game, crewId);

    const gameDayChecklist =
      getGameDayChecklist({
        status,
        position,
        arrivalRecommendation
      }).map(item => ({
        ...item,
        completed:
          checklistState[item.key] === true
      }));

    return {
      completion: getGameCompletion(game.id),
      id: game.id,
      date: game.date,
      time: game.time,
      field: gameInformation.field,
      level: game.level,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      matchup:
        `${game.awayTeam} @ ${game.homeTeam}`,
      gameInformation,
      gameDayContacts,
      gameConditions,
      gameDayTimeline,
      position,
      positions,
      partners,
      assignmentStatus: status,
      assignmentStatusLabel:
        getStatusLabel(status),
      arrivalRecommendation,
      statusBadges:
        getStatusBadges(status),
      gameDayStatus:
        getGameDayStatus(status),
      crewNotes:
        getCrewNotes(game, crewId),
      gameDayChecklist
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
    getGameReports,
    saveGameReports,
    saveGameScore,
    getGameCompletion,
    completeGame,
    getCurrentAccount,
    getMySchedule,
    getGameHub,
    saveCrewNotes,
    toggleChecklistItem,
    getClaimableGames,
    claimGame,
    getMyPendingClaims,
    getArrivalRecommendation
  };
})();
