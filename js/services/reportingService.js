// js/services/reportingService.js

const reportingService = (() => {
  function toPercentage(value, total) {
    if (!total) {
      return 0;
    }

    return Math.round(
      (Number(value || 0) / Number(total)) * 100
    );
  }

  function getReportableGames() {
    const games =
      typeof assignmentService.normalizeAllGames ===
      "function"
        ? assignmentService.normalizeAllGames()
        : gameService.getAll();

    return Array.isArray(games)
      ? games.filter(game =>
          typeof gameService.getStatus !== "function" ||
          gameService.getStatus(game) !== "cancelled"
        )
      : [];
  }

  function normalizeReportFilters(filters = {}) {
    return {
      startDate: String(
        filters.startDate || ""
      ),
      endDate: String(
        filters.endDate || ""
      ),
      status: String(
        filters.status || ""
      ).toLowerCase(),
      crewId: String(
        filters.crewId || ""
      ),
      level: String(
        filters.level || ""
      ).toLowerCase(),
      field: String(
        filters.field || ""
      ).toLowerCase()
    };
  }

  function matchesReportDate(
    date,
    filters
  ) {
    const value = String(date || "");

    if (
      filters.startDate &&
      value < filters.startDate
    ) {
      return false;
    }

    if (
      filters.endDate &&
      value > filters.endDate
    ) {
      return false;
    }

    return true;
  }

  function matchesReportValue(
    value,
    expected
  ) {
    if (!expected) {
      return true;
    }

    return (
      String(value || "").toLowerCase() ===
      expected
    );
  }

  function getCommunicationPreferencesReport() {
    const summary =
      dashboardService
        .getCommunicationPreferencesSummary();

    return {
      notificationsEnabled:
        summary.enabledCount,
      notificationsDisabled:
        summary.disabledCount,
      enabledCount:
        summary.enabledCount,
      disabledCount:
        summary.disabledCount
    };
  }

  function getAssignmentReport(filters = {}) {
    const rows =
      getAssignmentDetails(filters);

    const assigned =
      rows.filter(
        row => row.assignedCount > 0
      ).length;

    const fullyStaffed =
      rows.filter(
        row =>
          row.status === "Fully Staffed"
      ).length;

    return {
      totalGames: rows.length,
      assigned,
      openAssignments:
        rows.reduce(
          (total, row) =>
            total + row.openAssignments,
          0
        ),
      pendingClaims:
        rows.reduce(
          (total, row) =>
            total + row.pendingClaims,
          0
        ),
      fullyStaffed,
      assignmentRate:
        toPercentage(
          fullyStaffed,
          rows.length
        )
    };
  }

  function readAvailabilityCount(
    summary,
    status
  ) {
    if (!summary) {
      return 0;
    }

    if (
      summary.counts &&
      Number.isFinite(
        Number(summary.counts[status])
      )
    ) {
      return Number(summary.counts[status]);
    }

    if (
      Number.isFinite(
        Number(summary[status])
      )
    ) {
      return Number(summary[status]);
    }

    if (Array.isArray(summary.records)) {
      return summary.records.filter(
        record =>
          String(
            record.status || "no-response"
          ) === status
      ).length;
    }

    return 0;
  }

  function getAvailabilityReport(filters = {}) {
    return getAvailabilityDetails(filters)
      .reduce(
        (report, row) => {
          const key =
            row.status === "no-response"
              ? "noResponse"
              : row.status;

          if (
            Object.prototype
              .hasOwnProperty.call(
                report,
                key
              )
          ) {
            report[key] += 1;
          }

          return report;
        },
        {
          available: 0,
          unavailable: 0,
          maybe: 0,
          noResponse: 0
        }
      );
  }

  function getReviewReport(filters = {}) {
    const rows =
      getReviewDetails(filters);

    const submitted =
      rows.filter(
        row => row.status === "submitted"
      ).length;

    const returned =
      rows.filter(
        row => row.status === "returned"
      ).length;

    const approved =
      rows.filter(
        row => row.status === "approved"
      ).length;

    const total =
      submitted + returned + approved;

    return {
      submitted,
      returned,
      approved,
      completionPercentage:
        toPercentage(approved, total)
    };
  }

  function getAssignmentDetails(filters = {}) {
    const normalizedFilters =
      normalizeReportFilters(filters);

    return dashboardService
      .getUpcomingGames()
      .map(game => {
        const assignmentCount =
          Number(
            game.assignmentCount || 0
          );

        const openAssignments =
          Number(
            game.openAssignmentCount || 0
          );

        const pendingClaims =
          Number(
            game.pendingClaimCount || 0
          );

        const assignedCount =
          Math.max(
            assignmentCount -
              openAssignments -
              pendingClaims,
            0
          );

        return {
          gameId: game.id,
          date: game.date || "",
          time: game.time || "",
          matchup: game.matchup || "",
          field: game.field || "",
          level: game.level || "",
          assignmentCount,
          assignedCount,
          openAssignments,
          pendingClaims,
          status: game.fullyStaffed
            ? "Fully Staffed"
            : assignedCount > 0
              ? "Partially Staffed"
              : "Open"
        };
      })
      .filter(row =>
        matchesReportDate(
          row.date,
          normalizedFilters
        ) &&
        matchesReportValue(
          row.status,
          normalizedFilters.status
        ) &&
        matchesReportValue(
          row.level,
          normalizedFilters.level
        ) &&
        matchesReportValue(
          row.field,
          normalizedFilters.field
        )
      )
      .sort((a, b) => {
        if (a.date !== b.date) {
          return a.date.localeCompare(
            b.date
          );
        }

        if (a.time !== b.time) {
          return a.time.localeCompare(
            b.time
          );
        }

        return a.matchup.localeCompare(
          b.matchup
        );
      });
  }

  function getAvailabilityDetails(filters = {}) {
    const normalizedFilters =
      normalizeReportFilters(filters);

    return crewService
      .getAll()
      .filter(
        member => member.active !== false
      )
      .flatMap(member => {
        const entries =
          availabilityService
            .getCrewAvailability(member.id);

        return entries.map(entry => ({
          crewId: member.id,
          crewName:
            crewService.getDisplayName(
              member.id
            ),
          date: entry.date || "",
          status:
            entry.status || "no-response"
        }));
      })
      .filter(row =>
        matchesReportDate(
          row.date,
          normalizedFilters
        ) &&
        matchesReportValue(
          row.status,
          normalizedFilters.status
        ) &&
        (
          !normalizedFilters.crewId ||
          String(row.crewId) ===
            normalizedFilters.crewId
        )
      )
      .sort((a, b) => {
        if (a.date !== b.date) {
          return a.date.localeCompare(
            b.date
          );
        }

        return a.crewName.localeCompare(
          b.crewName
        );
      });
  }

  function getReviewDetails(filters = {}) {
    const normalizedFilters =
      normalizeReportFilters(filters);

    const groups = [
      {
        status: "submitted",
        label: "Submitted",
        games:
          reviewService.getSubmittedGames()
      },
      {
        status: "returned",
        label: "Returned",
        games:
          reviewService.getReturnedGames()
      },
      {
        status: "approved",
        label: "Approved",
        games:
          reviewService.getApprovedGames()
      }
    ];

    return groups
      .flatMap(group =>
        group.games.map(game => ({
          gameId: game.id,
          date: game.date || "",
          matchup:
            `${game.awayTeam || "Away"} @ ${
              game.homeTeam || "Home"
            }`,
          field: game.field || "",
          level: game.level || "",
          status: group.status,
          statusLabel: group.label,
          submittedAt:
            game.review?.submittedAt || "",
          reviewedAt:
            game.review?.reviewedAt ||
            game.review?.approvedAt ||
            game.review?.returnedAt ||
            ""
        }))
      )
      .filter(row =>
        matchesReportDate(
          row.date,
          normalizedFilters
        ) &&
        matchesReportValue(
          row.status,
          normalizedFilters.status
        ) &&
        matchesReportValue(
          row.level,
          normalizedFilters.level
        ) &&
        matchesReportValue(
          row.field,
          normalizedFilters.field
        )
      )
      .sort((a, b) => {
        if (a.date !== b.date) {
          return a.date.localeCompare(
            b.date
          );
        }

        return a.matchup.localeCompare(
          b.matchup
        );
      });
  }

  return {
    getAssignmentReport,
    getCommunicationPreferencesReport,
    getAvailabilityReport,
    getReviewReport,
    getAssignmentDetails,
    getAvailabilityDetails,
    getReviewDetails
  };
})();
