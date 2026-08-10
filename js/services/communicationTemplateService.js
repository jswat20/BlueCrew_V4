const communicationTemplateService = (() => {
  const labels = Object.freeze({
    "account-approved": "Account Approved", "account-rejected": "Account Update", "claim-submitted": "New Game Claim",
    "claim-approved": "Claim Approved", "claim-rejected": "Claim Rejected", "claim-withdrawn": "Claim Withdrawn",
    "assignment-created": "Assignment Confirmed", "assignment-removed": "Assignment Removed", "assignment-declined": "Assignment Declined",
    "game-cancelled": "Game Cancelled", "game-restored": "Game Restored", "game-date-changed": "Game Date Changed", "game-time-changed": "Game Time Changed",
    "game-location-changed": "Location Changed", "game-field-changed": "Field Changed", "game-reminder": "Game Reminder",
    "availability-reminder": "Availability Reminder"
  });
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]); }
  function formatDate(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return String(value || "Date unavailable");
    return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
  }
  function gameIdentifier(metadata = {}) {
    if (metadata.gameDisplay) return String(metadata.gameDisplay);
    const formatted = presentationFormattingService.formatGameIdentifier(metadata.gameIdentifier || metadata);
    return formatted === "Game ID unavailable" ? String(metadata.gameDisplay || metadata.gameId || "Game unavailable") : formatted;
  }
  function division(metadata = {}) { return metadata.divisionAlias || levelTerminologyService.aliasFor(metadata.level) || levelTerminologyService.canonicalize(metadata.level) || "Division unavailable"; }
  function render(event, recipient) {
    const title = labels[event.type] || "The Slate Update";
    const metadata = { ...(event.metadata || {}), gameId: event.gameId || event.metadata?.gameId || "" };
    const approved = event.type === "claim-approved";
    const rejected = event.type === "claim-rejected";
    const assignment = event.type === "assignment-created";
    const removed = event.type === "assignment-removed";
    const submitted = event.type === "claim-submitted";
    const declined = event.type === "assignment-declined";
    const gameChange = ["game-cancelled", "game-restored", "game-date-changed", "game-time-changed", "game-location-changed", "game-field-changed"].includes(event.type);
    const lead = approved ? "Your claim has been approved." : rejected ? "Your claim was not approved." : assignment ? "You have been assigned a game." : removed ? "You have been removed from a game." : submitted ? "A new game claim was submitted." : declined ? "An assignment was declined." : event.type === "game-cancelled" ? "Your assigned game has been cancelled." : event.type === "game-restored" ? "Your assigned game has been restored." : gameChange ? "The game below has been updated." : `${title}.`;
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
    const changeText = metadata.changeLabel && (metadata.oldValue !== undefined || metadata.newValue !== undefined) ? `${metadata.changeLabel} changed from:\n${metadata.oldValue || "not set"}\n\nto\n\n${metadata.newValue || "not set"}` : "";
    const textBody = [`Hi ${recipient.displayName},`, "", lead, changeText ? `\n${changeText}` : "", textFacts ? `\n${textFacts}` : "", "Open The Slate to review this update."].filter(value => value !== "").join("\n");
    const htmlFacts = facts.length ? `<dl>${facts.map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd>`).join("")}</dl>` : "";
    const htmlChange = changeText ? `<p><strong>${escapeHtml(metadata.changeLabel)} changed</strong></p><p>${escapeHtml(metadata.oldValue || "not set")}<br aria-hidden="true">↓<br aria-hidden="true">${escapeHtml(metadata.newValue || "not set")}</p>` : "";
    const inAppFacts = facts.map(([key, value]) => `${key}: ${value}`).join("\n");
    const inAppChange = metadata.changeLabel && (metadata.oldValue !== undefined || metadata.newValue !== undefined)
      ? `${metadata.changeLabel} changed\n${metadata.oldValue || "not set"} → ${metadata.newValue || "not set"}`
      : "";
    const inAppSummary = gameChange
      ? [lead, inAppFacts, inAppChange].filter(Boolean).join("\n\n")
      : lead;
    return Object.freeze({ inAppTitle: title, inAppSummary, emailSubject: `The Slate — ${title}`, emailTextBody: textBody,
      emailHtmlBody: `<p>Hi ${escapeHtml(recipient.displayName)},</p><p>${escapeHtml(lead)}</p>${htmlChange}${htmlFacts}<p>Open The Slate to review this update.</p>`, actionPath });
  }
  return Object.freeze({ render });
})();
