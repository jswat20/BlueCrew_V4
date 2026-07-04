// js/ui/accountRegistration.js

function renderAccountRegistration() {
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

        <div class="form-actions">
          <button
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

function submitAccountRegistration() {

  const firstName =
    document.getElementById("account-first-name").value.trim();

  const lastName =
    document.getElementById("account-last-name").value.trim();

  const email =
    document.getElementById("account-email").value.trim();

  const phone =
    document.getElementById("account-phone").value.trim();

  const result = accountService.createAccount({
    firstName,
    lastName,
    email,
    phone
  });

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
}