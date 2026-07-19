// js/services/accountService.js

const accountService = (() => {
  const STORAGE_KEY = "bluecrew_accounts";
const ACCOUNT_ROLES = Object.freeze({
  ADMINISTRATOR: "administrator",
  ASSIGNER: "assigner",
  UMPIRE: "umpire"
});

  const VALID_ACCOUNT_ROLES = Object.values(ACCOUNT_ROLES);
  const MAX_PERSISTED_PHOTO_BYTES = 400 * 1024;

function requireManageAccounts() {
  if (
    typeof authorizationService !== "undefined" &&
    !authorizationService.canManageAccounts()
  ) {
    return mutationResult(false, "Unauthorized.");
  }

  return null;
}

function normalizeRole(role) {
  return VALID_ACCOUNT_ROLES.includes(role)
    ? role
    : ACCOUNT_ROLES.UMPIRE;
}

function isValidRole(role) {
  return VALID_ACCOUNT_ROLES.includes(role);
}
  function mutationResult(success, message, data = null) {
    return { success, message, data };
  }

  function profileMutationResult(success, message, data = null, errors = {}) {
    return { success, message, data, errors };
  }

  function readAll() {
    const accounts = localStorage.getItem(STORAGE_KEY);
    return accounts ? JSON.parse(accounts) : [];
  }

  function getAll() {
    return migrateCrewCodes(readAll());
  }

  function saveAll(accounts) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  }

function generateId() {
  return `account-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

  function getCrewCodeYear(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
  }

  function generateUniqueCrewId(accounts = readAll(), issuedAt = new Date()) {
    const year = getCrewCodeYear(issuedAt);
    const prefix = `BC-${year}-`;
    const used = new Set(accounts.map(account => String(account.crewCode || "").toUpperCase()).filter(Boolean));
    let sequence = accounts.reduce((highest, account) => {
      const match = String(account.crewCode || "").toUpperCase().match(/^BC-(\d{4})-(\d{4,})$/);
      return match && Number(match[1]) === year ? Math.max(highest, Number(match[2])) : highest;
    }, 0) + 1;
    let candidate = `${prefix}${String(sequence).padStart(4, "0")}`;
    while (used.has(candidate)) {
      sequence += 1;
      candidate = `${prefix}${String(sequence).padStart(4, "0")}`;
    }
    return candidate;
  }

  function migrateCrewCodes(sourceAccounts = readAll()) {
    const accounts = Array.isArray(sourceAccounts) ? sourceAccounts : [];
    let changed = false;
    const assigned = new Set(accounts.map(account => String(account.crewCode || "").toUpperCase()).filter(Boolean));
    accounts
      .filter(account => normalizeRole(account.role) === ACCOUNT_ROLES.UMPIRE && !account.crewCode)
      .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")))
      .forEach(account => {
        let crewCode = generateUniqueCrewId(accounts, account.createdAt || new Date());
        while (assigned.has(crewCode)) crewCode = generateUniqueCrewId([...accounts, ...[...assigned].map(code => ({ crewCode }))], account.createdAt || new Date());
        account.crewCode = crewCode;
        account.crewCodeIssuedAt = account.crewCodeIssuedAt || account.createdAt || new Date().toISOString();
        assigned.add(crewCode);
        changed = true;
        activityService?.log?.({ type: "account", action: "crew_id_assigned", accountId: account.id, subject: `${account.firstName || ""} ${account.lastName || ""}`.trim(), metadata: { crewCode } });
      });
    if (changed) saveAll(accounts);
    return accounts;
  }

  const DEFAULT_COMMUNICATION_PREFERENCES = {
    assignments: true,
    claims: true,
    reviews: true,
    availability: true,
    accounts: true,
    activityDigest: true,
    soundEnabled: true,
    desktopNotifications: false
  };

  function normalizeCommunicationPreferences(
    preferences = {}
  ) {
    return Object.fromEntries(
      Object.entries(
        DEFAULT_COMMUNICATION_PREFERENCES
      ).map(([key, defaultValue]) => [
        key,
        typeof preferences[key] === "boolean"
          ? preferences[key]
          : defaultValue
      ])
    );
  }

  function normalizeAccount(account) {
    const normalized = {
      id: account.id || generateId(),
      firstName: account.firstName || "",
      lastName: account.lastName || "",
      email: account.email || "",
      phone: account.phone || "",
      homePhone: account.homePhone || "",
      address: account.address || "",
      contactPreference: ["text", "call"].includes(account.contactPreference) ? account.contactPreference : "text",
      birthdate: account.birthdate || "",
      photoDataUrl: account.photoDataUrl || "",
      officialHistory: normalizeOfficialHistory(account.officialHistory),
      adminNotes: account.adminNotes || "",
      emergencyContact: account.emergencyContact || "",
      emergencyContactPhone:
        account.emergencyContactPhone || "",
      status: account.status || "pending",
      crewId: account.crewId || null,
      createdAt: account.createdAt || new Date().toISOString(),
      approvedAt: account.approvedAt || null,
      rejectedAt: account.rejectedAt || null,
role: normalizeRole(account.role),
      lastLogin: account.lastLogin || null,
      communicationPreferences:
        normalizeCommunicationPreferences(
          account.communicationPreferences
        ),
      crewCode: account.crewCode || "",
      crewCodeIssuedAt: account.crewCodeIssuedAt || null
    };
    if (normalized.role === ACCOUNT_ROLES.UMPIRE && !normalized.crewCode) {
      normalized.crewCode = generateUniqueCrewId(readAll(), normalized.createdAt);
      normalized.crewCodeIssuedAt = normalized.createdAt;
    }
    return normalized;
  }


  function createAccountNotification(
    account,
    {
      type,
      title,
      message
    }
  ) {
    if (
      typeof notificationService ===
        "undefined" ||
      typeof notificationService.create !==
        "function" ||
      !account
    ) {
      return;
    }

    notificationService.create({
      type,
      title,
      message,
      relatedId: account.id,
      audience: "umpire",
      recipientAccountId: account.id,
      destination: {
        page: "profile",
        context: {}
      }
    });
  }

  function createAccount(accountData = {}) {
    const accounts = getAll();

    const account = normalizeAccount(accountData);

    if (!account.firstName || !account.lastName || !account.email) {
      return mutationResult(false, "First name, last name, and email are required.");
    }

    const emailExists = accounts.some(
      account =>
        account.email.toLowerCase() === accountData.email.toLowerCase()
    );

    if (emailExists) {
      return mutationResult(false, "An account with this email already exists.");
    }

    accounts.push(account);
    saveAll(accounts);

    if (account.crewCode) {
      activityService?.log?.({ type: "account", action: "crew_id_assigned", accountId: account.id, subject: `${account.firstName} ${account.lastName}`.trim(), metadata: { crewCode: account.crewCode } });
    }

    if (!isValidEmail(account.email)) return profileMutationResult(false, "Enter a valid email address.", null, { email: "Enter a valid email address." });
    if (!isValidPhone(account.phone) || !isValidPhone(account.homePhone)) return profileMutationResult(false, "Enter a valid phone number.", null, { phone: "Phone numbers must contain 7 to 15 digits." });
    if (!isValidBirthdate(account.birthdate)) return profileMutationResult(false, "Enter a valid birthdate that is not in the future.", null, { birthdate: "Invalid birthdate." });
    const photoValidation = validatePhotoDataUrl(account.photoDataUrl);
    if (!photoValidation.success) return photoValidation;

    if (
      typeof activityService !== "undefined" &&
      typeof activityService.log === "function"
    ) {
      activityService.log({
        type: "account",
        action: "account_created",
        subject:
          `${account.firstName || ""} ${
            account.lastName || ""
          }`.trim() ||
          account.email,
        accountId: account.id,
        metadata: {
          role: account.role || "umpire",
          email: account.email || ""
        }
      });
    }

    return mutationResult(true, "Account created and pending approval.", account);
  }

 function approveAccount(accountId, crewId = null) {
    const authorization = requireManageAccounts();

    if (authorization) {
      return authorization;
    }

  const accounts = getAll();
  const account = accounts.find(account => account.id === accountId);

  if (!account) {
    return mutationResult(false, "Account not found.");
  }

  account.status = "approved";
  account.crewId = crewId || account.crewId || null;
  account.approvedAt = new Date().toISOString();
  account.rejectedAt = null;

  saveAll(accounts);

  createAccountNotification(
    account,
    {
      type: "account-approved",
      title: "Account Approved",
      message:
        "Your account for The Slate has been approved."
    }
  );

  if (
    typeof activityService !== "undefined" &&
    typeof activityService.log === "function"
  ) {
    activityService.log({
      type: "account",
      action: "account_approved",
      actor:
        typeof activityService.getCurrentActor ===
          "function"
          ? activityService.getCurrentActor()
          : "",
      subject:
        `${account.firstName || ""} ${
          account.lastName || ""
        }`.trim() ||
        account.email,
      accountId: account.id,
      metadata: {
        role: account.role || "umpire"
      }
    });
  }

  return mutationResult(true, "Account approved.", account);
}

function approveAccounts(accountIds = []) {
    const authorization = requireManageAccounts();

    if (authorization) {
      return authorization;
    }

  const summary = {
    processed: 0,
    approved: 0,
    failed: 0
  };

  for (const accountId of accountIds) {
    summary.processed++;

    const result = approveAccount(accountId);

    if (result.success) {
      summary.approved++;
    } else {
      summary.failed++;
    }
  }

  return mutationResult(
    true,
    `${summary.approved} account(s) approved.`,
    summary
  );
}

function rejectAccount(accountId) {
    const authorization = requireManageAccounts();

    if (authorization) {
      return authorization;
    }

  const accounts = getAll();
  const account = accounts.find(account => account.id === accountId);

  if (!account) {
    return mutationResult(false, "Account not found.");
  }

  account.status = "rejected";
  account.rejectedAt = new Date().toISOString();

  saveAll(accounts);

  createAccountNotification(
    account,
    {
      type: "account-rejected",
      title: "Account Rejected",
      message:
        "Your account for The Slate was not approved."
    }
  );

  if (
    typeof activityService !== "undefined" &&
    typeof activityService.log === "function"
  ) {
    activityService.log({
      type: "account",
      action: "account_rejected",
      actor:
        typeof activityService.getCurrentActor ===
          "function"
          ? activityService.getCurrentActor()
          : "",
      subject:
        `${account.firstName || ""} ${
          account.lastName || ""
        }`.trim() ||
        account.email,
      accountId: account.id
    });
  }

  return mutationResult(true, "Account rejected.", account);
}

function rejectAccounts(accountIds = []) {
    const authorization = requireManageAccounts();

    if (authorization) {
      return authorization;
    }

  const summary = {
    processed: 0,
    rejected: 0,
    failed: 0
  };

  for (const accountId of accountIds) {
    summary.processed++;

    const result = rejectAccount(accountId);

    if (result.success) {
      summary.rejected++;
    } else {
      summary.failed++;
    }
  }

  return mutationResult(
    true,
    `${summary.rejected} account(s) rejected.`,
    summary
  );
}

  function filterAccountsByRole(accounts, role = "all") {
  if (!role || role === "all") {
    return accounts;
  }

  if (!isValidRole(role)) {
    return [];
  }

  return accounts.filter(account => account.role === role);
}

function getPendingAccounts(options = {}) {
  const accounts = getAll().filter(
    account => account.status === "pending"
  );

  return filterAccountsByRole(accounts, options.role);
}

  function getApprovedAccounts(options = {}) {
  const accounts = getAll().filter(
    account => account.status === "approved"
  );

  return filterAccountsByRole(accounts, options.role);
}

  function getById(accountId) {
    return getAll().find(account => account.id === accountId) || null;
  }

  function updateAccount(accountId, updates = {}) {
    const authorization = requireManageAccounts();

    if (authorization) {
      return authorization;
    }

    const accounts = getAll();
    const account = accounts.find(account => account.id === accountId);

    if (!account) {
      return mutationResult(false, "Account not found.");
    }

    if (Object.prototype.hasOwnProperty.call(updates, "crewCode") && updates.crewCode !== account.crewCode) {
      return mutationResult(false, "Crew ID is immutable.", account);
    }

    Object.assign(account, {
      ...updates,
      id: account.id
    });

    saveAll(accounts);

    return mutationResult(true, "Account updated.", account);
  }

  function linkCrew(accountId, crewId) {
    const authorization = requireManageAccounts();

    if (authorization) {
      return authorization;
    }

  const accounts = getAll();

  const account = accounts.find(a => a.id === accountId);

  if (!account) {
    return mutationResult(false, "Account not found.");
  }

  if (account.status !== "approved") {
    return mutationResult(false, "Only approved accounts may be linked.");
  }

  const crewMember = crewService.getById(crewId);

  if (!crewMember) {
    return mutationResult(false, "Crew member not found.");
  }

  const existingLink = accounts.find(
    a => a.id !== accountId && a.crewId === crewId
  );

  if (existingLink) {
    return mutationResult(
      false,
      "Crew member is already linked to another account."
    );
  }

  account.crewId = crewId;

  saveAll(accounts);

  return mutationResult(true, "Crew linked successfully.", account);
}

function unlinkCrew(accountId) {
    const authorization = requireManageAccounts();

    if (authorization) {
      return authorization;
    }

  const accounts = getAll();

  const account = accounts.find(a => a.id === accountId);

  if (!account) {
    return mutationResult(false, "Account not found.");
  }

  account.crewId = null;

  saveAll(accounts);

  return mutationResult(true, "Crew unlinked successfully.", account);
}

function getUnlinkedApprovedAccounts(options = {}) {
  const accounts = getAll().filter(
    account =>
      account.status === "approved" &&
      account.crewId === null
  );

  return filterAccountsByRole(accounts, options.role);
}
function getRoles() {
  return [...VALID_ACCOUNT_ROLES];
}

function updateRole(accountId, role) {
    const authorization = requireManageAccounts();

    if (authorization) {
      return authorization;
    }

  if (!isValidRole(role)) {
    return mutationResult(false, "Invalid account role.");
  }

  const accounts = getAll();
  const account = accounts.find(item => item.id === accountId);

  if (!account) {
    return mutationResult(false, "Account not found.");
  }

  account.role = role;
  if (role === ACCOUNT_ROLES.UMPIRE && !account.crewCode) {
    account.crewCode = generateUniqueCrewId(accounts, account.createdAt || new Date());
    account.crewCodeIssuedAt = account.crewCodeIssuedAt || new Date().toISOString();
  }

  saveAll(accounts);

  return mutationResult(
    true,
    "Account role updated.",
    account
  );
}

function getByRole(role) {
  if (!isValidRole(role)) {
    return [];
  }

  return getAll().filter(
    account => normalizeRole(account.role) === role
  );
}

function getRoleSummary() {
  return getAll().reduce(
    (summary, account) => {
      const role = normalizeRole(account.role);
      summary[role] += 1;
      return summary;
    },
    {
      administrator: 0,
      assigner: 0,
      umpire: 0
    }
  );
}
  function normalizeProfileValue(value) {
    return String(value || "").trim();
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function normalizePhone(value) {
    const phone = normalizeProfileValue(value);

    if (!phone) {
      return "";
    }

    const digits = phone.replace(/\D/g, "");

    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(
        3,
        6
      )}-${digits.slice(6)}`;
    }

    return phone;
  }

  function isValidPhone(value) {
    if (!value) return true;
    const length = String(value).replace(/\D/g, "").length;
    return length >= 7 && length <= 15;
  }

  function isValidBirthdate(value) {
    if (!value) return true;
    const date = new Date(`${value}T12:00:00`);
    return !Number.isNaN(date.getTime()) && date.getTime() <= Date.now();
  }

  function normalizeOfficialHistory(history) {
    if (!Array.isArray(history)) return [];
    return history.map(entry => ({
      year: Number(entry?.year),
      season: normalizeProfileValue(entry?.season),
      label: normalizeProfileValue(entry?.label),
      note: normalizeProfileValue(entry?.note)
    })).filter(entry => Number.isInteger(entry.year) && entry.year >= 1900 && entry.year <= new Date().getFullYear() + 1 && entry.label);
  }

  function deriveAge(birthdate, today = new Date()) {
    if (!isValidBirthdate(birthdate) || !birthdate) return null;
    const born = new Date(`${birthdate}T12:00:00`);
    let age = today.getFullYear() - born.getFullYear();
    const beforeBirthday = today.getMonth() < born.getMonth() || (today.getMonth() === born.getMonth() && today.getDate() < born.getDate());
    if (beforeBirthday) age -= 1;
    return age >= 0 ? age : null;
  }

  function deriveYearsOfService(history) {
    return new Set(normalizeOfficialHistory(history).filter(entry => entry.label !== "-").map(entry => entry.year)).size;
  }

  function validatePhotoDataUrl(value) {
    if (!value) return profileMutationResult(true, "No photo supplied.", "");
    const match = String(value).match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/i);
    if (!match) return profileMutationResult(false, "Use a JPEG, PNG, or WebP image.", null, { photo: "Unsupported image format." });
    const estimatedBytes = Math.floor(match[2].length * 0.75);
    if (estimatedBytes > MAX_PERSISTED_PHOTO_BYTES) return profileMutationResult(false, "The processed photo is too large.", null, { photo: "Photo must be smaller than 400 KB after processing." });
    return profileMutationResult(true, "Photo is valid.", value);
  }

  function getProfile(accountId) {
    const account = getById(accountId);

    if (!account) {
      return null;
    }

    return {
      id: account.id,
      firstName: account.firstName || "",
      lastName: account.lastName || "",
      name:
        `${account.firstName || ""} ${
          account.lastName || ""
        }`.trim(),
      email: account.email || "",
      phone: account.phone || "",
      homePhone: account.homePhone || "",
      address: account.address || "",
      contactPreference: account.contactPreference || "text",
      birthdate: account.birthdate || "",
      age: deriveAge(account.birthdate),
      photoDataUrl: account.photoDataUrl || "",
      officialHistory: normalizeOfficialHistory(account.officialHistory),
      yearsOfService: deriveYearsOfService(account.officialHistory),
      adminNotes: account.adminNotes || "",
      crewCode: account.crewCode || "",
      crewCodeIssuedAt: account.crewCodeIssuedAt || null,
      status: account.status || "pending",
      emergencyContact:
        account.emergencyContact || "",
      emergencyContactPhone:
        account.emergencyContactPhone || "",
      communicationPreferences:
        normalizeCommunicationPreferences(
          account.communicationPreferences
        ),
      role: normalizeRole(account.role),
      crewId: account.crewId || null
    };
  }

  function updateCrewSelfServiceProfile(accountId, updates = {}) {
    const current = typeof loginService !== "undefined" ? loginService.getCurrentAccount?.() : null;
    if (!current || String(current.id) !== String(accountId)) {
      return profileMutationResult(false, "Unauthorized profile update.", null, { authorization: "You may update only your own profile." });
    }
    const accounts = getAll();

    const account = accounts.find(
      item => String(item.id) === String(accountId)
    );

    if (!account) {
      return profileMutationResult(
        false,
        "Account not found."
      );
    }

    const email =
      normalizeProfileValue(updates.email);

    if (!email) {
      return profileMutationResult(
        false,
        "Email is required."
      );
    }

    if (!isValidEmail(email)) {
      return profileMutationResult(
        false,
        "Enter a valid email address."
      );
    }

    const duplicateEmail = accounts.some(
      item =>
        String(item.id) !== String(accountId) &&
        String(item.email || "").toLowerCase() ===
          email.toLowerCase()
    );

    if (duplicateEmail) {
      return profileMutationResult(
        false,
        "An account with this email already exists."
      );
    }

    const restrictedFields = ["crewCode", "firstName", "lastName", "birthdate", "age", "levels", "eligibility", "officialHistory", "adminNotes", "status", "role", "crewId"];
    const submittedRestricted = restrictedFields.filter(field => Object.prototype.hasOwnProperty.call(updates, field));
    if (submittedRestricted.length) {
      return profileMutationResult(false, "One or more profile fields are administrator-managed.", getProfile(account.id), Object.fromEntries(submittedRestricted.map(field => [field, "This field cannot be changed in self-service."])));
    }

    account.email = email;
    account.phone =
      normalizePhone(updates.phone);
    account.homePhone = normalizePhone(updates.homePhone);
    account.address =
      normalizeProfileValue(updates.address);
    account.emergencyContact =
      normalizeProfileValue(
        updates.emergencyContact
      );
    account.emergencyContactPhone =
      normalizePhone(
        updates.emergencyContactPhone
      );

    if (!isValidPhone(account.phone) || !isValidPhone(account.homePhone) || !isValidPhone(account.emergencyContactPhone)) {
      return profileMutationResult(false, "Enter a valid phone number.", getProfile(account.id), { phone: "Phone numbers must contain 7 to 15 digits." });
    }

    if (Object.prototype.hasOwnProperty.call(updates, "contactPreference")) {
      if (!["text", "call"].includes(updates.contactPreference)) return profileMutationResult(false, "Select text or call as the contact preference.", getProfile(account.id), { contactPreference: "Invalid contact preference." });
      account.contactPreference = updates.contactPreference;
    }

    if (Object.prototype.hasOwnProperty.call(updates, "photoDataUrl")) {
      const photo = validatePhotoDataUrl(updates.photoDataUrl);
      if (!photo.success) return photo;
      account.photoDataUrl = photo.data;
    }

    if (
      updates.communicationPreferences &&
      typeof updates.communicationPreferences ===
        "object"
    ) {
      account.communicationPreferences =
        normalizeCommunicationPreferences({
          ...account.communicationPreferences,
          ...updates.communicationPreferences
        });
    } else {
      account.communicationPreferences =
        normalizeCommunicationPreferences(
          account.communicationPreferences
        );
    }

    saveAll(accounts);

    activityService?.log?.({ type: "profile", action: "crew_self_service_updated", accountId: account.id, subject: `${account.firstName} ${account.lastName}`.trim(), message: "Crew contact profile updated." });
    if (Object.prototype.hasOwnProperty.call(updates, "photoDataUrl")) activityService?.log?.({ type: "profile", action: "crew_photo_updated", accountId: account.id, subject: `${account.firstName} ${account.lastName}`.trim(), message: "Crew photo updated." });

    return profileMutationResult(
      true,
      "Profile saved.",
      getProfile(account.id)
    );
  }

  function updateProfile(accountId, updates = {}) {
    return updateCrewSelfServiceProfile(accountId, updates);
  }

  function updateCrewProfileAsAdmin(accountId, changes = {}) {
    const authorization = requireManageAccounts();
    if (authorization) return profileMutationResult(false, authorization.message, null, { authorization: authorization.message });
    const accounts = getAll();
    const account = accounts.find(item => String(item.id) === String(accountId));
    if (!account) return profileMutationResult(false, "Account not found.", null, { account: "Account not found." });
    if (Object.prototype.hasOwnProperty.call(changes, "crewCode") && changes.crewCode !== account.crewCode) return profileMutationResult(false, "Crew ID is immutable.", getProfile(account.id), { crewCode: "Crew ID cannot be changed." });

    const errors = {};
    const email = Object.prototype.hasOwnProperty.call(changes, "email") ? normalizeProfileValue(changes.email) : account.email;
    if (!email || !isValidEmail(email)) errors.email = "Enter a valid email address.";
    if (accounts.some(item => String(item.id) !== String(accountId) && String(item.email || "").toLowerCase() === email.toLowerCase())) errors.email = "An account with this email already exists.";
    if (!isValidPhone(changes.phone ?? account.phone) || !isValidPhone(changes.homePhone ?? account.homePhone)) errors.phone = "Phone numbers must contain 7 to 15 digits.";
    if (!isValidBirthdate(changes.birthdate ?? account.birthdate)) errors.birthdate = "Enter a valid birthdate that is not in the future.";
    if (Object.prototype.hasOwnProperty.call(changes, "contactPreference") && !["text", "call"].includes(changes.contactPreference)) errors.contactPreference = "Select text or call.";
    if (Object.keys(errors).length) return profileMutationResult(false, "Crew profile could not be saved.", getProfile(account.id), errors);

    ["firstName", "lastName", "address", "adminNotes"].forEach(field => {
      if (Object.prototype.hasOwnProperty.call(changes, field)) account[field] = normalizeProfileValue(changes[field]);
    });
    if (!account.firstName || !account.lastName) return profileMutationResult(false, "First and last name are required.", getProfile(account.id), { name: "First and last name are required." });
    account.email = email;
    if (Object.prototype.hasOwnProperty.call(changes, "phone")) account.phone = normalizePhone(changes.phone);
    if (Object.prototype.hasOwnProperty.call(changes, "homePhone")) account.homePhone = normalizePhone(changes.homePhone);
    if (Object.prototype.hasOwnProperty.call(changes, "birthdate")) account.birthdate = changes.birthdate || "";
    if (Object.prototype.hasOwnProperty.call(changes, "contactPreference")) account.contactPreference = changes.contactPreference;
    if (Object.prototype.hasOwnProperty.call(changes, "officialHistory")) account.officialHistory = normalizeOfficialHistory(changes.officialHistory);
    if (Object.prototype.hasOwnProperty.call(changes, "photoDataUrl")) {
      const photo = validatePhotoDataUrl(changes.photoDataUrl);
      if (!photo.success) return photo;
      account.photoDataUrl = photo.data;
    }

    const linkedCrew = account.crewId ? crewService.getById(account.crewId) : null;
    if (linkedCrew) {
      linkedCrew.firstName = account.firstName;
      linkedCrew.lastName = account.lastName;
      linkedCrew.email = account.email;
      linkedCrew.phone = account.phone;
      if (Object.prototype.hasOwnProperty.call(changes, "levels")) linkedCrew.levels = [...new Set((changes.levels || []).filter(level => settings.levels.includes(level)))];
      if (Object.prototype.hasOwnProperty.call(changes, "active")) linkedCrew.active = changes.active === true;
      if (Object.prototype.hasOwnProperty.call(changes, "adminNotes")) linkedCrew.notes = account.adminNotes;
      saveCrew?.();
    }
    saveAll(accounts);
    const changedAreas = ["photoDataUrl", "levels", "officialHistory", "adminNotes", "active"].filter(field => Object.prototype.hasOwnProperty.call(changes, field));
    activityService?.log?.({ type: "profile", action: "crew_profile_updated", accountId: account.id, crewId: account.crewId || "", subject: `${account.firstName} ${account.lastName}`.trim(), message: "Crew profile updated by administrator.", metadata: { changedAreas } });
    return profileMutationResult(true, "Crew profile saved.", getProfile(account.id));
  }

  function deleteAccount(accountId) {
    const authorization = requireManageAccounts();

    if (authorization) {
      return authorization;
    }

    const accounts = getAll();
    const nextAccounts = accounts.filter(account => account.id !== accountId);

    if (nextAccounts.length === accounts.length) {
      return mutationResult(false, "Account not found.");
    }

    saveAll(nextAccounts);

    return mutationResult(true, "Account deleted.", { id: accountId });
  }

  return {
    getAll,
    createAccount,
    approveAccount,
    approveAccounts,
    rejectAccount,
    rejectAccounts,
    getPendingAccounts,
    getApprovedAccounts,
    getUnlinkedApprovedAccounts,
    getById,
    getProfile,
    updateProfile,
    updateCrewSelfServiceProfile,
    updateCrewProfileAsAdmin,
    deriveAge,
    deriveYearsOfService,
    normalizeOfficialHistory,
    validatePhotoDataUrl,
    updateAccount,
    deleteAccount,
    linkCrew,
    unlinkCrew,
    getRoles,
    updateRole,
    getByRole,
    getRoleSummary,
    generateUniqueCrewId,
    migrateCrewCodes,
    getDefaultCommunicationPreferences:
      () => ({
        ...DEFAULT_COMMUNICATION_PREFERENCES
      }),
    normalizeCommunicationPreferences
  };
})();
