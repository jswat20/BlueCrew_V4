function renderNotifications() {
  const notifications = notificationService.getAll();

  if (!notifications.length) {
    return `
      <section class="page-section" data-testid="notifications">
        <h2>Notifications</h2>

        <div
          class="empty-state"
          data-testid="notifications-empty"
        >
          You have no notifications.
        </div>
      </section>
    `;
  }

  return `
    <section class="page-section" data-testid="notifications">
      <h2>Notifications</h2>

${renderMarkAllNotificationsReadButton()}

      <div data-testid="notifications-list">
        ${notifications
          .map(renderNotificationCard)
          .join("")}
      </div>
    </section>
  `;
}

function handleMarkAllNotificationsRead() {
  notificationService.markAllAsRead();
  renderPage("notifications");
}

function renderMarkAllNotificationsReadButton() {
  if (!notificationService.getUnreadCount()) return "";

  return `
    <button
      type="button"
      data-testid="notifications-mark-all-read"
      onclick="handleMarkAllNotificationsRead()"
    >
      Mark All as Read
    </button>
  `;
}

function renderNotificationCard(notification) {
  return `
    <article
      class="notification-card"
      data-testid="notification-card"
    >
      <h3>${notification.title}</h3>

      <p>${notification.message}</p>

      <small>
        ${notification.createdAt}
      </small>

      ${
        notification.read
          ? ""
          : `
            <button
              type="button"
              data-testid="notification-mark-read"
              data-notification-id="${notification.id}"
              onclick="handleMarkNotificationRead(this.dataset.notificationId)"
            >
              Mark as Read
            </button>
          `
      }
    </article>
  `;
}

function handleMarkNotificationRead(notificationId) {
  const result = notificationService.markAsRead(notificationId);

  if (!result.success) return;

  renderPage("notifications");
}

function handleMarkAllNotificationsRead() {
  const result = notificationService.markAllAsRead();

  if (!result.success) return;

  renderPage("notifications");
}