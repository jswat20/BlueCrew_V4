function escapeMessageHtml(value) {
  return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function messageDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function renderMessageThread(conversation) {
  const actor = authService.getCurrentUser?.()?.id;
  return `<article class="message-thread" data-testid="message-thread-${escapeMessageHtml(conversation.id)}">
    <header><div><h3>${escapeMessageHtml(conversation.umpireName || "Conversation")}</h3><p>${escapeMessageHtml(conversation.subject || "Private administrator and umpire conversation")}</p></div>${conversation.unreadCount ? `<span class="message-unread">${conversation.unreadCount} unread</span>` : ""}</header>
    <div class="message-history">${(conversation.messages || []).map(message => `<div class="message-bubble ${String(message.senderProfileId) === String(actor) ? "is-mine" : ""}"><strong>${escapeMessageHtml(message.senderName || (message.senderRole === "administrator" ? "Administrator" : "Umpire"))}</strong><p>${escapeMessageHtml(message.body)}</p><time>${escapeMessageHtml(messageDate(message.createdAt))}</time></div>`).join("") || '<p class="placeholder">No messages yet.</p>'}</div>
    <form class="message-reply-form" data-conversation-id="${escapeMessageHtml(conversation.id)}" data-umpire-profile-id="${escapeMessageHtml(conversation.umpireProfileId)}"><label>Reply<textarea name="body" maxlength="5000" required></textarea></label><button class="button button-primary" type="submit">Send Reply</button><p class="form-status" role="status"></p></form>
  </article>`;
}

function renderAnnouncementCard(item, isAdmin) {
  const target = item.targetType === "all_umpires" ? "All Umpires" : `${item.targetValue} Umpires`;
  return `<article class="message-announcement ${item.read === false ? "is-unread" : ""}" data-testid="announcement-${escapeMessageHtml(item.id)}">
    <header><div><span class="message-kicker">Announcement · ${escapeMessageHtml(target)}</span><h3>${escapeMessageHtml(item.subject)}</h3></div><time>${escapeMessageHtml(messageDate(item.createdAt))}</time></header>
    <p>${escapeMessageHtml(item.body)}</p>
    ${isAdmin ? `<p class="message-view-count">${item.viewedCount || 0} of ${item.recipientCount || 0} viewed</p>` : `<button class="button button-secondary message-announcement-reply" data-announcement-id="${escapeMessageHtml(item.id)}" type="button">Reply Privately to Admin</button>`}
  </article>`;
}

function renderMessages(context = {}) {
  const state = messagingService.getHydrationState();
  const center = messagingService.getCenter();
  const isAdmin = authorizationService.currentRole() === "administrator";
  const activeTab = context.tab || "inbox";
  if (state.status === "loading" || state.status === "idle") return '<section class="card" data-testid="messages-loading"><p>Loading messages…</p></section>';
  if (state.status === "error") return `<section class="card" role="alert"><h2>Messages unavailable</h2><p>${escapeMessageHtml(state.message)}</p><button class="button button-primary" data-testid="messages-retry">Retry</button></section>`;

  const levels = [...new Set(["6U", "8U", ...center.recipients.flatMap(item => item.eligibleLevels || [])])].sort();
  return `<section class="message-center" data-testid="message-center">
    <div class="message-toolbar"><div class="message-tabs" role="tablist">
      <button type="button" role="tab" data-message-tab="inbox" aria-selected="${activeTab === "inbox"}">Inbox / Conversations</button>
      <button type="button" role="tab" data-message-tab="announcements" aria-selected="${activeTab === "announcements"}">Announcements</button>
      ${isAdmin ? `<button type="button" role="tab" data-message-tab="sent" aria-selected="${activeTab === "sent"}">Sent</button>` : ""}
    </div><button type="button" class="button button-primary" data-testid="new-message">New Message</button></div>
    <div class="message-compose" data-testid="message-compose" hidden>
      <form data-testid="message-compose-form">
        ${isAdmin ? `<fieldset><legend>Send to</legend><label><input type="radio" name="kind" value="individual" checked> Individual</label><label><input type="radio" name="kind" value="group"> Group announcement</label></fieldset>
          <label data-compose-individual>Approved umpire<select name="umpireProfileId" required><option value="">Choose an umpire</option>${center.recipients.map(item => `<option value="${escapeMessageHtml(item.profileId)}">${escapeMessageHtml(item.name)}</option>`).join("")}</select></label>
          <label data-compose-group hidden>Group<select name="group"><option value="all_umpires">All Umpires</option>${levels.map(level => `<option value="level:${escapeMessageHtml(level)}">${escapeMessageHtml(level)} Umpires</option>`).join("")}</select></label>` : '<p>Your message will be private to organization administrators.</p>'}
        <label>Subject<input name="subject" maxlength="160" ${isAdmin ? "required" : "placeholder=\"Optional\""}></label>
        <label>Message<textarea name="body" maxlength="5000" required></textarea></label>
        <div class="form-actions"><button class="button button-primary" type="submit">Send</button><button class="button button-secondary" type="button" data-compose-cancel>Cancel</button></div><p class="form-status" role="status"></p>
      </form>
    </div>
    <div class="message-panel" ${activeTab !== "inbox" ? "hidden" : ""}>${center.conversations.map(renderMessageThread).join("") || '<div class="card"><p class="placeholder">No conversations yet.</p></div>'}</div>
    <div class="message-panel" ${activeTab !== "announcements" ? "hidden" : ""}>${center.announcements.map(item => renderAnnouncementCard(item, isAdmin)).join("") || '<div class="card"><p class="placeholder">No announcements yet.</p></div>'}</div>
    ${isAdmin ? `<div class="message-panel" ${activeTab !== "sent" ? "hidden" : ""}>${center.conversations.filter(item => (item.messages || []).some(message => message.senderRole === "administrator")).map(renderMessageThread).join("") || '<div class="card"><p class="placeholder">No sent messages yet.</p></div>'}</div>` : ""}
  </section>`;
}

function setupMessagesPage(context = {}) {
  const root = document.querySelector('[data-testid="message-center"]');
  if (!root) {
    document.querySelector('[data-testid="messages-retry"]')?.addEventListener("click", async () => { await messagingService.hydrate(); renderPage("messages", context); });
    return;
  }
  root.querySelectorAll("[data-message-tab]").forEach(button => button.addEventListener("click", () => renderPage("messages", { tab: button.dataset.messageTab })));
  const compose = root.querySelector('[data-testid="message-compose"]');
  root.querySelector('[data-testid="new-message"]')?.addEventListener("click", () => { compose.hidden = false; compose.querySelector("textarea")?.focus(); });
  root.querySelector("[data-compose-cancel]")?.addEventListener("click", () => { compose.hidden = true; });
  root.querySelectorAll('input[name="kind"]').forEach(input => input.addEventListener("change", () => {
    const group = input.form.elements.kind.value === "group";
    root.querySelector("[data-compose-individual]").hidden = group;
    root.querySelector("[data-compose-group]").hidden = !group;
    input.form.elements.umpireProfileId.required = !group;
  }));
  root.querySelector('[data-testid="message-compose-form"]')?.addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const isGroup = data.get("kind") === "group";
    let result;
    if (isGroup) {
      const group = String(data.get("group"));
      result = await messagingService.sendAnnouncement({ targetType: group === "all_umpires" ? "all_umpires" : "eligible_level", targetValue: group.startsWith("level:") ? group.slice(6) : null, subject: data.get("subject"), body: data.get("body") });
    } else result = await messagingService.sendDirect({ umpireProfileId: data.get("umpireProfileId") || null, subject: data.get("subject"), body: data.get("body"), announcementId: compose.dataset.announcementId || null });
    form.querySelector(".form-status").textContent = result.message;
    if (result.success) renderPage("messages", { tab: isGroup ? "announcements" : "inbox" });
  });
  root.querySelectorAll(".message-panel:not([hidden]) .message-reply-form").forEach(form => {
    messagingService.markRead({ conversationId: form.dataset.conversationId });
    form.addEventListener("submit", async event => {
      event.preventDefault(); const body = new FormData(form).get("body");
      const result = await messagingService.sendDirect({ umpireProfileId: form.dataset.umpireProfileId, body });
      form.querySelector(".form-status").textContent = result.message;
      if (result.success) renderPage("messages", { tab: "inbox" });
    });
  });
  root.querySelectorAll(".message-announcement-reply").forEach(button => button.addEventListener("click", async () => {
    await messagingService.markRead({ announcementId: button.dataset.announcementId });
    compose.hidden = false; compose.dataset.announcementId = button.dataset.announcementId; compose.querySelector("textarea")?.focus();
  }));
  if ((context.tab || "inbox") === "announcements") {
    const centerUnreadAnnouncements = messagingService.getCenter().announcements.filter(item => item.read === false);
    centerUnreadAnnouncements.forEach(item => messagingService.markRead({ announcementId: item.id }));
  }
}

window.renderMessages = renderMessages;
window.setupMessagesPage = setupMessagesPage;
