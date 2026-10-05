const supabaseMessagingRepository = (() => {
  const client = () => supabaseClientService.getClient();

  async function loadCenter() {
    const db = await client();
    return db.rpc("get_message_center");
  }

  async function sendDirect({ body, umpireProfileId = null, subject = "", announcementId = null }) {
    const db = await client();
    return db.rpc("send_direct_message", {
      p_body: body,
      p_umpire_profile_id: umpireProfileId,
      p_subject: subject,
      p_announcement_id: announcementId
    });
  }

  async function sendDirectToRecipients({ body, umpireProfileIds, subject = "" }) {
    const db = await client();
    return db.rpc("send_direct_messages", {
      p_body: body, p_umpire_profile_ids: umpireProfileIds, p_subject: subject
    });
  }

  async function sendAnnouncement({ targetType, targetValue = null, subject, body }) {
    const db = await client();
    return db.rpc("send_message_announcement", {
      p_target_type: targetType,
      p_target_value: targetValue,
      p_subject: subject,
      p_body: body
    });
  }

  async function markRead({ conversationId = null, announcementId = null }) {
    const db = await client();
    return db.rpc("mark_message_center_read", {
      p_conversation_id: conversationId,
      p_announcement_id: announcementId
    });
  }

  async function deleteMessage({ messageId = null, announcementId = null }) {
    const db = await client();
    return db.rpc("delete_message_for_me", { p_message_id: messageId, p_announcement_id: announcementId });
  }

  return { deleteMessage, loadCenter, sendDirect, sendDirectToRecipients, sendAnnouncement, markRead };
})();
