const authenticatedIdentityService = (() => {
  const BASE_TITLE = "The Slate | SwatWorks";
  function account() { return typeof loginService !== "undefined" ? loginService.getCurrentAccount?.() : null; }
  function roleLabel(role) { return role === "umpire" ? "Umpire" : role === "assigner" ? "Assigner" : "Administrator"; }
  function displayName(value = account()) {
    if (!value) {
      const role = typeof authorizationService !== "undefined" ? authorizationService.currentRole?.() : (typeof authService !== "undefined" ? authService.getCurrentUser?.()?.role : "administrator");
      return roleLabel(role);
    }
    const preferred = String(value.preferredName || value.displayName || "").trim();
    const full = `${value.firstName || ""} ${value.lastName || ""}`.trim();
    const emailPrefix = String(value.email || "").split("@")[0].trim();
    return preferred || full || emailPrefix || roleLabel(value.role);
  }
  function updateDocumentTitle(value = account()) {
    document.title = !value ? BASE_TITLE : `${BASE_TITLE} - ${value.role === "umpire" ? "Umpire" : "Admin"}`;
    return document.title;
  }
  return { displayName, roleLabel, updateDocumentTitle, BASE_TITLE };
})();
