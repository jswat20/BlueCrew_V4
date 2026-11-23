let tournamentManagerOverlay = null;
const tournamentEscape = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const tournamentOption = (value, label, selected = false) =>
  `<option value="${tournamentEscape(value)}" ${selected ? "selected" : ""}>${tournamentEscape(label)}</option>`;
async function openTournamentManager() {
  if (
    !authorizationService.canEditSchedule() ||
    !workspaceService.hasModule("tournament")
  )
    return false;
  await Promise.all([
    tournamentManagementService.load(),
    facilityService.load(),
  ]);
  closeTournamentManager();
  tournamentManagerOverlay = document.createElement("div");
  tournamentManagerOverlay.innerHTML = `<div class="assign-drawer-backdrop" onclick="closeTournamentManager()"></div><aside class="assign-drawer game-editor-modal tournament-manager" role="dialog" aria-modal="true" aria-labelledby="tournament-manager-title" data-testid="tournament-manager"><header class="assign-drawer-header"><h2 id="tournament-manager-title">Tournament Management</h2><button class="button button-link" aria-label="Close tournament manager" onclick="closeTournamentManager()">×</button></header><div id="tournament-manager-body"></div></aside>`;
  document.body.appendChild(tournamentManagerOverlay);
  renderTournamentList();
}
function closeTournamentManager() {
  tournamentManagerOverlay?.remove();
  tournamentManagerOverlay = null;
}
function tournamentBody() {
  return document.getElementById("tournament-manager-body");
}
function renderTournamentList() {
  const s = tournamentManagementService.snapshot();
  tournamentBody().innerHTML = `<section><div class="assign-drawer-actions"><button class="button button-primary" onclick="renderTournamentForm()">Create Tournament</button></div><div class="tournament-card-grid">${s.tournaments.map((t) => `<article class="presentation-panel"><strong>${tournamentEscape(t.name)}</strong><span>${tournamentEscape(t.sport)} · ${t.starts_on}–${t.ends_on} · ${t.status}</span><button class="button button-link" onclick="openTournament('${t.id}')">Manage</button></article>`).join("") || "<p>No tournaments yet.</p>"}</div></section>`;
}
function renderTournamentForm(t = {}) {
  tournamentBody().innerHTML = `<form class="game-editor-form" onsubmit="submitTournament(event)"><h3>${t.id ? "Edit" : "Create"} Tournament</h3><input type="hidden" name="id" value="${t.id || ""}"><label>Name<input name="name" value="${tournamentEscape(t.name || "")}" required></label><label>Sport<input name="sport" value="${tournamentEscape(t.sport || "Softball")}" required></label><div class="schedule-generator-grid"><label>Starts<input name="starts_on" type="date" value="${t.starts_on || ""}" required></label><label>Ends<input name="ends_on" type="date" value="${t.ends_on || ""}" required></label></div><label>Timezone<input name="timezone" value="${tournamentEscape(t.timezone || "America/New_York")}" required></label><label>Description<textarea name="description">${tournamentEscape(t.description || "")}</textarea></label><div class="assign-drawer-actions"><button class="button button-primary">Save Tournament</button><button type="button" class="button button-secondary" onclick="renderTournamentList()">Cancel</button></div><div role="alert" id="tournament-error"></div></form>`;
}
async function submitTournament(event) {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));
  const result = await tournamentManagementService.saveTournament(values);
  if (!result.success) return tournamentError(result.message);
  toastService.success("Tournament saved.");
  openTournament(result.data.id);
}
async function openTournament(id) {
  tournamentManagementService.selectTournament(id);
  renderTournamentDetail();
}
function tournamentLifecycleActions(status) {
  const transitions = {
    draft: [["registration", "Open Registration"]],
    registration: [
      ["draft", "Return to Draft"],
      ["scheduled", "Mark Scheduled"],
      ["cancelled", "Cancel Tournament"],
    ],
    scheduled: [
      ["active", "Start Tournament"],
      ["cancelled", "Cancel Tournament"],
    ],
    active: [
      ["completed", "Complete Tournament"],
      ["cancelled", "Cancel Tournament"],
    ],
    completed: [],
    cancelled: [],
  };
  return (transitions[status] || [])
    .map(
      ([next, label]) =>
        `<button class="button button-secondary" onclick="transitionTournamentStatus('${next}')">${label}</button>`,
    )
    .join("");
}
function editCurrentTournament() {
  const s = tournamentManagementService.snapshot();
  const tournament = s.tournaments.find(
    (item) => item.id === s.currentTournamentId,
  );
  if (tournament) renderTournamentForm(tournament);
}
function renderTournamentDetail() {
  const s = tournamentManagementService.snapshot(),
    t = s.tournaments.find((x) => x.id === s.currentTournamentId);
  if (!t) return renderTournamentList();
  const divisions = s.divisions.filter((x) => x.tournament_id === t.id),
    teams = s.teams.filter((x) => x.tournament_id === t.id && !x.withdrawn_at),
    pools = s.pools.filter((x) => x.tournament_id === t.id);
  tournamentBody().innerHTML = `<section data-testid="tournament-detail"><div class="presentation-panel"><strong>${tournamentEscape(t.name)}</strong><p>${tournamentEscape(t.sport)} · ${t.starts_on}–${t.ends_on} · ${t.status}</p><p>${tournamentEscape(t.description)}</p></div><div class="assign-drawer-actions"><button class="button button-secondary" onclick="editCurrentTournament()">Edit</button>${tournamentLifecycleActions(t.status)}<button class="button button-secondary" onclick="renderTournamentList()">All Tournaments</button></div>
  <h3>Divisions</h3><button class="button button-primary" onclick="renderTournamentDivisionForm()">Add Division</button>${divisions.map((d) => `<article class="presentation-panel"><strong>${tournamentEscape(d.name)}</strong><span>${tournamentEscape(d.age_group)} · ${d.game_duration_minutes} minutes</span></article>`).join("") || "<p>No divisions yet.</p>"}
  <h3>Registered Teams</h3><button class="button button-primary" ${divisions.length ? "" : "disabled"} onclick="renderTournamentTeamForm()">Register Team</button>${teams.map((team) => `<article class="presentation-panel"><strong>${tournamentEscape(team.name)}</strong><span>${tournamentEscape(divisions.find((d) => d.id === team.division_id)?.name || "")}${team.seed ? ` · Seed ${team.seed}` : ""}</span><button class="button button-link" onclick="renderTournamentTeamForm('${team.id}')">Edit</button><button class="button button-link" onclick="withdrawTournamentTeam('${team.id}')">Withdraw</button></article>`).join("") || "<p>No teams registered.</p>"}
  <h3>Pools</h3><button class="button button-primary" ${divisions.length ? "" : "disabled"} onclick="renderTournamentPoolForm()">Add Pool</button>${
    pools
      .map(
        (pool) =>
          `<article class="presentation-panel"><strong>${tournamentEscape(pool.name)}</strong><span>${tournamentEscape(divisions.find((d) => d.id === pool.division_id)?.name || "")}</span>${teams
            .filter((x) => x.division_id === pool.division_id)
            .map(
              (team) =>
                `<label>${tournamentEscape(team.name)}<input type="radio" name="pool-${team.id}" ${s.memberships.some((m) => m.team_id === team.id && m.pool_id === pool.id) ? "checked" : ""} onchange="assignTournamentPool('${team.id}','${pool.id}')"></label>`,
            )
            .join("")}</article>`,
      )
      .join("") || "<p>No pools yet.</p>"
  }
  <h3>Pool-play Scheduling</h3><div class="assign-drawer-actions"><button class="button button-primary" ${pools.length ? "" : "disabled"} onclick="renderTournamentScheduleForm()">Generate Schedule</button><button class="button button-secondary" onclick="renderTournamentProposalList()">Saved Proposals</button></div></section>`;
}
async function transitionTournamentStatus(status) {
  const id = tournamentManagementService.snapshot().currentTournamentId,
    result = await tournamentManagementService.transition(id, status);
  if (!result.success) return tournamentError(result.message);
  renderTournamentDetail();
}
function renderTournamentDivisionForm() {
  const id = tournamentManagementService.snapshot().currentTournamentId;
  tournamentBody().innerHTML = `<form class="game-editor-form" onsubmit="submitTournamentDivision(event)"><h3>Add Division</h3><input type="hidden" name="tournament_id" value="${id}"><label>Name<input name="name" required></label><label>Age group<input name="age_group"></label><label>Game minutes<input name="game_duration_minutes" type="number" min="15" max="1440" value="90" required></label><button class="button button-primary">Save Division</button><button type="button" class="button button-secondary" onclick="renderTournamentDetail()">Cancel</button><div role="alert" id="tournament-error"></div></form>`;
}
async function submitTournamentDivision(event) {
  event.preventDefault();
  const r = await tournamentManagementService.addDivision(
    Object.fromEntries(new FormData(event.currentTarget)),
  );
  if (!r.success) return tournamentError(r.message);
  renderTournamentDetail();
}
function renderTournamentTeamForm(id) {
  const s = tournamentManagementService.snapshot(),
    team = s.teams.find((x) => x.id === id) || {},
    divisions = s.divisions.filter(
      (x) => x.tournament_id === s.currentTournamentId,
    );
  tournamentBody().innerHTML = `<form class="game-editor-form" onsubmit="submitTournamentTeam(event)"><h3>${id ? "Edit" : "Register"} Team</h3><input type="hidden" name="id" value="${id || ""}"><input type="hidden" name="tournament_id" value="${s.currentTournamentId}"><label>Division<select name="division_id" required>${divisions.map((d) => tournamentOption(d.id, d.name, d.id === team.division_id)).join("")}</select></label><label>Team name<input name="name" value="${tournamentEscape(team.name || "")}" required></label><label>Contact name<input name="contact_name" value="${tournamentEscape(team.contact_name || "")}"></label><label>Contact email<input name="contact_email" type="email" value="${tournamentEscape(team.contact_email || "")}"></label><label>Contact phone<input name="contact_phone" value="${tournamentEscape(team.contact_phone || "")}"></label><label>Seed<input name="seed" type="number" min="1" value="${team.seed || ""}"></label><button class="button button-primary">Save Team</button><button type="button" class="button button-secondary" onclick="renderTournamentDetail()">Cancel</button><div role="alert" id="tournament-error"></div></form>`;
}
async function submitTournamentTeam(event) {
  event.preventDefault();
  const r = await tournamentManagementService.saveTeam(
    Object.fromEntries(new FormData(event.currentTarget)),
  );
  if (!r.success) return tournamentError(r.message);
  renderTournamentDetail();
}
async function withdrawTournamentTeam(id) {
  const r = await tournamentManagementService.withdrawTeam(id);
  if (!r.success) return tournamentError(r.message);
  renderTournamentDetail();
}
function renderTournamentPoolForm() {
  const s = tournamentManagementService.snapshot(),
    divisions = s.divisions.filter(
      (x) => x.tournament_id === s.currentTournamentId,
    );
  tournamentBody().innerHTML = `<form class="game-editor-form" onsubmit="submitTournamentPool(event)"><h3>Add Pool</h3><input type="hidden" name="tournament_id" value="${s.currentTournamentId}"><label>Division<select name="division_id">${divisions.map((d) => tournamentOption(d.id, d.name)).join("")}</select></label><label>Pool name<input name="name" placeholder="Pool A" required></label><button class="button button-primary">Save Pool</button><button type="button" class="button button-secondary" onclick="renderTournamentDetail()">Cancel</button><div role="alert" id="tournament-error"></div></form>`;
}
async function submitTournamentPool(event) {
  event.preventDefault();
  const r = await tournamentManagementService.addPool(
    Object.fromEntries(new FormData(event.currentTarget)),
  );
  if (!r.success) return tournamentError(r.message);
  renderTournamentDetail();
}
async function assignTournamentPool(team, pool) {
  const r = await tournamentManagementService.assignTeam(team, pool);
  if (!r.success) return tournamentError(r.message);
  renderTournamentDetail();
}
function renderTournamentScheduleForm() {
  const s = tournamentManagementService.snapshot(),
    t = s.tournaments.find((x) => x.id === s.currentTournamentId),
    f = facilityService.snapshot();
  tournamentBody().innerHTML = `<form class="game-editor-form" onsubmit="generateTournamentSchedule(event)"><h3>Generate Pool-play Schedule</h3><label>Proposal name<input name="name" value="${tournamentEscape(t.name)} Pool Play" required></label><label>Fields<select name="fields" multiple size="${Math.max(3, f.fields.length)}" required>${f.fields
    .filter((x) => x.active && x.status !== "closed")
    .map((x) =>
      tournamentOption(
        x.id,
        `${f.facilities.find((y) => y.id === x.location_id)?.name || "Complex"} — ${x.name}`,
        true,
      ),
    )
    .join(
      "",
    )}</select></label><div class="schedule-generator-grid"><label>Starts<input name="startDate" type="date" value="${t.starts_on}" required></label><label>Ends<input name="endDate" type="date" value="${t.ends_on}" required></label><label>Window opens<input name="windowStart" type="time" value="08:00" required></label><label>Window closes<input name="windowEnd" type="time" value="20:00" required></label><label>Buffer minutes<input name="bufferMinutes" type="number" min="0" max="180" value="15"></label></div><fieldset><legend>Playing days</legend>${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, i) => `<label><input type="checkbox" name="weekday" value="${i}" checked>${day}</label>`).join("")}</fieldset><button class="button button-primary">Generate Proposal</button><button type="button" class="button button-secondary" onclick="renderTournamentDetail()">Cancel</button><div role="alert" id="tournament-error"></div></form>`;
}
async function generateTournamentSchedule(event) {
  event.preventDefault();
  const form = event.currentTarget,
    value = (name) => form.querySelector(`[name="${name}"]`).value,
    config = {
      tournamentId: tournamentManagementService.snapshot().currentTournamentId,
      name: value("name"),
      fieldIds: [...form.querySelector('[name="fields"]').selectedOptions].map(
        (x) => x.value,
      ),
      startDate: value("startDate"),
      endDate: value("endDate"),
      windowStart: value("windowStart"),
      windowEnd: value("windowEnd"),
      bufferMinutes: Number(value("bufferMinutes") || 0),
      weekdays: [...form.querySelectorAll('[name="weekday"]:checked')].map(
        (x) => Number(x.value),
      ),
    };
  const r = await tournamentManagementService.saveProposal(config);
  if (!r.success) return tournamentError(r.message);
  toastService.success(r.message);
  renderTournamentProposal();
}
function renderTournamentProposalList() {
  const s = tournamentManagementService.snapshot(),
    items = s.proposals.filter(
      (x) => x.tournament_id === s.currentTournamentId,
    );
  tournamentBody().innerHTML = `<section><h3>Saved Proposals</h3>${items.map((x) => `<article class="presentation-panel"><strong>${tournamentEscape(x.name)}</strong><span>${x.status}</span><button class="button button-link" onclick="openTournamentProposal('${x.id}')">Open</button></article>`).join("") || "<p>No proposals yet.</p>"}<button class="button button-secondary" onclick="renderTournamentDetail()">Back</button></section>`;
}
async function openTournamentProposal(id) {
  const r = await tournamentManagementService.selectProposal(id);
  if (!r.success) return tournamentError(r.message);
  renderTournamentProposal();
}
function renderTournamentProposal() {
  const s = tournamentManagementService.snapshot(),
    proposal = s.proposals.find((x) => x.id === s.currentProposalId),
    f = facilityService.snapshot(),
    team = (id) => s.teams.find((x) => x.id === id)?.name || "Team",
    pool = (id) => s.pools.find((x) => x.id === id)?.name || "Pool";
  tournamentBody().innerHTML = `<section data-testid="tournament-proposal-preview"><h3>${tournamentEscape(proposal.name)}</h3><p>${proposal.status} · ${s.proposalGames.filter((x) => x.state === "scheduled").length} scheduled · ${s.proposalGames.filter((x) => x.state === "unscheduled").length} unscheduled</p><div class="table-responsive"><table><thead><tr><th>Pool</th><th>Matchup</th><th>Date</th><th>Time</th><th>Field</th><th>Status</th><th></th></tr></thead><tbody>${s.proposalGames.map((g) => `<tr><td>${tournamentEscape(pool(g.pool_id))}</td><td>${tournamentEscape(team(g.away_team_id))} @ ${tournamentEscape(team(g.home_team_id))}</td><td>${g.game_date || "—"}</td><td>${g.game_time?.slice(0, 5) || "—"}</td><td>${tournamentEscape(f.fields.find((x) => x.id === g.field_id)?.name || "Unscheduled")}</td><td>${g.state}${g.issue ? `: ${tournamentEscape(g.issue)}` : ""}</td><td>${proposal.status === "draft" ? `<button class="button button-link" onclick="editTournamentProposalGame('${g.id}')">Adjust</button>` : ""}</td></tr>`).join("")}</tbody></table></div><div class="assign-drawer-actions">${proposal.status === "draft" ? `<button class="button button-primary" onclick="publishTournamentSchedule()">Publish Atomically</button>` : `<button class="button button-primary" onclick="publishTournamentSchedule()">Verify Idempotent Publication</button>`}<button class="button button-secondary" onclick="renderTournamentProposalList()">All Proposals</button></div><div role="alert" id="tournament-error"></div></section>`;
}
function editTournamentProposalGame(id) {
  const s = tournamentManagementService.snapshot(),
    g = s.proposalGames.find((x) => x.id === id),
    f = facilityService.snapshot();
  tournamentBody().innerHTML = `<form class="game-editor-form" onsubmit="saveTournamentProposalGame(event,'${id}')"><h3>Adjust Proposed Game</h3><label>Date<input name="date" type="date" value="${g.game_date || ""}" required></label><label>Time<input name="time" type="time" value="${g.game_time?.slice(0, 5) || ""}" required></label><label>Field<select name="fieldId">${f.fields.map((x) => tournamentOption(x.id, `${f.facilities.find((y) => y.id === x.location_id)?.name || "Complex"} — ${x.name}`, x.id === g.field_id)).join("")}</select></label><label>Notes<textarea name="notes">${tournamentEscape(g.notes)}</textarea></label><button class="button button-primary">Save Adjustment</button><button type="button" class="button button-secondary" onclick="renderTournamentProposal()">Cancel</button><div role="alert" id="tournament-error"></div></form>`;
}
async function saveTournamentProposalGame(event, id) {
  event.preventDefault();
  const form = event.currentTarget,
    field = facilityService
      .snapshot()
      .fields.find((x) => x.id === form.fieldId.value),
    r = await tournamentManagementService.updateProposalGame({
      id,
      date: form.date.value,
      time: form.time.value,
      fieldId: field.id,
      locationId: field.location_id,
      notes: form.notes.value,
    });
  if (!r.success) return tournamentError(r.message);
  renderTournamentProposal();
}
async function publishTournamentSchedule() {
  const r = await tournamentManagementService.publishProposal();
  if (!r.success) return tournamentError(r.message);
  toastService.success(r.message);
  renderTournamentProposal();
  renderScheduleContent();
}
function tournamentError(message) {
  const el = document.getElementById("tournament-error");
  if (el) el.textContent = message;
  else toastService.error(message);
}
