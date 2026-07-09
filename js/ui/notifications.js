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

      <div data-testid="notifications-list">
        ${notifications
          .map(renderNotificationCard)
          .join("")}
      </div>
    </section>
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
    </article>
  `;
}