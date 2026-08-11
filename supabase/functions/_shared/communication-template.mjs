const TITLES = Object.freeze({
  "account-approved": "Account Approved", "account-rejected": "Account Update", "claim-submitted": "New Game Claim", "claim-approved": "Claim Approved",
  "claim-rejected": "Claim Rejected", "claim-withdrawn": "Claim Withdrawn", "assignment-created": "Assignment Confirmed", "assignment-removed": "Assignment Removed",
  "assignment-declined": "Assignment Declined", "game-cancelled": "Game Cancelled", "game-restored": "Game Restored", "game-date-changed": "Game Date Changed",
  "game-time-changed": "Game Time Changed", "game-location-changed": "Location Changed", "game-field-changed": "Field Changed",
  "game-reminder-24-hour": "Game Tomorrow", "game-reminder-2-hour": "Game in 2 Hours", "game-reminder-30-minute": "Game Starts Soon", "availability-reminder": "Availability Reminder"
});
const GAME_CHANGES = new Set(["game-cancelled", "game-restored", "game-date-changed", "game-time-changed", "game-location-changed", "game-field-changed"]);
const POSITION = Object.freeze({ Plate: "U1", Base: "U2", U3: "U3", U4: "U4" });
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]); }
function time12(value) { const match = String(value || "").match(/^(\d{1,2}):(\d{2})/); if (!match) return "Time unavailable"; const hour = Number(match[1]); return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? "PM" : "AM"}`; }
function longDate(value) { const match = String(value || "").match(/^\d{4}-\d{2}-\d{2}$/); return match ? new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)) : String(value || "Date unavailable"); }
function gameId(metadata, fallback) { const clean = value => String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, ""); const sequence = clean(metadata.sequence || metadata.gameNumber); const parts = [metadata.year, metadata.seasonCode, metadata.organizationCode || metadata.leagueCode, metadata.canonicalLevel || metadata.level, sequence ? sequence.padStart(4, "0") : ""].map(clean).filter(Boolean); return parts.length >= 4 ? parts.join("-") : metadata.gameDisplay || fallback || "Game unavailable"; }
function actionUrl(baseUrl, path) { if (!baseUrl || /localhost|127\.0\.0\.1/i.test(baseUrl)) return ""; try { return new URL(String(path || "").replace(/^\//, ""), `${String(baseUrl).replace(/\/$/, "")}/`).toString(); } catch { return ""; } }
function leadFor(type, title) {
  if (type === "claim-approved") return "Your claim has been approved.";
  if (type === "claim-rejected") return "Your claim was not approved.";
  if (type === "assignment-created") return "You have been assigned a game.";
  if (type === "assignment-removed") return "You have been removed from a game.";
  if (type === "claim-submitted") return "A new game claim was submitted.";
  if (type === "assignment-declined") return "An assignment was declined.";
  if (type === "game-cancelled") return "Your assigned game has been cancelled.";
  if (type === "game-restored") return "Your assigned game has been restored.";
  if (type === "game-reminder-24-hour") return "Your game begins in approximately 24 hours.";
  if (type === "game-reminder-2-hour") return "Your game begins in approximately two hours.";
  if (type === "game-reminder-30-minute") return "Your game begins in approximately 30 minutes.";
  return GAME_CHANGES.has(type) ? "The game below has been updated." : `${title}.`;
}

export function renderCommunicationEmail(row, { appUrl = "" } = {}) {
  const metadata = row.metadata || {}; const title = TITLES[row.event_type] || "The Slate Update"; const lead = leadFor(row.event_type, title);
  const aliases = row.organization_settings?.level_aliases || {}; const level = metadata.canonicalLevel || metadata.level || "";
  const facts = [["Game", gameId(metadata, row.game_id)], ["Division", metadata.divisionAlias || aliases[level] || level], ["Date", metadata.date ? longDate(metadata.date) : ""], ["Time", metadata.time ? time12(metadata.time) : ""], ["Location", metadata.location], ["Field", metadata.field], ["Assignment", metadata.position ? POSITION[metadata.position] || metadata.position : ""]].filter(([, value]) => value);
  const link = actionUrl(appUrl, metadata.actionPath); const textFacts = facts.map(([label, value]) => `${label}: ${value}`).join("\n");
  const changeText = metadata.changeLabel && (metadata.oldValue !== undefined || metadata.newValue !== undefined) ? `${metadata.changeLabel} changed from:\n${metadata.oldValue || "not set"}\n\nto\n\n${metadata.newValue || "not set"}` : "";
  const text = [`Hi ${row.recipient_display_name || "The Slate user"},`, "", lead, "", changeText, changeText ? "" : null, textFacts, "", link ? `Open The Slate: ${link}` : "Open The Slate to review this update."].filter((value, index, values) => value !== null && (value !== "" || values[index - 1] !== "")).join("\n");
  const changeBlock = changeText ? `<p><strong>${escapeHtml(metadata.changeLabel)} changed</strong></p><p>${escapeHtml(metadata.oldValue || "not set")}<br aria-hidden="true">↓<br aria-hidden="true">${escapeHtml(metadata.newValue || "not set")}</p>` : "";
  const factRows = facts.map(([label, value]) => `<tr><td style="padding:4px 12px 4px 0;color:#526b7a;font-weight:700">${escapeHtml(label)}</td><td style="padding:4px 0;color:#0f2942">${escapeHtml(value)}</td></tr>`).join("");
  const action = link ? `<p style="margin:24px 0"><a href="${escapeHtml(link)}" style="background:#0f2942;color:#fff;padding:10px 16px;text-decoration:none;border-radius:4px">Open The Slate</a></p>` : "";
  return { subject: `The Slate — ${title}`, text, html: `<div style="font-family:Arial,sans-serif;max-width:600px;color:#0f2942"><div style="border-top:5px solid #18a7b8;padding-top:18px"><h1 style="font-size:22px;margin:0 0 18px">The Slate</h1><p>Hi ${escapeHtml(row.recipient_display_name || "The Slate user")},</p><p>${escapeHtml(lead)}</p>${changeBlock}<table role="presentation" style="border-collapse:collapse">${factRows}</table>${action}<p style="color:#526b7a;font-size:13px">This transactional message was sent by The Slate.</p></div></div>` };
}
