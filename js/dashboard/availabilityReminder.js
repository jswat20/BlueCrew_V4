// js/dashboard/availabilityReminder.js

function renderAvailabilityReminder() {
  const reminder =
    dashboardService.getAvailabilityReminder();

  return `
    <section
      class="
        dashboard-card
        availability-reminder
        availability-reminder-${reminder.severity}
      "
      data-testid="dashboard-availability"
      data-severity="${reminder.severity}">

      <div class="card-header">
        <h2>Availability</h2>

        <span
          class="
            availability-reminder-status
            availability-reminder-status-${reminder.severity}
          "
          data-testid="dashboard-availability-severity">
          ${formatAvailabilityReminderSeverity(
            reminder.severity
          )}
        </span>
      </div>

      <div class="availability-reminder-content">
        <strong
          data-testid="dashboard-availability-title">
          ${reminder.title}
        </strong>

        <p
          data-testid="dashboard-availability-message">
          ${reminder.message}
        </p>
      </div>

      <button
        type="button"
        class="secondary-btn"
        data-testid="dashboard-availability-action"
        onclick="
          handleAvailabilityReminderClick(
            '${reminder.action}'
          )
        ">
        Manage Availability
      </button>
    </section>
  `;
}

function formatAvailabilityReminderSeverity(
  severity
) {
  switch (severity) {
    case "success":
      return "Good";

    case "warning":
      return "Attention";

    default:
      return "Update";
  }
}

function handleAvailabilityReminderClick(action) {
  if (action === "availability") {
    renderPage("availability");
    return;
  }

  renderPage("dashboard");
}
