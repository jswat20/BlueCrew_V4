// js/ui/accountRegistration.js

function renderAccountRegistration() {
  const usesSupabaseAuth = typeof supabaseClientService !== "undefined" && supabaseClientService.isConfigured();
  return `
    <div class="page account-registration">

      <div class="card">

        <h2>Become an Umpire</h2>

        <div class="form-group">
          <label>First Name</label>
          <input
            type="text"
            id="account-first-name"
            data-testid="account-first-name"
          >
        </div>

        <div class="form-group">
          <label>Last Name</label>
          <input
            type="text"
            id="account-last-name"
            data-testid="account-last-name"
          >
        </div>

        <div class="form-group">
          <label>Email</label>
          <input
            type="email"
            id="account-email"
            data-testid="account-email"
          >
        </div>

        <div class="form-group">
          <label>Phone</label>
          <input
            type="tel"
            id="account-phone"
            data-testid="account-phone"
          >
        </div>

        <div class="form-group">
          <label>Date of Birth</label>
          <input type="date" id="account-birthdate" data-testid="account-birthdate" required>
          <small>You must be at least 13 years old to register.</small>
        </div>

        ${usesSupabaseAuth ? `
        <div class="form-group">
          <label>Password</label>
          <input type="password" id="account-password" data-testid="account-password" autocomplete="new-password">
        </div>

        ` : ""}

        <div class="form-actions">
          <button
            type="button"
            class="primary"
            data-testid="create-account-button"
            onclick="submitAccountRegistration()">
            Create Account
          </button>
        </div>

        <div
          id="account-registration-message"
          data-testid="account-registration-message">
        </div>

      </div>

    </div>
  `;
}

async function submitAccountRegistration() {

  const firstName =
    document.getElementById("account-first-name").value.trim();

  const lastName =
    document.getElementById("account-last-name").value.trim();

  const email =
    document.getElementById("account-email").value.trim();

  const phone =
    document.getElementById("account-phone").value.trim();

  const birthdate = document.getElementById("account-birthdate").value;
  if (!birthdate) {
    const message = document.getElementById("account-registration-message");
    message.textContent = "Enter your date of birth.";
    message.className = "error";
    return;
  }
  if (!accountService.isAtLeastAge(birthdate, 13)) {
    const message = document.getElementById("account-registration-message");
    message.textContent = "You must be at least 13 years old to register.";
    message.className = "error";
    return;
  }

  const usesSupabaseAuth = typeof supabaseClientService !== "undefined" && supabaseClientService.isConfigured();
  const result = usesSupabaseAuth
    ? await accountService.registerAuthenticatedAccount({
        firstName,
        lastName,
        email,
        phone,
        birthdate,
        password: document.getElementById("account-password").value
      })
    : accountService.createAccount({ firstName, lastName, email, phone, birthdate });

  const message =
    document.getElementById("account-registration-message");

  message.textContent = result.message;

  if (!result.success) {
    message.className = "error";
    return;
  }

  message.className = "success";

  document.getElementById("account-first-name").value = "";
  document.getElementById("account-last-name").value = "";
  document.getElementById("account-email").value = "";
  document.getElementById("account-phone").value = "";
  document.getElementById("account-birthdate").value = "";
  if (usesSupabaseAuth) {
    document.getElementById("account-password").value = "";
  }
}
