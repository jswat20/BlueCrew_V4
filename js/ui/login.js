// js/ui/login.js

function renderLogin(context = {}) {
  const usesSupabaseAuth = typeof supabaseClientService !== "undefined" && supabaseClientService.isConfigured();
  return `
    <section class="panel" data-testid="login-page">
      <h2>Umpire Login</h2>

      <p class="muted">
        ${usesSupabaseAuth ? "Enter your verified email and password to continue." : "Enter your email to continue."}
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

        ${usesSupabaseAuth ? `
        <div class="form-group">
          <label for="login-password">Password</label>
          <input
            id="login-password"
            data-testid="login-password"
            type="password"
            autocomplete="current-password"
            required
          />
        </div>` : ""}

        <button type="submit" data-testid="login-submit">
          Log In
        </button>
        ${usesSupabaseAuth ? `<button type="button" class="button button-link" data-testid="forgot-password-link" onclick="renderPage('forgot-password')">Forgot Password?</button>` : ""}
      </form>

      <div
        class="form-message"
        data-testid="login-message"
        aria-live="polite"
      >${context.passwordMessage ? escapeSharedStateHtml(context.passwordMessage) : ""}</div>
    </section>
    ${usesSupabaseAuth && typeof renderAccountRegistration === "function"
      ? renderAccountRegistration()
      : ""}
  `;
}

async function handleLoginSubmit(event) {
  event.preventDefault();

  const emailInput = document.querySelector("[data-testid='login-email']");
  const messageEl = document.querySelector("[data-testid='login-message']");

  const email = emailInput.value.trim();
  const usesSupabaseAuth = typeof supabaseClientService !== "undefined" && supabaseClientService.isConfigured();
  const result = usesSupabaseAuth
    ? await loginService.loginWithPassword(
        email,
        document.querySelector("[data-testid='login-password']").value
      )
    : loginService.login(email);

  messageEl.textContent = result.message;

  if (result.success) {
        if (
      typeof authService !== "undefined" &&
      authService.isUmpire() &&
      typeof notificationService !== "undefined" &&
      typeof notificationService
        .generateUpcomingGameReminders ===
        "function"
    ) {
      notificationService
        .generateUpcomingGameReminders();
    }

renderPage("dashboard");
  } else if (result.data && supabaseAuthService.getHydrationState().authenticated === true) {
    document.body.dataset.role = result.data.role;
    refreshNavigationAuthorization?.();
    renderPage("dashboard");
  }
}
