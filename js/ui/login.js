// js/ui/login.js

function renderLogin() {
  return `
    <section class="panel" data-testid="login-page">
      <h2>Umpire Login</h2>

      <p class="muted">
        Enter your email to continue.
      </p>

      <form data-testid="login-form" onsubmit="handleLoginSubmit(event)">
        <div class="form-group">
          <label for="login-email">Email</label>
          <input
            id="login-email"
            data-testid="login-email"
            type="email"
            placeholder="umpire@example.com"
            required
          />
        </div>

        <button type="submit" data-testid="login-submit">
          Log In
        </button>
      </form>

      <div
        class="form-message"
        data-testid="login-message"
        aria-live="polite"
      ></div>
    </section>
  `;
}

function handleLoginSubmit(event) {
  event.preventDefault();

  const emailInput = document.querySelector("[data-testid='login-email']");
  const messageEl = document.querySelector("[data-testid='login-message']");

  const email = emailInput.value.trim();

  const result = loginService.login(email);

  messageEl.textContent = result.message;

  if (result.success) {
    renderPage("dashboard");
  }
}