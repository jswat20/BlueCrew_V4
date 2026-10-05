const messagingService = (() => {
  let center = { conversations: [], announcements: [], recipients: [] };
  let hydrationState = { status: "idle", message: "" };
  let realtimeChannel = null;
  let subscriptionEpoch = 0;
  let subscriptionState = { status: "idle", message: "" };

  function hosted() {
    return typeof supabaseClientService !== "undefined" && supabaseClientService.isConfigured();
  }

  function clone(value) { return structuredClone(value); }
  function currentProfileId() { return authService.getCurrentUser?.()?.id || ""; }
  function currentRole() { return authorizationService.currentRole(); }
  function localRepository() { return repositoryProvider.get("messages"); }
  function emptyState() { return { conversations: [], announcements: [] }; }
  function readLocal() { return localRepository().read() || emptyState(); }
  function writeLocal(value) { localRepository().write(value); }
  function now() { return new Date().toISOString(); }
  function id(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
  function setSubscriptionState(status, message = "") {
    subscriptionState = { status, message };
    if (typeof document !== "undefined" && document.body) document.body.dataset.messagingRealtimeStatus = status;
  }

  function localRecipients() {
    return crewService.getAll().filter(member => member.active !== false).map(member => ({
      profileId: member.profileId || member.id,
      name: member.name || `${member.firstName || ""} ${member.lastName || ""}`.trim() || "Umpire",
      eligibleLevels: member.levels || member.eligibleLevels || []
    }));
  }

  function mapLocalCenter() {
    const state = readLocal();
    const actor = currentProfileId();
    const isAdmin = currentRole() === "administrator";
    const conversations = state.conversations.filter(item => isAdmin || String(item.umpireProfileId) === String(actor));
    const announcements = state.announcements.filter(item => isAdmin || item.recipientProfileIds.includes(actor)).map(item => ({
      ...item,
      recipientCount: item.recipientProfileIds.length,
      viewedCount: item.readProfileIds.length,
      read: item.readProfileIds.includes(actor)
    }));
    const visibleConversations = conversations.map(item => ({ ...item, messages: item.messages.filter(message => !(message.deletedBy || []).includes(String(actor))) })).filter(item => item.messages.length);
    return { conversations: visibleConversations, announcements: announcements.filter(item => !(item.deletedBy || []).includes(String(actor))), recipients: isAdmin ? localRecipients() : [] };
  }

  async function hydrate() {
    hydrationState = { status: "loading", message: "" };
    try {
      if (hosted()) {
        const result = await supabaseMessagingRepository.loadCenter();
        if (result.error) throw result.error;
        center = result.data || { conversations: [], announcements: [], recipients: [] };
      } else center = mapLocalCenter();
      hydrationState = { status: "ready", message: "" };
      updateMessageBadge?.();
      return { success: true, data: getCenter() };
    } catch (error) {
      hydrationState = { status: "error", message: error?.message || "Messages could not be loaded." };
      return { success: false, message: hydrationState.message };
    }
  }

  async function sendDirect(input) {
    if (!["administrator", "umpire"].includes(currentRole())) return { success: false, message: "Messaging access is not available for this role." };
    if (!String(input?.body || "").trim()) return { success: false, message: "Enter a message." };
    if (hosted()) {
      const result = await supabaseMessagingRepository.sendDirect(input);
      if (result.error) return { success: false, message: result.error.message };
    } else {
      const state = readLocal();
      const actor = currentProfileId();
      const isAdmin = currentRole() === "administrator";
      const umpireProfileId = isAdmin ? input.umpireProfileId : actor;
      if (isAdmin && !localRecipients().some(item => String(item.profileId) === String(umpireProfileId))) {
        return { success: false, message: "Choose an approved umpire." };
      }
      let conversation = state.conversations.find(item => String(item.umpireProfileId) === String(umpireProfileId));
      if (!conversation) {
        const recipient = localRecipients().find(item => String(item.profileId) === String(umpireProfileId));
        conversation = { id: id("conversation"), umpireProfileId, umpireName: recipient?.name || authService.currentUserName(), subject: input.subject || "", updatedAt: now(), unreadCount: 0, messages: [] };
        state.conversations.push(conversation);
      }
      conversation.subject = input.subject || conversation.subject;
      conversation.updatedAt = now();
      conversation.messages.push({ id: id("message"), senderProfileId: actor, senderName: authService.currentUserName(), senderRole: currentRole(), body: input.body.trim(), announcementId: input.announcementId || null, createdAt: conversation.updatedAt });
      conversation.unreadCount = 0;
      writeLocal(state);
    }
    await hydrate();
    return { success: true, message: "Message sent." };
  }

  async function sendDirectToRecipients(input) {
    if (currentRole() !== "administrator") return { success: false, message: "Administrator access is required." };
    const recipients = [...new Set((input?.umpireProfileIds || []).map(String))];
    if (!recipients.length) return { success: false, message: "Choose at least one umpire." };
    const body = String(input?.body || "").trim();
    if (!body || body.length > 5000) return { success: false, message: "Enter a message of up to 5,000 characters." };
    if (hosted()) {
      const result = await supabaseMessagingRepository.sendDirectToRecipients({ ...input, body, umpireProfileIds: recipients });
      if (result.error) return { success: false, message: result.error.message };
    } else {
      const eligible = localRecipients();
      if (recipients.some(profileId => !eligible.some(item => String(item.profileId) === profileId))) {
        return { success: false, message: "Choose approved umpires." };
      }
      const state = readLocal();
      for (const profileId of recipients) {
        const recipient = eligible.find(item => String(item.profileId) === profileId);
        let conversation = state.conversations.find(item => String(item.umpireProfileId) === profileId);
        if (!conversation) {
          conversation = { id: id("conversation"), umpireProfileId: recipient.profileId, umpireName: recipient.name, subject: "", unreadCount: 0, messages: [] };
          state.conversations.push(conversation);
        }
        conversation.subject = input.subject || conversation.subject;
        conversation.updatedAt = now();
        conversation.messages.push({ id: id("message"), senderProfileId: currentProfileId(), senderName: authService.currentUserName(), senderRole: currentRole(), body, announcementId: null, createdAt: conversation.updatedAt });
        conversation.unreadCount = 0;
      }
      writeLocal(state);
    }
    await hydrate();
    return { success: true, message: `Message sent to ${recipients.length} ${recipients.length === 1 ? "umpire" : "umpires"}.` };
  }

  async function sendAnnouncement(input) {
    if (currentRole() !== "administrator") return { success: false, message: "Administrator access is required." };
    if (hosted()) {
      const result = await supabaseMessagingRepository.sendAnnouncement(input);
      if (result.error) return { success: false, message: result.error.message };
    } else {
      const state = readLocal();
      const recipients = localRecipients().filter(recipient => input.targetType === "all_umpires" || recipient.eligibleLevels.some(level => String(level).toLowerCase() === String(input.targetValue).toLowerCase()));
      if (!recipients.length) return { success: false, message: "That group has no eligible approved umpires." };
      state.announcements.unshift({ id: id("announcement"), subject: input.subject.trim(), body: input.body.trim(), targetType: input.targetType, targetValue: input.targetValue || null, createdAt: now(), recipientProfileIds: recipients.map(item => item.profileId), readProfileIds: [] });
      writeLocal(state);
    }
    await hydrate();
    return { success: true, message: "Announcement sent." };
  }

  async function deleteMessage(input) {
    if (!["administrator", "umpire"].includes(currentRole())) return { success: false, message: "Messaging access is not available for this role." };
    const visible = getCenter();
    const allowed = input.messageId ? visible.conversations.some(c => c.messages.some(m => String(m.id) === String(input.messageId))) : visible.announcements.some(a => String(a.id) === String(input.announcementId));
    if (!allowed) return { success: false, message: "Message is unavailable." };
    if (hosted()) {
      const result = await supabaseMessagingRepository.deleteMessage(input);
      if (result.error) return { success: false, message: result.error.message };
    } else {
      const state = readLocal();
      const item = input.messageId ? state.conversations.flatMap(c => c.messages).find(m => String(m.id) === String(input.messageId)) : state.announcements.find(a => String(a.id) === String(input.announcementId));
      item.deletedBy = [...new Set([...(item.deletedBy || []), String(currentProfileId())])];
      writeLocal(state);
    }
    await hydrate();
    return { success: true, message: "Deleted from your messages." };
  }

  async function markRead(input) {
    if (hosted()) {
      const result = await supabaseMessagingRepository.markRead(input);
      if (result.error) return { success: false, message: result.error.message };
    } else {
      const state = readLocal();
      const actor = currentProfileId();
      if (input.conversationId) {
        const item = state.conversations.find(value => value.id === input.conversationId);
        if (item) item.unreadCount = 0;
      }
      if (input.announcementId) {
        const item = state.announcements.find(value => value.id === input.announcementId);
        if (item?.recipientProfileIds.includes(actor) && !item.readProfileIds.includes(actor)) item.readProfileIds.push(actor);
      }
      writeLocal(state);
    }
    await hydrate();
    return { success: true };
  }

  async function subscribe() {
    if (!hosted() || realtimeChannel || !["administrator", "umpire"].includes(currentRole())) return;
    const db = await supabaseClientService.getClient();
    if (typeof db.channel !== "function") return;
    const { data: sessionData, error: sessionError } = await db.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (sessionError || !accessToken) {
      setSubscriptionState("auth_error", "Live message updates require an authenticated session.");
      return;
    }
    await db.realtime?.setAuth?.(accessToken);
    const epoch = ++subscriptionEpoch;
    setSubscriptionState("connecting");
    realtimeChannel = db.channel(`message-center-${currentProfileId()}`);
    ["messages", "message_receipts", "message_announcements", "message_announcement_recipients"].forEach(table => {
      realtimeChannel.on("postgres_changes", { event: "*", schema: "public", table }, async () => {
        if (epoch !== subscriptionEpoch || !["administrator", "umpire"].includes(currentRole())) return;
        await hydrate();
        if (document.body.dataset.page === "messages") renderPage("messages", currentPageContext || {});
      });
    });
    realtimeChannel.subscribe(status => {
      if (epoch !== subscriptionEpoch) return;
      setSubscriptionState(
        String(status || "unknown").toLowerCase(),
        ["CHANNEL_ERROR", "TIMED_OUT"].includes(status) ? "Live message updates are temporarily unavailable." : ""
      );
    });
  }

  async function unsubscribe() {
    subscriptionEpoch += 1;
    setSubscriptionState("idle");
    const channel = realtimeChannel;
    realtimeChannel = null;
    if (!channel || !hosted()) return;
    const db = await supabaseClientService.getClient();
    if (typeof db.removeChannel === "function") await db.removeChannel(channel);
  }

  function clear() { center = { conversations: [], announcements: [], recipients: [] }; hydrationState = { status: "idle", message: "" }; unsubscribe(); }
  function getCenter() { return clone(center); }
  function getHydrationState() { return { ...hydrationState }; }
  function getSubscriptionState() { return { ...subscriptionState }; }
  function getUnreadCount() { return center.conversations.reduce((sum, item) => sum + Number(item.unreadCount || 0), 0) + center.announcements.filter(item => !item.read && currentRole() === "umpire").length; }

  return { deleteMessage, hydrate, sendDirect, sendDirectToRecipients, sendAnnouncement, markRead, subscribe, unsubscribe, clear, getCenter, getHydrationState, getSubscriptionState, getUnreadCount };
})();
