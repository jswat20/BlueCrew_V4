// ======================================================
// BlueCrew V2
// Conflict Service
// ======================================================

const conflictService = {

  getGames(date = null) {
    const games = gameService.getAll();

    return date
      ? games.filter(game => game.date === date)
      : games;
  },

  getGameTitle(game) {
    return `${game.awayTeam || "Away"} @ ${game.homeTeam || "Home"}`;
  },

  getGameMeta(game) {
    return {
      date: game.date || "",
      time: game.time || "",
      field: game.field || "",
      level: game.level || ""
    };
  },

  getDailyIssues(date) {
    return {
      openGames: this.getOpenAssignmentIssues(date),
      doubleBookings: this.getDoubleBookingIssues(date),
      overloadedCrew: this.getOverloadedCrewIssues(date),
      inactiveAssignments: this.getInactiveAssignmentIssues(date),
      eligibilityIssues: this.getEligibilityIssues(date)
    };
  },

  getDailyIssueCount(date) {
    const issues = this.getDailyIssues(date);

    return Object.values(issues)
      .reduce((count, list) => count + list.length, 0);
  },

  getOpenAssignmentIssues(date) {
    return this.getGames(date)
      .filter(game => !assignmentService.isAssigned(game))
      .sort(sortGames)
      .map(game => ({
        id: `open-${game.id}`,
        type: "open_assignment",
        severity: "medium",
        title: this.getGameTitle(game),
        message: "This game still needs a crew assignment.",
        gameId: game.id,
        crewId: null,
        meta: this.getGameMeta(game)
      }));
  },

  getDoubleBookingIssues(date) {

    const seen = {};
    const issues = [];

    this.getGames(date)
      .filter(game => assignmentService.isAssigned(game))
      .forEach(game => {

        const crewId = game.crewId;

        if (!crewId) return;

        const key =
          `${game.date}|${game.time}|${crewId}`;

        const member =
          crewService.getById(crewId);

        if (seen[key]) {

          issues.push({

            id:
              `double-${crewId}-${game.date}-${game.time}`,

            type: "double_booking",

            severity: "high",

            title:
              `${crewService.getName(member)} is double-booked`,

            message:
              "This crew member is assigned to more than one game at the same time.",

            gameId: game.id,

            crewId,

            meta: {
              date: game.date,
              time: game.time,
              games:
                `${this.getGameTitle(seen[key])} / ${this.getGameTitle(game)}`
            }

          });

        } else {

          seen[key] = game;

        }

      });

    return issues;
  },

  getOverloadedCrewIssues(date) {

    return crewService
      .getAll()

      .map(member => ({
        member,
        workload:
          workloadService.getCrewWorkloadForDate(
            member.id,
            date
          )
      }))

      .filter(item => item.workload.count >= 4)

      .map(item => ({

        id:
          `overloaded-${item.member.id}-${date}`,

        type: "overloaded_crew",

        severity: "medium",

        title:
          `${crewService.getName(item.member)} may be overloaded`,

        message:
          "This crew member has a heavy assignment load for the day.",

        gameId: null,

        crewId: item.member.id,

        meta: {
          assignments: item.workload.count,
          date
        }

      }));

  },

  getInactiveAssignmentIssues(date) {

    return this.getGames(date)

      .filter(game =>
        assignmentService.isAssigned(game)
      )

      .map(game => {

        const member =
          crewService.getById(game.crewId);

        if (!member || crewService.isActive(member)) {
          return null;
        }

        return {

          id:
            `inactive-${game.id}-${member.id}`,

          type:
            "inactive_assignment",

          severity: "high",

          title:
            `${crewService.getName(member)} is inactive`,

          message:
            "This game is assigned to an inactive crew member.",

          gameId: game.id,

          crewId: member.id,

          meta: this.getGameMeta(game)

        };

      })

      .filter(Boolean);

  },

  getEligibilityIssues(date) {

    return this.getGames(date)

      .filter(game =>
        assignmentService.isAssigned(game)
      )

      .map(game => {

        const member =
          crewService.getById(game.crewId);

        if (!member) return null;

        if (
          crewService.canWorkLevel(
            member,
            game.level
          )
        ) {
          return null;
        }

        return {

          id:
            `eligibility-${game.id}-${member.id}`,

          type:
            "eligibility_issue",

          severity: "high",

          title:
            `${crewService.getName(member)} may not be eligible`,

          message:
            "This crew member may not be qualified for this game level.",

          gameId: game.id,

          crewId: member.id,

          meta: this.getGameMeta(game)

        };

      })

      .filter(Boolean);

  }

};