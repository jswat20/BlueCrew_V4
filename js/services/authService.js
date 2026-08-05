// authService.js

const authService = (() => {
  let currentUser = {
    id: "admin",
    role: "administrator",
    crewId: null,
    name: "Assignor"
  };

  function getCurrentUser() {
    return currentUser;
  }

  function isAdmin() {
    return currentUser.role === "administrator";
  }

  function isUmpire() {
    return currentUser.role === "umpire";
  }

  function currentCrewId() {
    return currentUser.crewId;
  }

  function currentUserName() {
    return currentUser.name;
  }

  function loginAsAdmin() {
    currentUser = {
      id: "admin",
      role: "administrator",
      crewId: null,
      name: "Assignor"
    };
  }

  function loginAsAssigner() {
    currentUser = {
      id: "assigner",
      role: "assigner",
      crewId: null,
      name: "Assigner"
    };
  }

  function loginAsUmpire() {
    const firstCrewMember = crewService.getAll()[0];

    currentUser = {
      id: firstCrewMember?.id || "umpire",
      role: "umpire",
      crewId: firstCrewMember?.id || null,
      name: firstCrewMember?.name || "Umpire"
    };
  }

  function loginAsCrew(crewId) {
    const member = crewService.getById(crewId);

    currentUser = {
      id: crewId,
      role: "umpire",
      crewId,
      name: member?.name || "Umpire"
    };
  }

  function useAuthenticatedAccount(account) {
    if (!account) return null;

    currentUser = {
      id: account.id,
      role: account.role,
      crewId: account.crewId || null,
      name:
        `${account.firstName || ""} ${account.lastName || ""}`.trim() ||
        account.email ||
        "User"
    };

    return currentUser;
  }

  return {
    getCurrentUser,
    isAdmin,
    isUmpire,
    currentCrewId,
    currentUserName,
    loginAsAdmin,
    loginAsAssigner,
    loginAsUmpire,
    loginAsCrew,
    useAuthenticatedAccount
  };
})();
