// ======================================================
// BlueCrew V2
// Workload Service
// ======================================================

const workloadService = {

  getCrewGamesForDate(crewId, date) {
    if (!crewId || !date) return [];

    return gameService
      .getAll()
      .filter(game =>
        game.date === date &&
        String(game.crewId) === String(crewId)
      )
      .sort(sortGames);
  },

  getCrewWorkloadForDate(crewId, date) {
    const crewGames =
      this.getCrewGamesForDate(crewId, date);

    const count = crewGames.length;

    let level = "available";

    if (count >= 4) {
      level = "maxed";
    } else if (count >= 2) {
      level = "busy";
    } else if (count === 1) {
      level = "assigned";
    }

    return {
      count,
      level,
      label: `${count} game${count === 1 ? "" : "s"} today`,
      games: crewGames
    };
  },

  getGameCrewWorkload(game) {
    if (!game || !game.crewId || !game.date) {
      return null;
    }

    return this.getCrewWorkloadForDate(
      game.crewId,
      game.date
    );
  },

  getSeasonAssignments(crewId) {
    if (!crewId) return 0;

    return gameService
      .getAll()
      .filter(game =>
        String(game.crewId) === String(crewId)
      )
      .length;
  },

  getDailyCrewWorkloads(date) {
    return crewService
      .getAll()
      .map(member => {

        const workload =
          this.getCrewWorkloadForDate(
            member.id,
            date
          );

        return {
          crewId: member.id,
          name: crewService.getName(member),
          count: workload.count,
          level: workload.level,
          games: workload.games,
          seasonAssignments:
            this.getSeasonAssignments(member.id),
          active: crewService.isActive(member)
        };

      })
      .sort((a, b) => {

        if (b.count !== a.count) {
          return b.count - a.count;
        }

        return a.name.localeCompare(b.name);

      });
  }

};