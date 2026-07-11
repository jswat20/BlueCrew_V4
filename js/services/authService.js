// authService.js

const authService = (() => {
  let currentUser = {
    id: "admin",
    role: "admin",
    crewId: null,
    name: "Assignor"
  };

  function getCurrentUser() {
    return currentUser;
  }

  function isAdmin() {
    return currentUser.role === "admin";
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
      role: "admin",
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

  return {
    getCurrentUser,
    isAdmin,
    isUmpire,
    currentCrewId,
    currentUserName,
    loginAsAdmin,
    loginAsAssigner,
    loginAsUmpire,
    loginAsCrew
  };
})();