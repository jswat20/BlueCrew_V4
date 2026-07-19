// js/services/availabilityService.js

const availabilityService = (() => {
  const MAX_GAMES_PER_DAY = 2;

  const STATUS = Object.freeze({
    AVAILABLE: "available",
    UNAVAILABLE: "unavailable",
    MAYBE: "maybe"
  });

  const VALID_STATUSES = new Set(Object.values(STATUS));

  /*
   * Assignment evaluation
   *
   * These methods preserve the existing availabilityService API.
   * Date-based availability will influence evaluation in a later phase.
   */

  function evaluate(crewId, game, position = "Plate") {
    const crew = crewService.getById(crewId);

    const result = {
      crewId,
      gameId: game?.id || "",
      position,
      active: true,
      eligible: true,
      available: true,
      conflict: false,
      workload: 0,
      score: 100,
      reasons: []
    };

    if (!crew) {
      result.active = false;
      result.eligible = false;
      result.available = false;
      result.score = 0;
      result.reasons.push("Crew member not found.");
      return result;
    }

    if (crew.active === false) {
      result.active = false;
      result.eligible = false;
      result.available = false;
      result.score -= 60;
      result.reasons.push("Crew member is inactive.");
    }

    if (hasConflict(crewId, game)) {
      result.conflict = true;
      result.available = false;
      result.score -= 50;
      result.reasons.push("Already assigned to another game at this time.");
    }

    result.workload = getDailyWorkload(crewId, game);

    if (result.workload >= MAX_GAMES_PER_DAY) {
      result.available = false;
      result.score -= 25;
      result.reasons.push("Maximum games reached for this day.");
    }

    if (!isEligible(crew, game)) {
      result.eligible = false;
      result.available = false;
      result.score -= 35;
      result.reasons.push("Crew member is not eligible for this game level.");
    }

    result.score = Math.max(0, result.score);

    return result;
  }

  function canAssign(crewId, game, position = "Plate") {
    const result = evaluate(crewId, game, position);

    return {
      success: result.available && result.eligible && !result.conflict,
      message:
        result.reasons.length > 0
          ? result.reasons.join(" ")
          : "Crew member can be assigned.",
      data: result
    };
  }

  function isAvailable(crewId, game, position = "Plate") {
    return canAssign(crewId, game, position).success;
  }

  function getAvailabilityScore(crewId, game, position = "Plate") {
    return evaluate(crewId, game, position).score;
  }

  function hasConflict(crewId, game) {
    if (!crewId || !game) return false;

    if (
      typeof conflictService !== "undefined" &&
      typeof conflictService.hasConflict === "function"
    ) {
      return conflictService.hasConflict(crewId, game);
    }

    return gameService.getAll().some(otherGame => {
      if (String(otherGame.id) === String(game.id)) return false;

      const sameDate = otherGame.date === game.date;
      const sameTime = otherGame.time === game.time;

      if (!sameDate || !sameTime) return false;

      if (String(otherGame.crewId) === String(crewId)) {
        return true;
      }

      if (Array.isArray(otherGame.assignments)) {
        return otherGame.assignments.some(
          assignment => String(assignment.crewId) === String(crewId)
        );
      }

      return false;
    });
  }

  function getDailyWorkload(crewId, game) {
    if (!crewId || !game) return 0;

    if (
      typeof workloadService !== "undefined" &&
      typeof workloadService.getDailyWorkload === "function"
    ) {
      return workloadService.getDailyWorkload(crewId, game.date);
    }

    return gameService.getAll().filter(otherGame => {
      if (otherGame.date !== game.date) return false;

      if (String(otherGame.crewId) === String(crewId)) {
        return true;
      }

      if (Array.isArray(otherGame.assignments)) {
        return otherGame.assignments.some(
          assignment => String(assignment.crewId) === String(crewId)
        );
      }

      return false;
    }).length;
  }

  function isEligible(crew, game) {
    if (!crew || !game) return false;

    if (
      typeof recommendationService !== "undefined" &&
      typeof recommendationService.isCrewEligibleForGame === "function"
    ) {
      return recommendationService.isCrewEligibleForGame(crew.id, game);
    }

    if (!crew.levels || !game.level) {
      return true;
    }

    return crew.levels.includes(game.level);
  }

  /*
   * Date-based availability
   */

  function setAvailability({ crewId, date, status, startTime = "", endTime = "", windowId = "" } = {}) {
    const member = crewService.getById(crewId);
    const normalizedDate = normalizeDate(date);
    const normalizedStatus = normalizeStatus(status);

    if (!member || !normalizedDate || !normalizedStatus) {
      return null;
    }

    const normalizedStartTime = normalizeTime(startTime);
    const normalizedEndTime = normalizeTime(endTime);
    if ((startTime || endTime) && (!normalizedStartTime || !normalizedEndTime || normalizedStartTime >= normalizedEndTime)) return null;

    if (normalizedStartTime && normalizedEndTime) {
      const windows = ensureAvailabilityWindows(member);
      const existingIndex = windows.findIndex(item => windowId ? String(item.id) === String(windowId) : item.date === normalizedDate && item.startTime === normalizedStartTime && item.endTime === normalizedEndTime);
      const record = { id: existingIndex >= 0 ? windows[existingIndex].id : `availability-${Date.now()}-${Math.random().toString(16).slice(2)}`, date: normalizedDate, startTime: normalizedStartTime, endTime: normalizedEndTime, status: normalizedStatus };
      if (existingIndex >= 0) windows[existingIndex] = record; else windows.push(record);
      persistCrew();
      return { crewId: member.id, ...record };
    }

    const availability = ensureDateAvailability(member);

    availability[normalizedDate] = normalizedStatus;

    persistCrew();

    return {
      crewId: member.id,
      date: normalizedDate,
      status: normalizedStatus
    };
  }

  function getAvailability(crewId, date, time = "") {
    const member = crewService.getById(crewId);
    const normalizedDate = normalizeDate(date);

    if (!member || !normalizedDate) {
      return null;
    }

    const windows = getAvailabilityWindows(member).filter(item => item.date === normalizedDate);
    if (windows.length) {
      const normalizedTime = normalizeTime(time);
      if (normalizedTime) {
        const match = windows.find(item => normalizedTime >= item.startTime && normalizedTime < item.endTime);
        return match?.status || STATUS.UNAVAILABLE;
      }
      if (windows.some(item => item.status === STATUS.AVAILABLE)) return STATUS.AVAILABLE;
      if (windows.some(item => item.status === STATUS.MAYBE)) return STATUS.MAYBE;
      return STATUS.UNAVAILABLE;
    }

    const availability = getDateAvailability(member);

    return availability[normalizedDate] || STATUS.AVAILABLE;
  }

  function clearAvailability(crewId, date) {
    const member = crewService.getById(crewId);
    const normalizedDate = normalizeDate(date);

    if (!member || !normalizedDate) {
      return false;
    }

    const availability = getDateAvailability(member);

    const hadDay = Object.prototype.hasOwnProperty.call(availability, normalizedDate);
    if (hadDay) delete availability[normalizedDate];
    const windows = ensureAvailabilityWindows(member);
    const remainingWindows = windows.filter(item => item.date !== normalizedDate);
    const hadWindows = remainingWindows.length !== windows.length;
    member.availabilityTimeWindows = remainingWindows;
    if (!hadDay && !hadWindows) return false;

    persistCrew();

    return true;
  }

  function getCrewAvailability(crewId) {
    const member = crewService.getById(crewId);

    if (!member) {
      return [];
    }

    const availability = getDateAvailability(member);

    const dayEntries = Object.entries(availability)
      .filter(([date, status]) => {
        return !!normalizeDate(date) && VALID_STATUSES.has(status);
      })
      .map(([date, status]) => ({
        crewId: member.id,
        date,
        status
      }))
    const windowEntries = getAvailabilityWindows(member).map(item => ({ crewId: member.id, ...item }));
    return [...dayEntries, ...windowEntries].sort((left, right) => left.date.localeCompare(right.date) || String(left.startTime || "").localeCompare(String(right.startTime || "")));
  }

  function getAvailableCrew(date) {
    const normalizedDate = normalizeDate(date);

    if (!normalizedDate) {
      return [];
    }

    return crewService.getAll().filter(member => {
      return getAvailability(member.id, normalizedDate) === STATUS.AVAILABLE;
    });
  }

  function getUnavailableCrew(date) {
    const normalizedDate = normalizeDate(date);

    if (!normalizedDate) {
      return [];
    }

    return crewService.getAll().filter(member => {
      return getAvailability(member.id, normalizedDate) === STATUS.UNAVAILABLE;
    });
  }

  function addDays(date, dayCount) {
    const normalizedDate = normalizeDate(date);

    if (!normalizedDate) {
      return null;
    }

    const value =
      new Date(`${normalizedDate}T00:00:00Z`);

    value.setUTCDate(
      value.getUTCDate() + Number(dayCount || 0)
    );

    return value.toISOString().slice(0, 10);
  }

  function getDateRange(startDate, endDate) {
    const normalizedStart =
      normalizeDate(startDate);

    const normalizedEnd =
      normalizeDate(endDate);

    if (
      !normalizedStart ||
      !normalizedEnd ||
      normalizedStart > normalizedEnd
    ) {
      return [];
    }

    const dates = [];
    let currentDate = normalizedStart;

    while (currentDate <= normalizedEnd) {
      dates.push(currentDate);
      currentDate = addDays(currentDate, 1);
    }

    return dates;
  }

  function setAvailabilityRange({
    crewId,
    startDate,
    endDate,
    status
  } = {}) {
    const member = crewService.getById(crewId);
    const normalizedStatus =
      normalizeStatus(status);

    const dates =
      getDateRange(startDate, endDate);

    if (!member) {
      return {
        success: false,
        message: "Crew member not found.",
        data: null
      };
    }

    if (!normalizedStatus) {
      return {
        success: false,
        message:
          "Enter a valid availability status.",
        data: null
      };
    }

    if (!dates.length) {
      return {
        success: false,
        message:
          "Enter a valid availability date range.",
        data: null
      };
    }

    const availability =
      ensureDateAvailability(member);

    dates.forEach(date => {
      availability[date] = normalizedStatus;
    });

    persistCrew();

    return {
      success: true,
      message:
        `Availability updated for ${dates.length} ${
          dates.length === 1 ? "day" : "days"
        }.`,
      data: {
        crewId: member.id,
        startDate: dates[0],
        endDate: dates[dates.length - 1],
        status: normalizedStatus,
        dates: dates.map(date => ({
          date,
          status: normalizedStatus
        }))
      }
    };
  }

  function copyAvailabilityWeek({
    crewId,
    sourceStartDate,
    targetStartDate
  } = {}) {
    const member = crewService.getById(crewId);

    const normalizedSource =
      normalizeDate(sourceStartDate);

    const normalizedTarget =
      normalizeDate(targetStartDate);

    if (!member) {
      return {
        success: false,
        message: "Crew member not found.",
        data: null
      };
    }

    if (
      !normalizedSource ||
      !normalizedTarget
    ) {
      return {
        success: false,
        message:
          "Enter valid source and target week dates.",
        data: null
      };
    }

    const copiedDates = [];

    for (let index = 0; index < 7; index += 1) {
      const sourceDate =
        addDays(normalizedSource, index);

      const targetDate =
        addDays(normalizedTarget, index);

      const status =
        getAvailability(
          member.id,
          sourceDate
        );

      copiedDates.push({
        sourceDate,
        targetDate,
        status
      });
    }

    const availability =
      ensureDateAvailability(member);

    copiedDates.forEach(item => {
      availability[item.targetDate] =
        item.status;
    });

    persistCrew();

    return {
      success: true,
      message: "Availability week copied.",
      data: {
        crewId: member.id,
        sourceStartDate: normalizedSource,
        sourceEndDate:
          addDays(normalizedSource, 6),
        targetStartDate: normalizedTarget,
        targetEndDate:
          addDays(normalizedTarget, 6),
        dates: copiedDates
      }
    };
  }

  function getGameAssignments(game) {
    if (
      typeof assignmentService !== "undefined" &&
      typeof assignmentService.getAssignments ===
        "function"
    ) {
      return assignmentService.getAssignments(game);
    }

    return Array.isArray(game?.assignments)
      ? game.assignments
      : [];
  }

  function isCrewAssignedToGame(
    crewId,
    game
  ) {
    if (!crewId || !game) {
      return false;
    }

    if (
      String(game.crewId || "") ===
      String(crewId)
    ) {
      return true;
    }

    return getGameAssignments(game).some(
      assignment =>
        String(assignment.crewId || "") ===
        String(crewId)
    );
  }

  function getAssignmentsOnDate(
    crewId,
    date
  ) {
    const member = crewService.getById(crewId);
    const normalizedDate = normalizeDate(date);

    if (!member || !normalizedDate) {
      return [];
    }

    return gameService
      .getAll()
      .filter(game => {
        if (game.date !== normalizedDate) {
          return false;
        }

        if (
          typeof gameService.getStatus ===
            "function" &&
          gameService.getStatus(game) ===
            "cancelled"
        ) {
          return false;
        }

        return isCrewAssignedToGame(
          member.id,
          game
        );
      });
  }

  function hasAssignmentOnDate(
    crewId,
    date
  ) {
    return (
      getAssignmentsOnDate(
        crewId,
        date
      ).length > 0
    );
  }

  function getAvailabilitySummary(
    crewId,
    options = {}
  ) {
    const member = crewService.getById(crewId);

    if (!member) {
      return null;
    }

    const startDate =
      normalizeDate(options.startDate);

    const endDate =
      normalizeDate(options.endDate);

    let dates = [];

    if (startDate || endDate) {
      if (!startDate || !endDate) {
        return null;
      }

      dates = getDateRange(
        startDate,
        endDate
      );

      if (!dates.length) {
        return null;
      }
    } else {
      dates = getCrewAvailability(
        member.id
      ).map(item => item.date);
    }

    const records = dates.map(date => {
      const status =
        getAvailability(member.id, date);

      const assignments =
        getAssignmentsOnDate(
          member.id,
          date
        );

      return {
        date,
        status,
        assigned: assignments.length > 0,
        assignmentCount:
          assignments.length
      };
    });

    const counts = {
      available: 0,
      unavailable: 0,
      maybe: 0,
      assigned: 0
    };

    records.forEach(record => {
      counts[record.status] += 1;

      if (record.assigned) {
        counts.assigned += 1;
      }
    });

    const nextUnavailable =
      records.find(
        record =>
          record.status ===
          STATUS.UNAVAILABLE
      ) || null;

    return {
      crewId: member.id,
      startDate:
        records[0]?.date || null,
      endDate:
        records[records.length - 1]?.date ||
        null,
      total: records.length,
      counts,
      nextUnavailableDate:
        nextUnavailable?.date || null,
      records
    };
  }

  function normalizeStatus(status) {
    const normalizedStatus = String(status || "")
      .trim()
      .toLowerCase();

    return VALID_STATUSES.has(normalizedStatus)
      ? normalizedStatus
      : null;
  }

  function clearAvailabilityWindow(crewId, windowId) {
    const member = crewService.getById(crewId);
    if (!member || !windowId) return false;
    const windows = ensureAvailabilityWindows(member);
    const remaining = windows.filter(item => String(item.id) !== String(windowId));
    if (remaining.length === windows.length) return false;
    member.availabilityTimeWindows = remaining;
    persistCrew();
    return true;
  }

  function normalizeTime(time) {
    const value = String(time || "").trim();
    if (!value) return null;
    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return value;
    const match = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return null;
    let hour = Number(match[1]) % 12;
    if (match[3].toUpperCase() === "PM") hour += 12;
    return `${String(hour).padStart(2, "0")}:${match[2]}`;
  }

  function normalizeDate(date) {
    const normalizedDate = String(date || "").trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
      return null;
    }

    const parsedDate = new Date(`${normalizedDate}T00:00:00Z`);

    if (Number.isNaN(parsedDate.getTime())) {
      return null;
    }

    if (parsedDate.toISOString().slice(0, 10) !== normalizedDate) {
      return null;
    }

    return normalizedDate;
  }

  function getDateAvailability(member) {
    if (
      !member ||
      !member.dateAvailability ||
      typeof member.dateAvailability !== "object" ||
      Array.isArray(member.dateAvailability)
    ) {
      return {};
    }

    return member.dateAvailability;
  }

  function ensureDateAvailability(member) {
    if (
      !member.dateAvailability ||
      typeof member.dateAvailability !== "object" ||
      Array.isArray(member.dateAvailability)
    ) {
      member.dateAvailability = {};
    }

    return member.dateAvailability;
  }

  function getAvailabilityWindows(member) {
    return Array.isArray(member?.availabilityTimeWindows) ? member.availabilityTimeWindows : [];
  }

  function ensureAvailabilityWindows(member) {
    if (!Array.isArray(member.availabilityTimeWindows)) member.availabilityTimeWindows = [];
    return member.availabilityTimeWindows;
  }

  function persistCrew() {
    if (typeof saveCrew === "function") {
      saveCrew();
    }
  }

  return {
    STATUS,

    evaluate,
    canAssign,
    isAvailable,
    getAvailabilityScore,

    setAvailability,
    setAvailabilityRange,
    copyAvailabilityWeek,
    getAvailability,
    clearAvailability,
    clearAvailabilityWindow,
    getCrewAvailability,
    getAvailabilitySummary,
    getAssignmentsOnDate,
    hasAssignmentOnDate,
    getAvailableCrew,
    getUnavailableCrew
  };
})();
