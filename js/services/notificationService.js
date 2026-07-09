const notificationService = (() => {
  const STORAGE_KEY = "bluecrew_notifications";

  function getAll() {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (!stored) return [];

    try {
      const notifications = JSON.parse(stored);
      return Array.isArray(notifications) ? notifications : [];
    } catch {
      return [];
    }
  }

  function saveAll(notifications) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  }

  function create({
    type = "general",
    title,
    message,
    relatedId = "",
    audience = "admin"
  } = {}) {
    if (!title || !message) {
      return {
        success: false,
        message: "Notification requires a title and message."
      };
    }

    const notifications = getAll();

    const notification = {
      id: `notification-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type,
      title,
      message,
      relatedId,
      audience,
      read: false,
      createdAt: new Date().toISOString()
    };

    notifications.unshift(notification);
    saveAll(notifications);

    return {
      success: true,
      message: "Notification created.",
      data: notification
    };
  }

  function getUnread() {
    return getAll().filter(notification => !notification.read);
  }

  function getRead() {
    return getAll().filter(notification => notification.read);
  }

  function getUnreadCount() {
    return getUnread().length;
  }

  function markAsRead(notificationId) {
    const notifications = getAll();
    const notification = notifications.find(item => item.id === notificationId);

    if (!notification) {
      return {
        success: false,
        message: "Notification not found."
      };
    }

    notification.read = true;
    saveAll(notifications);

    return {
      success: true,
      message: "Notification marked as read.",
      data: notification
    };
  }

  function markAllAsRead() {
    const notifications = getAll();

    notifications.forEach(notification => {
      notification.read = true;
    });

    saveAll(notifications);

    return {
      success: true,
      message: "All notifications marked as read."
    };
  }

  function clearAll() {
    saveAll([]);

    return {
      success: true,
      message: "Notifications cleared."
    };
  }

  return {
    getAll,
    create,
    getUnread,
    getRead,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    clearAll
  };
})();