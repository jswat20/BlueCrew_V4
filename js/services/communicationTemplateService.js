const communicationTemplateService = (() => {
  const labels = Object.freeze({
    "account-approved": "Account Approved", "account-rejected": "Account Update", "claim-submitted": "Claim Submitted",
    "claim-approved": "Claim Approved", "claim-rejected": "Claim Rejected", "claim-withdrawn": "Claim Withdrawn",
    "assignment-created": "Assignment Created", "assignment-removed": "Assignment Removed", "assignment-declined": "Assignment Declined",
    "game-cancelled": "Game Cancelled", "game-date-changed": "Game Date Changed", "game-time-changed": "Game Time Changed",
    "game-location-changed": "Game Location Changed", "game-field-changed": "Game Field Changed", "game-reminder": "Game Reminder",
    "availability-reminder": "Availability Reminder"
  });
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]); }
  function formatDate(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return String(value || "Date unavailable");
    return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
  }
  function gameIdentifier(metadata = {}) {
    const formatted = presentationFormattingService.formatGameIdentifier(metadata.gameIdentifier || metadata);
    return formatted === "Game ID unavailable" ? String(metadata.gameDisplay || metadata.gameId || "Game unavailable") : formatted;
  }
  function division(metadata = {}) { return levelTerminologyService.aliasFor(metadata.level) || levelTerminologyService.canonicalize(metadata.level) || "Division unavailable"; }
  function render(event, recipient) {
    const title = labels[event.type] || "The Slate Update";
    const metadata = { ...(event.metadata || {}), gameId: event.gameId || event.metadata?.gameId || "" };
    const approved = event.type === "claim-approved";
    const rejected = event.type === "claim-rejected";
    const assignment = event.type === "assignment-created";
    const lead = approved ? "Your claim has been approved." : rejected ? "Your claim was not approved." : assignment ? "You have a new assignment." : `${title}.`;
    const facts = [
      metadata.gameId || metadata.gameIdentifier ? ["Game", gameIdentifier(metadata)] : null,
      metadata.level ? ["Division", division(metadata)] : null,
      metadata.date ? ["Date", formatDate(metadata.date)] : null,
      metadata.time ? ["Time", dateTimeFormattingService.formatTime12Hour(metadata.time, "Time unavailable")] : null,
      metadata.location ? ["Location", metadata.location] : null,
      metadata.field ? ["Field", metadata.field] : null,
      metadata.position ? ["Assignment", presentationFormattingService.formatAssignmentPosition(metadata.position)] : null
    ].filter(Boolean);
    const actionPath = metadata.actionPath || event.actionPath || "";
    const textFacts = facts.map(([key, value]) => `${key}: ${value}`).join("\n");
    const textBody = [`Hi ${recipient.displayName},`, "", lead, textFacts ? `\n${textFacts}` : "", "Open The Slate to review this update."].filter(value => value !== "").join("\n");
    const htmlFacts = facts.length ? `<dl>${facts.map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd>`).join("")}</dl>` : "";
    return Object.freeze({ inAppTitle: title, inAppSummary: lead, emailSubject: `The Slate — ${title}`, emailTextBody: textBody,
      emailHtmlBody: `<p>Hi ${escapeHtml(recipient.displayName)},</p><p>${escapeHtml(lead)}</p>${htmlFacts}<p>Open The Slate to review this update.</p>`, actionPath });
  }
  return Object.freeze({ render });
})();
