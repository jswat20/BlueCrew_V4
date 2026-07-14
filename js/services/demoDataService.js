
const demoDataService = (() => {
  const ACCOUNT_STORAGE_KEY =
    "bluecrew_accounts";

  let loaded = false;
  let originalCrew = null;
  let originalGames = null;
  let originalAccounts = null;

  function clone(value) {
    return structuredClone(value);
  }

  function createDate(offsetDays) {
    const date = new Date();

    date.setHours(12, 0, 0, 0);
    date.setDate(
      date.getDate() + Number(offsetDays || 0)
    );

    return date.toISOString().split("T")[0];
  }

  function createDateTime(
    offsetDays,
    hour = 12
  ) {
    const date = new Date();

    date.setHours(hour, 0, 0, 0);
    date.setDate(
      date.getDate() + Number(offsetDays || 0)
    );

    return date.toISOString();
  }

  function isLoaded() {
    return loaded;
  }

  function getSummary() {
    const accounts =
      typeof accountService !== "undefined"
        ? accountService.getAll()
        : [];

    return {
      loaded,
      crew: crewService.getAll().length,
      games: gameService.getAll().length,
      accounts: accounts.length,
      administrators:
        accounts.filter(
          account =>
            account.role === "administrator"
        ).length,
      assigners:
        accounts.filter(
          account =>
            account.role === "assigner"
        ).length,
      umpires:
        accounts.filter(
          account =>
            account.role === "umpire" &&
            account.status === "approved"
        ).length,
      pendingAccounts:
        accounts.filter(
          account =>
            account.status === "pending"
        ).length,
      rejectedAccounts:
        accounts.filter(
          account =>
            account.status === "rejected"
        ).length
    };
  }

  function createShowcaseCrew() {
    return demoCrewData
      .getAll()
      .map(member => ({
        ...member,
        demoData: true,
        showcaseData: true
      }));
  }

  function getShowcaseCrewName(crewId) {
    const member = crewService.getById(crewId);

    if (!member) {
      return "Showcase Umpire";
    }

    if (
      typeof crewService.getDisplayName === "function"
    ) {
      return crewService.getDisplayName(crewId);
    }

    return [
      member.firstName,
      member.lastName
    ]
      .filter(Boolean)
      .join(" ");
  }

  function getShowcaseCrewId(index) {
    const number =
      String((index % 40) + 1).padStart(3, "0");

    return `showcase-crew-${number}`;
  }

  function setAssignedSlot(
    assignment,
    crewId,
    {
      locked = false,
      approvedClaim = false,
      processedAt = null
    } = {}
  ) {
    assignment.crewId = crewId;
    assignment.claimedBy = "";
    assignment.claimedByName = "";
    assignment.status =
      locked
        ? AssignmentStatus.LOCKED
        : AssignmentStatus.ASSIGNED;
    assignment.locked = locked;

    if (approvedClaim) {
      assignment.claimProcessed = true;
      assignment.claimStatus = "approved";
      assignment.claimProcessedAt =
        processedAt || new Date().toISOString();
    }
  }

  function setOpenSlot(
    assignment,
    {
      rejectedClaim = false,
      processedAt = null
    } = {}
  ) {
    assignment.crewId = "";
    assignment.claimedBy = "";
    assignment.claimedByName = "";
    assignment.status =
      AssignmentStatus.OPEN_FOR_CLAIM;
    assignment.locked = false;

    if (rejectedClaim) {
      assignment.claimProcessed = true;
      assignment.claimStatus = "rejected";
      assignment.claimProcessedAt =
        processedAt || new Date().toISOString();
    }
  }

  function setPendingClaim(
    assignment,
    crewId,
    claimedAt
  ) {
    assignment.crewId = "";
    assignment.claimedBy = crewId;
    assignment.claimedByName =
      getShowcaseCrewName(crewId);
    assignment.status =
      AssignmentStatus.PENDING_APPROVAL;
    assignment.locked = false;
    assignment.claimedAt = claimedAt;
    assignment.claimProcessed = false;
    assignment.claimStatus = "pending";
    assignment.claimProcessedAt = null;
  }

  function configureHistoricalAssignments(
    game,
    index
  ) {
    const assignments =
      assignmentService.getAssignments(game);

    assignments.forEach(
      (assignment, assignmentIndex) => {
        const crewId =
          getShowcaseCrewId(
            (index + assignmentIndex * 11) % 24
          );

        setAssignedSlot(
          assignment,
          crewId,
          {
            locked: index % 5 === 0
          }
        );
      }
    );

    assignmentService.normalizeGame(game);
  }

  function configureUpcomingAssignments(
    game,
    index
  ) {
    const assignments =
      assignmentService.getAssignments(game);

    const scheduleIndex = index - 36;
    const scenario = scheduleIndex % 12;

    /*
     * Concentrating the first assignment among a smaller
     * group produces visible workload differences.
     */
    const primaryCrewId =
      getShowcaseCrewId(scheduleIndex % 12);

    const secondaryCrewId =
      getShowcaseCrewId(
        12 + ((scheduleIndex * 5) % 24)
      );

    const processedAt =
      createDateTime(
        -(1 + (scheduleIndex % 20)),
        17
      );

    const claimedAt =
      createDateTime(
        -(scheduleIndex % 4),
        10
      );

    /*
     * Produce one deliberate same-time conflict so the
     * assignment recommendations and warnings have a
     * realistic conflict to expose.
     */
    if (index === 37) {
      game.time = "9:00 AM";
    }

    switch (scenario) {
      /*
       * Fully assigned.
       */
      case 0:
      case 1:
      case 2:
      case 3:
        assignments.forEach(
          (assignment, assignmentIndex) => {
            setAssignedSlot(
              assignment,
              assignmentIndex === 0
                ? primaryCrewId
                : secondaryCrewId
            );
          }
        );
        break;

      /*
       * Partially staffed.
       */
      case 4:
        setAssignedSlot(
          assignments[0],
          primaryCrewId
        );

        if (assignments[1]) {
          assignments[1].crewId = "";
          assignments[1].claimedBy = "";
          assignments[1].status =
            AssignmentStatus.NEEDS_ASSIGNMENT;
          assignments[1].locked = false;
        }
        break;

      /*
       * Open for claims.
       */
      case 5:
        assignments.forEach(
          assignment =>
            setOpenSlot(assignment)
        );
        break;

      /*
       * Claim waiting for assigner approval.
       */
      case 6:
        setPendingClaim(
          assignments[0],
          primaryCrewId,
          claimedAt
        );

        if (assignments[1]) {
          setOpenSlot(assignments[1]);
        }
        break;

      /*
       * Approved claim history.
       */
      case 7:
        setAssignedSlot(
          assignments[0],
          primaryCrewId,
          {
            approvedClaim: true,
            processedAt
          }
        );

        if (assignments[1]) {
          setAssignedSlot(
            assignments[1],
            secondaryCrewId
          );
        }
        break;

      /*
       * Rejected claim history; slot remains open.
       */
      case 8:
        setOpenSlot(
          assignments[0],
          {
            rejectedClaim: true,
            processedAt
          }
        );

        if (assignments[1]) {
          setAssignedSlot(
            assignments[1],
            secondaryCrewId
          );
        }
        break;

      /*
       * Completely unstaffed.
       */
      case 9:
        assignments.forEach(
          assignment => {
            assignment.crewId = "";
            assignment.claimedBy = "";
            assignment.claimedByName = "";
            assignment.status =
              AssignmentStatus.NEEDS_ASSIGNMENT;
            assignment.locked = false;
          }
        );
        break;

      /*
       * Locked, confirmed crew.
       */
      case 10:
        assignments.forEach(
          (assignment, assignmentIndex) => {
            setAssignedSlot(
              assignment,
              assignmentIndex === 0
                ? primaryCrewId
                : secondaryCrewId,
              {
                locked: true
              }
            );
          }
        );
        break;

      /*
       * Emergency opening: one confirmed umpire and one
       * position explicitly open for claim.
       */
      case 11:
        setAssignedSlot(
          assignments[0],
          primaryCrewId
        );

        if (assignments[1]) {
          setOpenSlot(assignments[1]);
        }
        break;
    }

    /*
     * The first two games occur simultaneously and use
     * the same plate umpire, intentionally creating a
     * scheduling conflict.
     */
    if (index === 36 || index === 37) {
      setAssignedSlot(
        assignments[0],
        getShowcaseCrewId(0)
      );
    }

    assignmentService.normalizeGame(game);
  }

  function configureShowcaseAssignments(
    game,
    index
  ) {
    if (index < 36) {
      configureHistoricalAssignments(
        game,
        index
      );
      return;
    }

    configureUpcomingAssignments(
      game,
      index
    );
  }

  function createShowcaseGames() {
    return demoGameData
      .getAll()
      .map((definition, index) => {
        const game = {
          id: definition.id,
          date: createDate(
            definition.dateOffset
          ),
          time: definition.time,
          field: definition.field,
          venue: definition.field,
          level: definition.level,
          awayTeam: definition.awayTeam,
          homeTeam: definition.homeTeam,
          gameType: definition.gameType,
          division: definition.division,
          status:
            definition.dateOffset < 0
              ? "completed"
              : "scheduled",
          demoData: true,
          showcaseData: true
        };

        assignmentService.normalizeGame(game);

        configureShowcaseAssignments(
          game,
          index
        );

        return game;
      });
  }

  function createShowcaseAccounts() {
    return demoAccountData
      .getAll()
      .map(definition => ({
        id: definition.id,
        firstName: definition.firstName,
        lastName: definition.lastName,
        email: definition.email,
        phone: definition.phone || "",
        address: "",
        emergencyContact: "",
        emergencyContactPhone: "",
        status: definition.status,
        crewId: definition.crewId || null,
        role: definition.role || "umpire",
        createdAt: createDateTime(
          definition.createdOffset ?? -60
        ),
        approvedAt:
          definition.status === "approved"
            ? createDateTime(
                definition.approvedOffset ?? -55
              )
            : null,
        rejectedAt:
          definition.status === "rejected"
            ? createDateTime(
                definition.rejectedOffset ?? -5
              )
            : null,
        lastLogin:
          definition.status === "approved"
            ? createDateTime(
                -Math.abs(
                  Number(
                    definition.id
                      .replace(/\D/g, "")
                      .slice(-2)
                  ) % 10
                ),
                18
              )
            : null,
        communicationPreferences:
          definition.communicationPreferences,
        demoData: true,
        showcaseData: true
      }));
  }

  function saveAccounts(accounts) {
    localStorage.setItem(
      ACCOUNT_STORAGE_KEY,
      JSON.stringify(accounts)
    );
  }

  function loadLeague() {
    if (loaded) {
      return {
        success: true,
        message:
          "Showcase league already loaded.",
        data: getSummary()
      };
    }

    originalCrew =
      clone(crewService.getAll());

    originalGames =
      clone(gameService.getAll());

    originalAccounts =
      typeof accountService !== "undefined"
        ? clone(accountService.getAll())
        : [];

    crew = createShowcaseCrew();
    games = createShowcaseGames();

    saveCrew();
    saveGames();
    saveAccounts(
      createShowcaseAccounts()
    );

    loaded = true;

    return {
      success: true,
      message:
        "Showcase league loaded.",
      data: getSummary()
    };
  }

  function resetLeague() {
    if (originalCrew !== null) {
      crew = clone(originalCrew);
      saveCrew();
    }

    if (originalGames !== null) {
      games = clone(originalGames);
      saveGames();
    }

    if (originalAccounts !== null) {
      saveAccounts(
        clone(originalAccounts)
      );
    }

    originalCrew = null;
    originalGames = null;
    originalAccounts = null;
    loaded = false;

    return {
      success: true,
      message:
        "Previous application data restored.",
      data: getSummary()
    };
  }

  return {
    isLoaded,
    getSummary,
    loadLeague,
    resetLeague
  };
})();
