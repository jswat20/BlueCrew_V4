function escapeMessageHtml(value) {
  return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function messageDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function messagePreview(value, length = 90) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

function messageContext(context = {}, isAdmin = false) {
  const allowedTabs = isAdmin ? ["inbox", "announcements", "sent"] : ["inbox", "announcements"];
  return {
    tab: allowedTabs.includes(context.tab) ? context.tab : "inbox",
    composerOpen: context.composerOpen === true,
    composeKind: context.composeKind === "group" ? "group" : "individual",
    announcementId: String(context.announcementId || ""),
    expandedConversationId: String(context.expandedConversationId || ""),
    expandedAnnouncementId: String(context.expandedAnnouncementId || "")
  };
}

function nextMessageContext(context, updates = {}) {
  return { ...context, ...updates };
}

function renderMessageThread(conversation, context) {
  const actor = authService.getCurrentUser?.()?.id;
  const id = String(conversation.id || "");
  const expanded = context.expandedConversationId === id;
  const latest = (conversation.messages || []).at(-1);
  const contentId = `message-thread-content-${id}`;
  return `<article class="message-thread ${expanded ? "is-expanded" : ""}" data-testid="message-thread-${escapeMessageHtml(id)}">
    <button class="message-card-toggle" type="button" data-conversation-toggle="${escapeMessageHtml(id)}" aria-expanded="${expanded}" aria-controls="${escapeMessageHtml(contentId)}">
      <span class="message-card-heading"><strong>${escapeMessageHtml(conversation.umpireName || "Conversation")}</strong><span>${escapeMessageHtml(conversation.subject || "Private administrator and umpire conversation")}</span></span>
      <span class="message-card-summary">${conversation.unreadCount ? `<span class="message-unread">${conversation.unreadCount} unread</span>` : ""}${latest ? `<span class="message-preview">${escapeMessageHtml(messagePreview(latest.body))}</span><time>${escapeMessageHtml(messageDate(latest.createdAt))}</time>` : ""}<span class="message-chevron" aria-hidden="true">⌄</span></span>
    </button>
    ${expanded ? `<div class="message-card-content" id="${escapeMessageHtml(contentId)}">
      <div class="message-history">${(conversation.messages || []).map(message => `<div class="message-bubble ${String(message.senderProfileId) === String(actor) ? "is-mine" : ""}"><strong>${escapeMessageHtml(message.senderName || (message.senderRole === "administrator" ? "Administrator" : "Umpire"))}</strong><p>${escapeMessageHtml(message.body)}</p><time>${escapeMessageHtml(messageDate(message.createdAt))}</time></div>`).join("") || '<p class="placeholder">No messages yet.</p>'}</div>
      <form class="message-reply-form" data-conversation-id="${escapeMessageHtml(id)}" data-umpire-profile-id="${escapeMessageHtml(conversation.umpireProfileId)}"><label>Reply<textarea name="body" maxlength="5000" required></textarea></label><button class="button button-primary" type="submit">Send Reply</button><p class="form-status" role="status"></p></form>
    </div>` : ""}
  </article>`;
}

function renderAnnouncementCard(item, isAdmin, context) {
  const id = String(item.id || "");
  const expanded = context.expandedAnnouncementId === id;
  const target = item.targetType === "all_umpires" ? "All Umpires" : `${item.targetValue} Umpires`;
  const contentId = `message-announcement-content-${id}`;
  return `<article class="message-announcement ${item.read === false ? "is-unread" : ""} ${expanded ? "is-expanded" : ""}" data-testid="announcement-${escapeMessageHtml(id)}">
    <button class="message-card-toggle" type="button" data-announcement-toggle="${escapeMessageHtml(id)}" aria-expanded="${expanded}" aria-controls="${escapeMessageHtml(contentId)}">
      <span class="message-card-heading"><span class="message-kicker">Announcement · ${escapeMessageHtml(target)}</span><strong>${escapeMessageHtml(item.subject)}</strong></span>
      <span class="message-card-summary"><span class="message-preview">${escapeMessageHtml(messagePreview(item.body))}</span><time>${escapeMessageHtml(messageDate(item.createdAt))}</time><span class="message-chevron" aria-hidden="true">⌄</span></span>
    </button>
    ${expanded ? `<div class="message-card-content" id="${escapeMessageHtml(contentId)}"><p class="message-announcement-body">${escapeMessageHtml(item.body)}</p>
      ${isAdmin ? `<p class="message-view-count">${item.viewedCount || 0} of ${item.recipientCount || 0} viewed</p>` : `<button class="button button-secondary message-announcement-reply" data-announcement-id="${escapeMessageHtml(id)}" type="button">Reply Privately to Admin</button>`}
    </div>` : ""}
  </article>`;
}

function renderMessages(context = {}) {
  const state = messagingService.getHydrationState();
  const center = messagingService.getCenter();
  const isAdmin = authorizationService.currentRole() === "administrator";
  const view = messageContext(context, isAdmin);
  if (state.status === "loading" || state.status === "idle") return '<section class="card" data-testid="messages-loading"><p>Loading messages…</p></section>';
  if (state.status === "error") return `<section class="card" role="alert"><h2>Messages unavailable</h2><p>${escapeMessageHtml(state.message)}</p><button class="button button-primary" data-testid="messages-retry">Retry</button></section>`;

  const levels = [...new Set(["6U", "8U", ...center.recipients.flatMap(item => item.eligibleLevels || [])])].sort();
  let activePanel;
  if (view.tab === "announcements") {
    activePanel = center.announcements.map(item => renderAnnouncementCard(item, isAdmin, view)).join("") || '<div class="card"><p class="placeholder">No announcements yet.</p></div>';
  } else {
    const conversations = view.tab === "sent"
      ? center.conversations.filter(item => (item.messages || []).some(message => message.senderRole === "administrator"))
      : center.conversations;
    activePanel = conversations.map(item => renderMessageThread(item, view)).join("") || `<div class="card"><p class="placeholder">${view.tab === "sent" ? "No sent messages yet." : "No conversations yet."}</p></div>`;
  }

  const individualMode = view.composeKind !== "group";
  return `<section class="message-center" data-testid="message-center" data-active-tab="${escapeMessageHtml(view.tab)}">
    <div class="message-toolbar"><div class="message-tabs" role="tablist" aria-label="Message views">
      <button type="button" role="tab" data-message-tab="inbox" aria-selected="${view.tab === "inbox"}">Inbox / Conversations</button>
      <button type="button" role="tab" data-message-tab="announcements" aria-selected="${view.tab === "announcements"}">Announcements</button>
      ${isAdmin ? `<button type="button" role="tab" data-message-tab="sent" aria-selected="${view.tab === "sent"}">Sent</button>` : ""}
    </div><button type="button" class="button button-primary" data-testid="new-message" aria-expanded="${view.composerOpen}" aria-controls="message-compose">New Message</button></div>
    ${view.composerOpen ? `<div class="message-compose" data-testid="message-compose" id="message-compose">
      <form data-testid="message-compose-form">
        ${isAdmin ? `<fieldset><legend>Send to</legend><label><input type="radio" name="kind" value="individual" ${individualMode ? "checked" : ""}> Individual</label><label><input type="radio" name="kind" value="group" ${individualMode ? "" : "checked"}> Group announcement</label></fieldset>
          <label data-compose-individual class="${individualMode ? "" : "is-disabled"}">Recipient<select name="umpireProfileId" ${individualMode ? "required" : "disabled"}><option value="">Choose an umpire</option>${center.recipients.map(item => `<option value="${escapeMessageHtml(item.profileId)}">${escapeMessageHtml(item.name)}</option>`).join("")}</select></label>
          <label data-compose-group class="${individualMode ? "is-disabled" : ""}">Group<select name="group" ${individualMode ? "disabled" : ""}><option value="all_umpires">All Umpires</option>${levels.map(level => `<option value="level:${escapeMessageHtml(level)}">${escapeMessageHtml(level)} Umpires</option>`).join("")}</select></label>` : '<p>Your message will be private to organization administrators.</p>'}
        <label>Subject<input name="subject" maxlength="160" ${isAdmin ? "required" : 'placeholder="Optional"'}></label>
        <label>Message<textarea name="body" maxlength="5000" required></textarea></label>
        <div class="form-actions"><button class="button button-primary" type="submit">Send</button><button class="button button-secondary" type="button" data-compose-cancel>Cancel</button></div><p class="form-status" role="status"></p>
      </form>
    </div>` : ""}
    <div class="message-panel" role="tabpanel" data-testid="message-panel-${escapeMessageHtml(view.tab)}">${activePanel}</div>
  </section>`;
}

function setupMessagesPage(context = {}) {
  const root = document.querySelector('[data-testid="message-center"]');
  if (!root) {
    document.querySelector('[data-testid="messages-retry"]')?.addEventListener("click", async () => { await messagingService.hydrate(); renderPage("messages", context); });
    return;
  }
  const isAdmin = authorizationService.currentRole() === "administrator";
  const view = messageContext(context, isAdmin);
  root.querySelectorAll("[data-message-tab]").forEach(button => button.addEventListener("click", () => renderPage("messages", nextMessageContext(view, {
    tab: button.dataset.messageTab, composerOpen: false, announcementId: "", expandedConversationId: "", expandedAnnouncementId: ""
  }))));
  root.querySelector('[data-testid="new-message"]')?.addEventListener("click", () => renderPage("messages", nextMessageContext(view, { composerOpen: !view.composerOpen, announcementId: "" })));
  root.querySelector("[data-compose-cancel]")?.addEventListener("click", () => renderPage("messages", nextMessageContext(view, { composerOpen: false, composeKind: "individual", announcementId: "" })));
  root.querySelectorAll('input[name="kind"]').forEach(input => input.addEventListener("change", () => {
    const form = input.form;
    const groupMode = form.elements.kind.value === "group";
    const recipient = form.elements.umpireProfileId;
    const group = form.elements.group;
    recipient.disabled = groupMode;
    recipient.required = !groupMode;
    group.disabled = !groupMode;
    root.querySelector("[data-compose-individual]").classList.toggle("is-disabled", groupMode);
    root.querySelector("[data-compose-group]").classList.toggle("is-disabled", !groupMode);
    currentPageContext = nextMessageContext(view, { composerOpen: true, composeKind: groupMode ? "group" : "individual" });
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
    } else result = await messagingService.sendDirect({ umpireProfileId: data.get("umpireProfileId") || null, subject: data.get("subject"), body: data.get("body"), announcementId: view.announcementId || null });
    form.querySelector(".form-status").textContent = result.message;
    if (result.success) renderPage("messages", { tab: isGroup ? "announcements" : "inbox" });
  });
  root.querySelectorAll("[data-conversation-toggle]").forEach(button => button.addEventListener("click", async () => {
    const id = button.dataset.conversationToggle;
    const opening = view.expandedConversationId !== id;
    if (opening) await messagingService.markRead({ conversationId: id });
    renderPage("messages", nextMessageContext(view, { expandedConversationId: opening ? id : "", expandedAnnouncementId: "" }));
  }));
  root.querySelectorAll("[data-announcement-toggle]").forEach(button => button.addEventListener("click", async () => {
    const id = button.dataset.announcementToggle;
    const opening = view.expandedAnnouncementId !== id;
    if (opening) await messagingService.markRead({ announcementId: id });
    renderPage("messages", nextMessageContext(view, { expandedAnnouncementId: opening ? id : "", expandedConversationId: "" }));
  }));
  root.querySelectorAll(".message-reply-form").forEach(form => form.addEventListener("submit", async event => {
    event.preventDefault();
    const body = new FormData(form).get("body");
    const result = await messagingService.sendDirect({ umpireProfileId: form.dataset.umpireProfileId, body });
    form.querySelector(".form-status").textContent = result.message;
    if (result.success) renderPage("messages", nextMessageContext(view, { tab: "inbox", expandedConversationId: form.dataset.conversationId }));
  }));
  root.querySelectorAll(".message-announcement-reply").forEach(button => button.addEventListener("click", () => {
    renderPage("messages", nextMessageContext(view, { composerOpen: true, composeKind: "individual", announcementId: button.dataset.announcementId }));
  }));
}

window.renderMessages = renderMessages;
window.setupMessagesPage = setupMessagesPage;
