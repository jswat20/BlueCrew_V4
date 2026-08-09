const TITLES = Object.freeze({
  "account-approved": "Account Approved", "account-rejected": "Account Update", "claim-submitted": "New Game Claim", "claim-approved": "Claim Approved",
  "claim-rejected": "Claim Rejected", "claim-withdrawn": "Claim Withdrawn", "assignment-created": "Assignment Confirmed", "assignment-removed": "Assignment Removed",
  "assignment-declined": "Assignment Declined", "game-cancelled": "Game Cancelled", "game-date-changed": "Game Date Changed", "game-time-changed": "Game Time Changed",
  "game-location-changed": "Game Location Changed", "game-field-changed": "Game Field Changed", "game-reminder": "Game Reminder", "availability-reminder": "Availability Reminder"
});
const POSITION = Object.freeze({ Plate: "U1", Base: "U2", U3: "U3", U4: "U4" });
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]); }
function time12(value) { const match = String(value || "").match(/^(\d{1,2}):(\d{2})/); if (!match) return "Time unavailable"; const hour = Number(match[1]); return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? "PM" : "AM"}`; }
function longDate(value) { const match = String(value || "").match(/^\d{4}-\d{2}-\d{2}$/); return match ? new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)) : String(value || "Date unavailable"); }
function gameId(metadata, fallback) { const clean = value => String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, ""); const sequence = clean(metadata.sequence || metadata.gameNumber); const parts = [metadata.year, metadata.seasonCode, metadata.organizationCode || metadata.leagueCode, metadata.canonicalLevel || metadata.level, sequence ? sequence.padStart(4, "0") : ""].map(clean).filter(Boolean); return parts.length >= 4 ? parts.join("-") : metadata.gameDisplay || fallback || "Game unavailable"; }
function actionUrl(baseUrl, path) { if (!baseUrl || /localhost|127\.0\.0\.1/i.test(baseUrl)) return ""; try { return new URL(String(path || "").replace(/^\//, ""), `${String(baseUrl).replace(/\/$/, "")}/`).toString(); } catch { return ""; } }

export function renderCommunicationEmail(row, { appUrl = "" } = {}) {
  const metadata = row.metadata || {}; const title = TITLES[row.event_type] || "The Slate Update";
  const lead = row.event_type === "claim-approved" ? "Your claim has been approved." : row.event_type === "claim-rejected" ? "Your claim was not approved." : row.event_type === "assignment-created" ? "You have been assigned a game." : row.event_type === "assignment-removed" ? "You have been removed from a game." : row.event_type === "claim-submitted" ? "A new game claim was submitted." : row.event_type === "assignment-declined" ? "An assignment was declined." : `${title}.`;
  const aliases = row.organization_settings?.level_aliases || {}; const level = metadata.canonicalLevel || metadata.level || "";
  const facts = [["Game", gameId(metadata, row.game_id)], ["Division", aliases[level] || level], ["Date", metadata.date ? longDate(metadata.date) : ""], ["Time", metadata.time ? time12(metadata.time) : ""], ["Location", metadata.location], ["Field", metadata.field], ["Assignment", metadata.position ? POSITION[metadata.position] || metadata.position : ""]].filter(([, value]) => value);
  const link = actionUrl(appUrl, metadata.actionPath); const textFacts = facts.map(([label, value]) => `${label}: ${value}`).join("\n");
  const text = [`Hi ${row.recipient_display_name || "The Slate user"},`, "", lead, "", textFacts, "", link ? `Open The Slate: ${link}` : "Open The Slate to review this update."].filter((value, index, values) => value !== "" || values[index - 1] !== "").join("\n");
  const factRows = facts.map(([label, value]) => `<tr><td style="padding:4px 12px 4px 0;color:#526b7a;font-weight:700">${escapeHtml(label)}</td><td style="padding:4px 0;color:#0f2942">${escapeHtml(value)}</td></tr>`).join("");
  const action = link ? `<p style="margin:24px 0"><a href="${escapeHtml(link)}" style="background:#0f2942;color:#fff;padding:10px 16px;text-decoration:none;border-radius:4px">Open The Slate</a></p>` : "";
  return { subject: `The Slate — ${title}`, text, html: `<div style="font-family:Arial,sans-serif;max-width:600px;color:#0f2942"><div style="border-top:5px solid #18a7b8;padding-top:18px"><h1 style="font-size:22px;margin:0 0 18px">The Slate</h1><p>Hi ${escapeHtml(row.recipient_display_name || "The Slate user")},</p><p>${escapeHtml(lead)}</p><table role="presentation" style="border-collapse:collapse">${factRows}</table>${action}<p style="color:#526b7a;font-size:13px">This transactional message was sent by The Slate.</p></div></div>` };
}
