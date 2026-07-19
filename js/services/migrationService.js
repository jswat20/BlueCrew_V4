// migrationService.js

const migrationService = (() => {

  function migrateGames() {
    let changed = false;

    gameService.getAll().forEach(game => {

      if (!game.assignmentStatus) {
        game.assignmentStatus =
          game.crewId
            ? "assigned"
            : "needs_assignment";

        changed = true;
      }

      if (!game.assignmentMode) {
        game.assignmentMode = "admin_only";
        changed = true;
      }

      if (game.claimedBy === undefined) {
        game.claimedBy = null;
        changed = true;
      }

      if (game.assignedBy === undefined) {
        game.assignedBy = null;
        changed = true;
      }

      if (game.assignedAt === undefined) {
        game.assignedAt = null;
        changed = true;
      }

      if (game.locked === undefined) {
        game.locked = false;
        changed = true;
      }

    });

    if (changed) {
      gameService.save();
      console.log("BlueCrew migration completed.");
    }
  }

  function migrateCrewAccounts() {
    return typeof accountService !== "undefined" && typeof accountService.migrateCrewCodes === "function"
      ? accountService.migrateCrewCodes()
      : [];
  }

  return {
    migrateGames,
    migrateCrewAccounts
  };

})();
