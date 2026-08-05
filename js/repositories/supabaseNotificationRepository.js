const supabaseNotificationRepository = (() => {
  const client = () => supabaseClientService.getClient();

  async function getNotifications() {
    const db = await client();
    return db.from("notifications")
      .select("id,organization_id,type,audience,recipient_profile_id,title,message,related_legacy_id,destination_page,destination_context,reminder_key,read_at,created_at")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
  }

  async function markRead(notificationId) {
    const db = await client();
    return db.rpc("mark_notification_read", { p_notification_id: notificationId });
  }

  async function markAllRead() {
    const db = await client();
    return db.rpc("mark_all_notifications_read");
  }

  return { getNotifications, markRead, markAllRead };
})();
