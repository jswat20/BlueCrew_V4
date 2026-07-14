// js/services/authorizationService.js

const authorizationService = (() => {
  const ROLES = Object.freeze({
    ADMINISTRATOR: "administrator",
    ASSIGNER: "assigner",
    UMPIRE: "umpire"
  });

  const VALID_ROLES = Object.freeze(Object.values(ROLES));

  const PERMISSIONS = Object.freeze({
    [ROLES.ADMINISTRATOR]: Object.freeze({
      editSchedule: true,
      approveClaims: true,
      manageAccounts: true,
      assignGames: true,
      manageCrew: true,
      manageAvailability: true,
      claimGames: false
    }),

    [ROLES.ASSIGNER]: Object.freeze({
      editSchedule: true,
      approveClaims: true,
      manageAccounts: false,
      assignGames: true,
      manageCrew: false,
      manageAvailability: true,
      claimGames: false
    }),

    [ROLES.UMPIRE]: Object.freeze({
      editSchedule: false,
      approveClaims: false,
      manageAccounts: false,
      assignGames: false,
      manageCrew: false,
      manageAvailability: false,
      claimGames: true
    })
  });

  const PAGE_ACCESS = Object.freeze({
    dashboard: Object.freeze([
      ROLES.ADMINISTRATOR,
      ROLES.ASSIGNER,
      ROLES.UMPIRE
    ]),

    schedule: Object.freeze([
      ROLES.ADMINISTRATOR,
      ROLES.ASSIGNER
    ]),

    crew: Object.freeze([
      ROLES.ADMINISTRATOR
    ]),

    reports: Object.freeze([
      ROLES.ADMINISTRATOR,
      ROLES.ASSIGNER
    ]),

    settings: Object.freeze([
      ROLES.ADMINISTRATOR
    ]),

    admin: Object.freeze([
      ROLES.ADMINISTRATOR
    ]),

    login: Object.freeze([
      ROLES.ADMINISTRATOR,
      ROLES.ASSIGNER,
      ROLES.UMPIRE
    ]),

    accounts: Object.freeze([
      ROLES.ADMINISTRATOR
    ]),

    "claim-games": Object.freeze([
      ROLES.UMPIRE
    ]),

    "my-claims": Object.freeze([
      ROLES.UMPIRE
    ]),
"my-schedule": Object.freeze([
  ROLES.UMPIRE
]),
    "profile": Object.freeze([
      ROLES.UMPIRE
    ]),
"game-hub": Object.freeze([
  ROLES.ADMINISTRATOR,
  ROLES.ASSIGNER,
  ROLES.UMPIRE
]),
"review-queue": Object.freeze([
  "administrator",
  "assigner"
]),

    "claims-queue": Object.freeze([
      ROLES.ADMINISTRATOR,
      ROLES.ASSIGNER
    ]),

    "claim-history": Object.freeze([
      ROLES.ADMINISTRATOR,
      ROLES.ASSIGNER
    ]),

    availability: Object.freeze([
      ROLES.ADMINISTRATOR,
      ROLES.ASSIGNER,
      ROLES.UMPIRE
    ]),

    notifications: Object.freeze([
      ROLES.ADMINISTRATOR,
      ROLES.ASSIGNER,
      ROLES.UMPIRE
    ])
  });

  function normalizeRole(role) {
    if (role === "admin") {
      return ROLES.ADMINISTRATOR;
    }

    return VALID_ROLES.includes(role)
      ? role
      : ROLES.UMPIRE;
  }

  function getRoleFromLoginService() {
    if (typeof loginService === "undefined") {
      return null;
    }

    if (typeof loginService.getCurrentAccount === "function") {
      const account = loginService.getCurrentAccount();

      if (account?.role) {
        return account.role;
      }
    }

    if (typeof loginService.getCurrentSession === "function") {
      const session = loginService.getCurrentSession();

      if (session?.role) {
        return session.role;
      }
    }

    return null;
  }

  function getRoleFromLegacyAuthService() {
    if (
      typeof authService === "undefined" ||
      typeof authService.getCurrentUser !== "function"
    ) {
      return null;
    }

    return authService.getCurrentUser()?.role || null;
  }

 function currentRole() {
  const legacyRole = getRoleFromLegacyAuthService();

  if (legacyRole) {
    return normalizeRole(legacyRole);
  }

  return normalizeRole(getRoleFromLoginService());
}

  function can(permission, role = currentRole()) {
    const normalizedRole = normalizeRole(role);
    const rolePermissions = PERMISSIONS[normalizedRole];

    return rolePermissions?.[permission] === true;
  }

  function canView(page, role = currentRole()) {
    const normalizedPage = String(page || "").trim().toLowerCase();
    const normalizedRole = normalizeRole(role);
    const allowedRoles = PAGE_ACCESS[normalizedPage];

    return Array.isArray(allowedRoles) &&
      allowedRoles.includes(normalizedRole);
  }

  function canEditSchedule(role) {
    return can("editSchedule", role);
  }

  function canApproveClaims(role) {
    return can("approveClaims", role);
  }

  function canManageAccounts(role) {
    return can("manageAccounts", role);
  }

  function canAssignGames(role) {
    return can("assignGames", role);
  }

  function canManageCrew(role) {
    return can("manageCrew", role);
  }

  function canManageAvailability(role) {
    return can("manageAvailability", role);
  }

  function canClaimGames(role) {
    return can("claimGames", role);
  }

  return {
    currentRole,
    can,
    canView,
    canEditSchedule,
    canApproveClaims,
    canManageAccounts,
    canAssignGames,
    canManageCrew,
    canManageAvailability,
    canClaimGames
  };
})();
